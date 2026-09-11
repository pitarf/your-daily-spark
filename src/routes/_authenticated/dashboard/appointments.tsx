import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { dayRangeUtc, formatPrice, formatTime, todayInTimezone } from "@/lib/scheduling/format";
import { zonedWallTimeToUtc } from "@/lib/scheduling/availability";

export const Route = createFileRoute("/_authenticated/dashboard/appointments")({
  component: AppointmentsPage,
});

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  customers: { name: string; phone: string | null } | null;
  services: { name: string; price: number } | null;
  professionals: { name: string } | null;
};

type Block = {
  id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
  professional_id: string | null;
  professionals: { name: string } | null;
};

const STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

function AppointmentsPage() {
  const { membership } = useEstablishment();
  const tz = membership.timezone;
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayInTimezone(tz));
  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockProfessionalId, setBlockProfessionalId] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);

  const range = dayRangeUtc(date, tz);
  const appointmentsQuery = useQuery({
    queryKey: ["admin-appointments", membership.establishmentId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, notes, customers(name, phone), services(name, price), professionals(name)",
        )
        .eq("establishment_id", membership.establishmentId)
        .gte("starts_at", range.start)
        .lt("starts_at", range.end)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const professionalsQuery = useQuery({
    queryKey: ["admin-block-professionals", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name")
        .eq("establishment_id", membership.establishmentId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const blocksQuery = useQuery({
    queryKey: ["admin-blocked-slots", membership.establishmentId, date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blocked_slots")
        .select("id, starts_at, ends_at, reason, professional_id, professionals(name)")
        .eq("establishment_id", membership.establishmentId)
        .gte("starts_at", range.start)
        .lt("starts_at", range.end)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as Block[];
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      const startMinutes = Number(blockStart.slice(0, 2)) * 60 + Number(blockStart.slice(3, 5));
      const endMinutes = Number(blockEnd.slice(0, 2)) * 60 + Number(blockEnd.slice(3, 5));
      if (endMinutes <= startMinutes) throw new Error("O fim do bloqueio deve ser depois do início.");

      const startsAt = zonedWallTimeToUtc(date, startMinutes, tz);
      const endsAt = zonedWallTimeToUtc(date, endMinutes, tz);
      if (startsAt.getTime() <= Date.now()) throw new Error("Não é possível criar bloqueio no passado.");

      const { error } = await supabase.from("blocked_slots").insert({
        establishment_id: membership.establishmentId,
        professional_id: blockProfessionalId || null,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        reason: blockReason.trim() || null,
      });
      if (error) {
        if (error.code === "23P01" || error.code === "P0001") {
          throw new Error("Esse bloqueio entra em conflito com um agendamento existente.");
        }
        throw error;
      }
    },
    onSuccess: async () => {
      setBlockError(null);
      setBlockReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
    },
    onError: (error: Error) => setBlockError(error.message),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("blocked_slots")
        .delete()
        .eq("id", id)
        .eq("establishment_id", membership.establishmentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-blocked-slots"] }),
    onError: (error: Error) => setBlockError(error.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: status as (typeof STATUSES)[number] })
        .eq("id", id)
        .eq("establishment_id", membership.establishmentId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-appointments"] }),
    onError: (error: Error) => setBlockError(error.message),
  });

  const professionals = professionalsQuery.data ?? [];
  const rows = appointmentsQuery.data ?? [];
  const blocks = blocksQuery.data ?? [];
  const occupiedCount = useMemo(
    () => rows.filter((row) => row.status !== "cancelled").length,
    [rows],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            {occupiedCount} atendimento(s) na data selecionada.
          </p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-muted-foreground">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Bloquear horário</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Bloqueie um período para todos os profissionais ou somente para um profissional. O banco impede bloqueios incompatíveis com atendimentos existentes.
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Início</span>
            <input
              type="time"
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Fim</span>
            <input
              type="time"
              value={blockEnd}
              onChange={(e) => setBlockEnd(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Profissional</span>
            <select
              value={blockProfessionalId}
              onChange={(e) => setBlockProfessionalId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">Todos</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Motivo</span>
            <input
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Almoço, manutenção..."
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>
        </div>
        {blockError ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{blockError}</p> : null}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={blockMutation.isPending}
            onClick={() => blockMutation.mutate()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {blockMutation.isPending ? "Bloqueando…" : "Bloquear horário"}
          </button>
        </div>

        {blocks.length > 0 ? (
          <div className="mt-4 rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bloqueios do dia</div>
            <ul className="divide-y divide-border">
              {blocks.map((block) => (
                <li key={block.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{formatTime(block.starts_at, tz)}–{formatTime(block.ends_at, tz)}</span>
                  <span className="text-muted-foreground">{block.professionals?.name ?? "Todos"}</span>
                  {block.reason ? <span className="text-muted-foreground">{block.reason}</span> : null}
                  <button
                    type="button"
                    onClick={() => deleteBlock.mutate(block.id)}
                    disabled={deleteBlock.isPending}
                    className="ml-auto text-xs underline disabled:opacity-60"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {appointmentsQuery.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : appointmentsQuery.isError ? (
          <p className="p-4 text-sm text-destructive">Não foi possível carregar a agenda.</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum agendamento nesta data.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Horário</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2">Profissional</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-foreground">
                    {formatTime(row.starts_at, tz)}–{formatTime(row.ends_at, tz)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-foreground">{row.customers?.name ?? "—"}</span>
                    {row.customers?.phone ? (
                      <span className="block text-xs text-muted-foreground">{row.customers.phone}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.services?.name}
                    {row.services ? <span className="block text-xs">{formatPrice(Number(row.services.price))}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.professionals?.name}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus.mutate({ id: row.id, status: e.target.value })}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
