import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { calendarDataUrl } from "@/lib/calendar/ics";
import {
  cancelManagedAppointment,
  getManagedAppointment,
  getManagedRescheduleAvailability,
  rescheduleManagedAppointment,
} from "@/lib/scheduling/appointment-management.functions";
import { addDaysInTimezone, formatDate, formatPrice, formatTime, todayInTimezone } from "@/lib/scheduling/format";

type Props = {
  appointmentId: string;
  token: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export function ManagedAppointmentPage({ appointmentId, token }: Props) {
  const fetchAppointment = useServerFn(getManagedAppointment);
  const cancelAppointment = useServerFn(cancelManagedAppointment);
  const fetchRescheduleAvailability = useServerFn(getManagedRescheduleAvailability);
  const rescheduleAppointment = useServerFn(rescheduleManagedAppointment);

  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const appointmentQuery = useQuery({
    queryKey: ["managed-appointment", appointmentId, token],
    queryFn: () => fetchAppointment({ data: { appointmentId, token } }),
  });

  const appointment = appointmentQuery.data;
  const initialDate = useMemo(() => {
    if (!appointment) return todayInTimezone("America/Sao_Paulo");
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: appointment.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(appointment.startsAt));
  }, [appointment]);

  const rescheduleDate = selectedDate ?? initialDate;

  const rescheduleAvailabilityQuery = useQuery({
    queryKey: ["managed-reschedule-availability", appointmentId, token, rescheduleDate],
    enabled: Boolean(appointment?.canReschedule && rescheduleOpen && rescheduleDate),
    queryFn: () => fetchRescheduleAvailability({ data: { appointmentId, token, date: rescheduleDate } }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelAppointment({ data: { appointmentId, token } }),
    onSuccess: () => {
      setCancelError(null);
      void appointmentQuery.refetch();
    },
    onError: (error) => {
      setCancelError(error instanceof Error ? error.message : "Não foi possível cancelar o agendamento.");
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: () => rescheduleAppointment({ data: { appointmentId, token, startsAt: selectedSlot! } }),
    onSuccess: async () => {
      setRescheduleError(null);
      setRescheduleOpen(false);
      setSelectedSlot(null);
      await appointmentQuery.refetch();
    },
    onError: (error) => {
      setRescheduleError(error instanceof Error ? error.message : "Não foi possível reagendar o atendimento.");
      setSelectedSlot(null);
      void rescheduleAvailabilityQuery.refetch();
    },
  });

  if (appointmentQuery.isPending) {
    return <main className="mx-auto max-w-xl px-4 py-12 text-center text-sm text-muted-foreground">Carregando seu agendamento…</main>;
  }

  if (appointmentQuery.isError || !appointment) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12">
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Agendamento não encontrado</h1>
          <p className="mt-2 text-sm text-muted-foreground">O link pode ter expirado ou não é válido para este estabelecimento.</p>
        </section>
      </main>
    );
  }

  const title = appointment.customTitle?.trim() || appointment.serviceName || "Atendimento";
  const price = appointment.customPrice ?? appointment.servicePrice;
  const calendarUrl = calendarDataUrl({
    title: `${title} · ${appointment.establishmentName}`,
    start: appointment.startsAt,
    end: appointment.endsAt,
    description: `Agendamento com ${appointment.professionalName}. Duração: ${appointment.durationMinutes} minutos.`,
  });
  const rescheduleDates = Array.from({ length: 14 }, (_, index) => addDaysInTimezone(todayInTimezone(appointment.timezone), index, appointment.timezone));
  const availableSlots = rescheduleAvailabilityQuery.data ?? [];

  return (
    <main className="mx-auto max-w-xl px-4 py-10 sm:py-12">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Meu agendamento</p>
            <h1 className="mt-1 text-xl font-bold text-foreground">{title}</h1>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">{STATUS_LABEL[appointment.status] ?? appointment.status}</span>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{appointment.establishmentName}</p>

        <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
          <Row label="Cliente" value={appointment.customerName} />
          <Row label="Profissional" value={appointment.professionalName} />
          <Row label="Data" value={formatDate(appointment.startsAt, appointment.timezone)} />
          <Row label="Horário" value={`${formatTime(appointment.startsAt, appointment.timezone)} às ${formatTime(appointment.endsAt, appointment.timezone)}`} />
          <Row label="Duração" value={formatDuration(appointment.durationMinutes)} />
          {price !== null && price !== undefined ? <Row label="Valor" value={formatPrice(price)} /> : null}
        </dl>

        {cancelError ? <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{cancelError}</p> : null}
        {rescheduleError ? <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{rescheduleError}</p> : null}

        {rescheduleOpen && appointment.canReschedule ? (
          <div className="mt-6 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Escolha um novo horário</h2>
                <p className="text-xs text-muted-foreground">O mesmo profissional e a mesma duração serão mantidos.</p>
              </div>
              <button type="button" onClick={() => { setRescheduleOpen(false); setSelectedSlot(null); setRescheduleError(null); }} className="text-xs font-medium underline">Fechar</button>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {rescheduleDates.map((day) => (
                <button key={day} type="button" aria-pressed={day === rescheduleDate} onClick={() => { setSelectedDate(day); setSelectedSlot(null); setRescheduleError(null); }} className={`min-w-[90px] rounded-lg border px-3 py-2 text-sm ${day === rescheduleDate ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                  {formatDate(`${day}T12:00:00Z`, appointment.timezone)}
                </button>
              ))}
            </div>

            <label className="mt-3 block text-xs text-muted-foreground">
              Outra data
              <input type="date" min={todayInTimezone(appointment.timezone)} value={rescheduleDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedSlot(null); setRescheduleError(null); }} className="ml-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
            </label>

            <div className="mt-4">
              {rescheduleAvailabilityQuery.isPending ? <p className="text-sm text-muted-foreground">Calculando horários…</p> : rescheduleAvailabilityQuery.isError ? <p className="text-sm text-destructive">Não foi possível carregar os horários.</p> : availableSlots.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum horário disponível para {formatDuration(appointment.durationMinutes)} nesta data.</p> : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {availableSlots.map((slot) => <button key={slot.startsAt} type="button" disabled={!slot.available} aria-pressed={selectedSlot === slot.startsAt} onClick={() => setSelectedSlot(slot.startsAt)} className={`rounded-md border px-2 py-2 text-sm ${selectedSlot === slot.startsAt ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"} disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:line-through`}>{slot.label}</button>)}
                </div>
              )}
            </div>

            <button type="button" disabled={!selectedSlot || rescheduleMutation.isPending} onClick={() => { setRescheduleError(null); rescheduleMutation.mutate(); }} className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {rescheduleMutation.isPending ? "Reagendando…" : "Confirmar novo horário"}
            </button>
          </div>
        ) : null}

        {appointment.canCancel || appointment.canReschedule ? (
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a href={calendarUrl} download="meu-agendamento.ics" className="rounded-md border border-input px-4 py-2 text-center text-sm font-medium text-foreground hover:bg-accent">Adicionar ao calendário</a>
            {appointment.canReschedule ? <button type="button" onClick={() => { setRescheduleOpen((value) => !value); setSelectedDate(initialDate); setSelectedSlot(null); setRescheduleError(null); }} className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">{rescheduleOpen ? "Fechar reagendamento" : "Reagendar"}</button> : null}
            {appointment.canCancel ? (
              <button type="button" disabled={cancelMutation.isPending} onClick={() => { if (!window.confirm("Tem certeza que deseja cancelar este agendamento?")) return; setCancelError(null); cancelMutation.mutate(); }} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60">
                {cancelMutation.isPending ? "Cancelando…" : "Cancelar agendamento"}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-2">
            <a href={calendarUrl} download="meu-agendamento.ics" className="inline-flex rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Adicionar ao calendário</a>
            <p className="text-xs text-muted-foreground">Este agendamento não pode mais ser alterado pelo link público.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}
