import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  createCustomDurationAppointment,
  getCustomDurationAvailability,
  type CreateCustomDurationResult,
} from "@/lib/scheduling/custom-duration.functions";
import { formatDate, formatPrice, formatTime } from "@/lib/scheduling/format";
import type { EstablishmentSchedulingData } from "@/lib/scheduling/scheduling.functions";

type Props = {
  data: EstablishmentSchedulingData;
  slug: string;
};

export function CustomDurationBookingPage({ data, slug }: Props) {
  const fetchAvailability = useServerFn(getCustomDurationAvailability);
  const createAppointment = useServerFn(createCustomDurationAppointment);
  const [serviceId, setServiceId] = useState(data.services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(getToday(data.establishment.timezone));
  const [durationMinutes, setDurationMinutes] = useState(data.services[0]?.duration_minutes ?? 30);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateCustomDurationResult | null>(null);

  const service = data.services.find((item) => item.id === serviceId);
  const professionals = service
    ? data.professionals.filter((professional) => service.professionalIds.includes(professional.id))
    : [];

  const availabilityQuery = useQuery({
    queryKey: ["custom-duration-availability", slug, date, serviceId, durationMinutes, professionalId],
    enabled: Boolean(serviceId && date && durationMinutes),
    queryFn: () =>
      fetchAvailability({
        data: {
          slug,
          date,
          serviceId,
          durationMinutes,
          professionalId: professionalId || null,
        },
      }),
  });

  const availableSlots = (availabilityQuery.data ?? []).filter(
    (slot) => slot.available && isFuture(slot.startsAt),
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!selectedSlot) throw new Error("Escolha um horário.");
      return createAppointment({
        data: {
          slug,
          date,
          serviceId,
          durationMinutes,
          professionalId: professionalId || null,
          startsAt: selectedSlot,
          customerName,
          customerPhone,
          customerEmail,
        },
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setError(result.error);
        setSelectedSlot("");
        void availabilityQuery.refetch();
        return;
      }
      setError(null);
      setSuccess(result);
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  if (success?.ok) {
    return (
      <main className="min-h-screen bg-muted/30 px-4 py-10">
        <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Agendamento realizado</p>
          <h1 className="mt-2 text-2xl font-bold text-foreground">Seu horário está reservado</h1>
          <div className="mt-6 space-y-3 rounded-xl bg-muted/40 p-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Estabelecimento</span><strong>{data.establishment.name}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Serviço</span><strong>{success.appointment.serviceName}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Profissional</span><strong>{success.appointment.professionalName}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Data</span><strong>{formatDate(success.appointment.startsAt, data.establishment.timezone)}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Horário</span><strong>{formatTime(success.appointment.startsAt, data.establishment.timezone)}–{formatTime(success.appointment.endsAt, data.establishment.timezone)}</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Duração</span><strong>{success.appointment.durationMinutes} minutos</strong></div>
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Valor</span><strong>{formatPrice(success.appointment.price)}</strong></div>
          </div>
          <a href={`/agenda/${slug}`} className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Voltar para a agenda</a>
        </section>
      </main>
    );
  }

  if (!data.services.length) {
    return <EmptyState message="Este estabelecimento ainda não cadastrou serviços." />;
  }

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-10">
      <section className="mx-auto max-w-3xl">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <a href={`/agenda/${slug}`} className="text-xs font-medium text-muted-foreground underline">Voltar para agenda</a>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Agendamento personalizado</p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">Escolha quanto tempo você precisa</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">A duração deve caber no expediente, nos intervalos e na agenda do profissional.</p>
            </div>
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-right text-xs text-muted-foreground">
              <span className="block">Estabelecimento</span>
              <strong className="text-sm text-foreground">{data.establishment.name}</strong>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <Field label="Serviço">
              <select value={serviceId} onChange={(event) => { const next = event.target.value; setServiceId(next); setProfessionalId(""); setSelectedSlot(""); const nextService = data.services.find((item) => item.id === next); if (nextService) setDurationMinutes(nextService.duration_minutes); }} className={inputClass}>
                {data.services.map((item) => <option key={item.id} value={item.id}>{item.name} · padrão {item.duration_minutes} min</option>)}
              </select>
            </Field>

            <Field label="Profissional">
              <select value={professionalId} onChange={(event) => { setProfessionalId(event.target.value); setSelectedSlot(""); }} className={inputClass}>
                <option value="">Qualquer profissional</option>
                {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
              </select>
            </Field>

            <Field label="Data">
              <input type="date" min={getToday(data.establishment.timezone)} value={date} onChange={(event) => { setDate(event.target.value); setSelectedSlot(""); }} className={inputClass} />
            </Field>

            <Field label="Duração desejada">
              <select value={durationMinutes} onChange={(event) => { setDurationMinutes(Number(event.target.value)); setSelectedSlot(""); }} className={inputClass}>
                {Array.from({ length: 16 }, (_, index) => (index + 1) * 15).map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos{service?.duration_minutes === minutes ? " · padrão" : ""}</option>)}
              </select>
            </Field>
          </div>

          <div className="mt-6 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Horários disponíveis</h2>
                <p className="mt-1 text-xs text-muted-foreground">Somente horários em que o período completo cabe na agenda aparecem aqui.</p>
              </div>
              <span className="text-xs text-muted-foreground">{durationMinutes} min</span>
            </div>

            {availabilityQuery.isPending ? <p className="mt-4 text-sm text-muted-foreground">Calculando disponibilidade…</p> : null}
            {availabilityQuery.isError ? <p className="mt-4 text-sm text-destructive">Não foi possível calcular os horários agora.</p> : null}
            {!availabilityQuery.isPending && !availabilityQuery.isError && availableSlots.length === 0 ? <p className="mt-4 rounded-lg bg-muted/40 p-4 text-sm text-muted-foreground">Nenhum horário disponível para esta combinação de data, profissional e duração.</p> : null}
            {availableSlots.length > 0 ? <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{availableSlots.map((slot) => <button key={slot.startsAt} type="button" onClick={() => setSelectedSlot(slot.startsAt)} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${selectedSlot === slot.startsAt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:bg-accent"}`}>{slot.label}</button>)}</div> : null}
          </div>

          <div className="mt-6 rounded-xl border border-border p-4">
            <h2 className="text-sm font-semibold text-foreground">Seus dados</h2>
            <p className="mt-1 text-xs text-muted-foreground">Usaremos estes dados para identificar seu agendamento.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nome"><input required minLength={2} value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClass} /></Field>
              <Field label="Telefone / WhatsApp"><input required minLength={8} value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className={inputClass} /></Field>
              <Field label="E-mail (opcional)" className="sm:col-span-2"><input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className={inputClass} /></Field>
            </div>
          </div>

          {selectedSlot ? <div className="mt-6 rounded-xl bg-muted/40 p-4 text-sm"><p className="font-semibold text-foreground">Confira antes de confirmar</p><p className="mt-1 text-muted-foreground">{service?.name} · {durationMinutes} min · {professionalId ? professionals.find((item) => item.id === professionalId)?.name : "Qualquer profissional"}</p><p className="text-muted-foreground">{formatDate(selectedSlot, data.establishment.timezone)} · {formatTime(selectedSlot, data.establishment.timezone)}</p><p className="mt-1 font-semibold text-foreground">{service ? formatPrice(service.price) : ""}</p></div> : null}

          {error ? <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
          <button type="button" disabled={!selectedSlot || customerName.trim().length < 2 || customerPhone.trim().length < 8 || mutation.isPending} onClick={() => { setError(null); mutation.mutate(); }} className="mt-6 w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
            {mutation.isPending ? "Confirmando…" : "Confirmar agendamento personalizado"}
          </button>
        </div>
      </section>
    </main>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block space-y-1 ${className}`}><span className="text-sm font-medium text-foreground">{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";

function getToday(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function isFuture(iso: string) {
  return new Date(iso).getTime() > Date.now();
}

function EmptyState({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4"><section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">{message}</section></main>;
}
