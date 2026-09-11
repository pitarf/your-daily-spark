import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { dayRangeUtc, formatPrice, formatTime, todayInTimezone } from "@/lib/scheduling/format";

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

  const range = dayRangeUtc(date, tz);
  const query = useQuery({
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

  async function updateStatus(id: string, status: string) {
    await supabase
      .from("appointments")
      .update({ status: status as (typeof STATUSES)[number] })
      .eq("id", id);
    await queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
  }

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
          <p className="text-sm text-muted-foreground">Agendamentos do dia selecionado.</p>
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : query.isError ? (
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
                    {row.services ? (
                      <span className="block text-xs">{formatPrice(Number(row.services.price))}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.professionals?.name}</td>
                  <td className="px-3 py-2">
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus(row.id, e.target.value)}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABEL[s]}
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
