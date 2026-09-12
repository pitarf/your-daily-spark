import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { notificationStatusLabel, notificationTypeLabel } from "@/lib/notifications";
import { getAvailability } from "@/lib/scheduling/scheduling.functions";
import { dayRangeUtc, formatDate, formatDateTime, formatTime, todayInTimezone } from "@/lib/scheduling/format";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  custom_title: string | null;
  customers: { name: string } | null;
  services: { name: string; duration_minutes: number } | null;
  professionals: { name: string } | null;
};

type NotificationRow = {
  id: string;
  type: string;
  status: string;
  scheduled_at: string;
  created_at: string;
};

const SELECT =
  "id, starts_at, ends_at, status, custom_title, customers(name), services(name, duration_minutes), professionals(name)";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

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

  const notificationsQuery = useQuery({
    queryKey: ["dash-notifications", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, status, scheduled_at, created_at")
        .eq("establishment_id", membership.establishmentId)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as unknown as NotificationRow[];
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
  const activeToday = todayAppointments.filter((item) => item.status !== "cancelled");
  const confirmedToday = todayAppointments.filter((item) => item.status === "confirmed");
  const pendingToday = todayAppointments.filter((item) => item.status === "pending");
  const recentNotifications = notificationsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Painel</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Visão geral</h1>
          <p className="text-sm text-muted-foreground">
            {membership.name} · {formatDate(`${today}T12:00:00Z`, tz)}
          </p>
        </div>
        <Link
          to="/dashboard/appointments"
          className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Abrir agenda
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Atendimentos hoje" value={todayQuery.isPending ? "…" : String(activeToday.length)} detail={`${confirmedToday.length} confirmados`} />
        <Stat label="Pendentes" value={todayQuery.isPending ? "…" : String(pendingToday.length)} detail="Precisam de atenção" />
        <Stat label="Horários livres" value={slotsQuery.isPending ? "…" : String(slotsQuery.data?.free ?? 0)} detail="Para o serviço mais curto" />
        <Stat label="Horários ocupados" value={slotsQuery.isPending ? "…" : String(slotsQuery.data?.busy ?? 0)} detail="Inclui indisponibilidades" />
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <QuickLink to="/dashboard/appointments" title="Gerenciar agenda" description="Dia, semana, mês e bloqueios" />
        <QuickLink to="/dashboard/services" title="Serviços" description="Duração, preço e disponibilidade" />
        <QuickLink to="/dashboard/professionals" title="Profissionais" description="Equipe e horários individuais" />
        <QuickLink to="/dashboard/customers" title="Clientes" description="Cadastros e histórico" />
        <QuickLink to="/dashboard/plans" title="Planos" description="Regras e serviços permitidos" />
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Agenda de hoje</h2>
            <p className="text-xs text-muted-foreground">Atendimentos organizados por horário.</p>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-foreground">
            {activeToday.length} ativo{activeToday.length === 1 ? "" : "s"}
          </span>
        </div>
        {todayQuery.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : todayQuery.isError ? (
          <p className="mt-4 text-sm text-destructive">Não foi possível carregar a agenda de hoje.</p>
        ) : activeToday.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            Nenhum atendimento ativo para hoje.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {activeToday.map((appointment) => (
              <li key={appointment.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="min-w-[92px] font-semibold text-foreground">
                  {formatTime(appointment.starts_at, tz)}–{formatTime(appointment.ends_at, tz)}
                </span>
                <span className="font-medium text-foreground">{appointment.customers?.name ?? "Cliente"}</span>
                <span className="text-muted-foreground">
                  {appointment.custom_title?.trim() || appointment.services?.name || "Atendimento avulso"} · {appointment.professionals?.name ?? "Profissional"}
                </span>
                <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  {STATUS_LABEL[appointment.status] ?? appointment.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Próximos agendamentos</h2>
            <p className="text-xs text-muted-foreground">Os próximos atendimentos confirmados ou pendentes.</p>
          </div>
          <Link to="/dashboard/appointments" className="text-xs font-medium underline">Ver agenda</Link>
        </div>
        {upcomingQuery.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : upcomingQuery.isError ? (
          <p className="mt-4 text-sm text-destructive">Não foi possível carregar os próximos atendimentos.</p>
        ) : (upcomingQuery.data ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nada agendado para os próximos dias.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {(upcomingQuery.data ?? []).map((appointment) => (
              <li key={appointment.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="font-semibold text-foreground">{formatDateTime(appointment.starts_at, tz)}</div>
                <div className="mt-1 text-foreground">{appointment.customers?.name ?? "Cliente"}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {appointment.custom_title?.trim() || appointment.services?.name || "Atendimento avulso"} · {appointment.professionals?.name ?? "Profissional"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Atividade recente</h2>
            <p className="text-xs text-muted-foreground">Eventos gerados pelo sistema de agendamento.</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
            {recentNotifications.length} evento{recentNotifications.length === 1 ? "" : "s"}
          </span>
        </div>
        {notificationsQuery.isPending ? (
          <p className="mt-4 text-sm text-muted-foreground">Carregando…</p>
        ) : notificationsQuery.isError ? (
          <p className="mt-4 text-sm text-destructive">Não foi possível carregar a atividade recente.</p>
        ) : recentNotifications.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {recentNotifications.map((notification) => (
              <li key={notification.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden="true">
                  {notification.type === "cancellation" ? "×" : notification.type === "reminder" ? "⏱" : "✓"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{notificationTypeLabel(notification.type)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(notification.created_at, tz)}</p>
                </div>
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
                  {notificationStatusLabel(notification.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function QuickLink({
  to,
  title,
  description,
}: {
  to:
    | "/dashboard/appointments"
    | "/dashboard/services"
    | "/dashboard/professionals"
    | "/dashboard/customers"
    | "/dashboard/plans";
  title: string;
  description: string;
}) {
  return (
    <Link to={to} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
