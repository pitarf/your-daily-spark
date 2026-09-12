import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { dateKeyInTimezone, formatDate, formatTime, todayInTimezone } from "@/lib/scheduling/format";

type AppointmentRelation =
  | { name: string; phone: string | null }
  | { name: string; phone: string | null }[]
  | null;

type ServiceRelation =
  | { name: string; duration_minutes: number }
  | { name: string; duration_minutes: number }[]
  | null;

type ProfessionalAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  customer_id: string;
  service_id: string | null;
  custom_title: string | null;
  duration_minutes_override: number | null;
  customers: AppointmentRelation;
  services: ServiceRelation;
};

export function ProfessionalWorkspace() {
  const { membership } = useEstablishment();

  const query = useQuery({
    queryKey: ["professional-workspace", membership.establishmentId],
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error("Sessão expirada.");

      const { data: professional, error: professionalError } = await supabase
        .from("professionals")
        .select("id, name, description, photo_url, active")
        .eq("establishment_id", membership.establishmentId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (professionalError) throw professionalError;

      if (!professional) {
        return {
          professional: null,
          appointments: [] as ProfessionalAppointment[],
        };
      }

      const now = new Date();
      const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const { data: appointments, error: appointmentsError } = await supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, notes, customer_id, service_id, custom_title, duration_minutes_override, customers(name, phone), services(name, duration_minutes)",
        )
        .eq("establishment_id", membership.establishmentId)
        .eq("professional_id", professional.id)
        .gte("starts_at", now.toISOString())
        .lt("starts_at", horizon.toISOString())
        .order("starts_at", { ascending: true });
      if (appointmentsError) throw appointmentsError;

      return {
        professional,
        appointments: (appointments ?? []) as ProfessionalAppointment[],
      };
    },
  });

  if (query.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando sua agenda…</p>;
  }

  if (query.isError) {
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        Não foi possível carregar sua agenda.
      </p>
    );
  }

  if (!query.data.professional) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-card p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">
          Acesso profissional ainda não está vinculado
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Peça ao administrador para vincular sua conta ao cadastro do seu perfil profissional.
        </p>
      </section>
    );
  }

  const professional = query.data.professional;
  const appointments = query.data.appointments;
  const timezone = membership.timezone || "America/Sao_Paulo";
  const today = todayInTimezone(timezone);
  const todayAppointments = appointments.filter(
    (item) => dateKeyInTimezone(item.starts_at, timezone) === today,
  );
  const upcoming = appointments.filter(
    (item) => dateKeyInTimezone(item.starts_at, timezone) !== today,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-muted text-lg font-bold text-foreground">
            {professional.photo_url ? (
              <img src={professional.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              professional.name.slice(0, 1)
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Minha agenda
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">
              Olá, {professional.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Você está visualizando somente os seus atendimentos.
            </p>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Hoje</h2>
            <p className="text-sm text-muted-foreground">
              {formatDate(`${today}T12:00:00Z`, timezone)}
            </p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-foreground">
            {todayAppointments.length} atendimento
            {todayAppointments.length === 1 ? "" : "s"}
          </span>
        </div>
        {todayAppointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum atendimento para hoje.
          </div>
        ) : (
          <div className="space-y-2">
            {todayAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">Próximos 14 dias</h2>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum atendimento futuro.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                timezone={timezone}
                showDate
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({
  appointment,
  timezone,
  showDate = false,
}: {
  appointment: ProfessionalAppointment;
  timezone: string;
  showDate?: boolean;
}) {
  const customer = Array.isArray(appointment.customers)
    ? appointment.customers[0]
    : appointment.customers;
  const service = Array.isArray(appointment.services)
    ? appointment.services[0]
    : appointment.services;
  const statusLabel: Record<string, string> = {
    pending: "Pendente",
    confirmed: "Confirmado",
    completed: "Concluído",
    cancelled: "Cancelado",
    no_show: "Não compareceu",
  };

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-[100px]">
          {showDate ? (
            <p className="text-xs text-muted-foreground">
              {formatDate(appointment.starts_at, timezone)}
            </p>
          ) : null}
          <p className="mt-0.5 text-lg font-bold text-foreground">
            {formatTime(appointment.starts_at, timezone)}
          </p>
          <p className="text-xs text-muted-foreground">
            até {formatTime(appointment.ends_at, timezone)}
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{customer?.name ?? "Cliente"}</p>
          <p className="text-sm text-muted-foreground">{appointment.custom_title?.trim() || service?.name || "Atendimento avulso"}</p>
          {appointment.duration_minutes_override ? (
            <p className="text-xs text-muted-foreground">{appointment.duration_minutes_override} min</p>
          ) : null}
          {customer?.phone ? (
            <p className="mt-1 text-xs text-muted-foreground">{customer.phone}</p>
          ) : null}
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
          {statusLabel[appointment.status] ?? appointment.status}
        </span>
      </div>
    </article>
  );
}
