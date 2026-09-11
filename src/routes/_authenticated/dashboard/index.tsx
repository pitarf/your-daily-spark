import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { getAvailability } from "@/lib/scheduling/scheduling.functions";
import { dayRangeUtc, formatDateTime, formatTime, todayInTimezone } from "@/lib/scheduling/format";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  customers: { name: string } | null;
  services: { name: string; duration_minutes: number } | null;
  professionals: { name: string } | null;
};

const SELECT =
  "id, starts_at, ends_at, status, customers(name), services(name, duration_minutes), professionals(name)";

function DashboardHome() {
  const { membership } = useEstablishment();
  const tz = membership.timezone;
  const today = todayInTimezone(tz);
  const range = dayRangeUtc(today, tz);
  const fetchAvailability = useServerFn(getAvailability);

  const todayQuery = useQuery({
    queryKey: ["dash-today", membership.establishmentId, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(SELECT)
        .eq("establishment_id", membership.establishmentId)
        .gte("starts_at", range.start)
        .lt("starts_at", range.end)
        .order("starts_at");
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const upcomingQuery = useQuery({
    queryKey: ["dash-upcoming", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(SELECT)
        .eq("establishment_id", membership.establishmentId)
        .gte("starts_at", range.end)
        .in("status", ["pending", "confirmed"])
        .order("starts_at")
        .limit(8);
      if (error) throw error;
      return (data ?? []) as unknown as AppointmentRow[];
    },
  });

  const slotsQuery = useQuery({
    queryKey: ["dash-slots", membership.establishmentId, today],
    queryFn: async () => {
      const { data: service } = await supabase
        .from("services")
        .select("id")
        .eq("establishment_id", membership.establishmentId)
        .eq("active", true)
        .order("duration_minutes")
        .limit(1)
        .maybeSingle();
      if (!service) return { free: 0, busy: 0 };
      const slots = await fetchAvailability({
        data: { slug: membership.slug, date: today, serviceId: service.id, professionalId: null },
      });
      return {
        free: slots.filter((s) => s.available).length,
        busy: slots.filter((s) => !s.available).length,
      };
    },
  });

  const todayAppointments = todayQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Visão geral</h1>
        <p className="text-sm text-muted-foreground">
          {membership.name} · hoje, {new Date().toLocaleDateString("pt-BR", { timeZone: tz })}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Agendamentos de hoje" value={todayQuery.isPending ? "…" : String(todayAppointments.length)} />
        <Stat
          label="Horários livres hoje"
          value={slotsQuery.isPending ? "…" : String(slotsQuery.data?.free ?? 0)}
        />
        <Stat
          label="Horários ocupados hoje"
          value={slotsQuery.isPending ? "…" : String(slotsQuery.data?.busy ?? 0)}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Agenda de hoje</h2>
        {todayQuery.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
        ) : todayAppointments.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhum agendamento para hoje.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {todayAppointments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="w-24 font-medium text-foreground">
                  {formatTime(a.starts_at, tz)}–{formatTime(a.ends_at, tz)}
                </span>
                <span className="text-foreground">{a.customers?.name ?? "Cliente"}</span>
                <span className="text-muted-foreground">
                  {a.services?.name} · {a.professionals?.name}
                </span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {a.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Próximos agendamentos</h2>
        {upcomingQuery.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando…</p>
        ) : (upcomingQuery.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nada agendado para os próximos dias.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {(upcomingQuery.data ?? []).map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="font-medium text-foreground">{formatDateTime(a.starts_at, tz)}</span>
                <span className="text-foreground">{a.customers?.name ?? "Cliente"}</span>
                <span className="text-muted-foreground">
                  {a.services?.name} · {a.professionals?.name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
