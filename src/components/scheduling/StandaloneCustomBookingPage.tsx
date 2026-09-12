import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";

import { addDaysInTimezone, formatDate, formatTime, todayInTimezone } from "@/lib/scheduling/format";
import type { EstablishmentSchedulingData } from "@/lib/scheduling/scheduling.functions";
import {
  createStandaloneCustomAppointment,
  getStandaloneCustomAvailability,
  type CreateStandaloneCustomResult,
} from "@/lib/scheduling/standalone-custom-booking.functions";

type Props = { data: EstablishmentSchedulingData; slug: string };
type Success = Extract<CreateStandaloneCustomResult, { ok: true }>["appointment"];
const DURATIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);

export function StandaloneCustomBookingPage({ data, slug }: Props) {
  const timezone = data.establishment.timezone || "America/Sao_Paulo";
  const fetchAvailability = useServerFn(getStandaloneCustomAvailability);
  const submitBooking = useServerFn(createStandaloneCustomAppointment);

  const [date, setDate] = useState(() => todayInTimezone(timezone));
  const [professionalId, setProfessionalId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [slot, setSlot] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const professionals = data.professionals;
  const dates = useMemo(() => {
    const today = todayInTimezone(timezone);
    return Array.from({ length: 14 }, (_, index) => addDaysInTimezone(today, index, timezone));
  }, [timezone]);

  const availabilityQuery = useQuery({
    queryKey: ["standalone-custom-availability", slug, professionalId, date, durationMinutes],
    enabled: !success,
    queryFn: () => fetchAvailability({
      data: {
        slug,
        date,
        durationMinutes,
        professionalId: professionalId || null,
      },
    }),
  });

  const booking = useMutation({
    mutationFn: () => submitBooking({
      data: {
        slug,
        date,
        durationMinutes,
        professionalId: professionalId || null,
        startsAt: slot!,
        title,
        customerName,
        customerPhone,
        customerEmail,
        notes,
      },
    }),
    onSuccess: async (result) => {
      if (result.ok) {
        setSuccess(result.appointment);
        setError(null);
      } else {
        setError(result.error);
        setSlot(null);
        await availabilityQuery.refetch();
      }
    },
    onError: () => setError("Não foi possível concluir o agendamento agora."),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;
    setError(null);
    booking.mutate();
  }

  if (success) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">✓</div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Agendamento solicitado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Seu horário foi reservado no sistema.</p>
          <dl className="mt-6 space-y-2 text-left text-sm">
            <Summary label="Atendimento" value={success.title} />
            <Summary label="Profissional" value={success.professionalName} />
            <Summary label="Data" value={formatDate(success.startsAt, timezone)} />
            <Summary label="Horário" value={`${formatTime(success.startsAt, timezone)} às ${formatTime(success.endsAt, timezone)}`} />
            <Summary label="Duração" value={formatDuration(success.durationMinutes)} />
          </dl>
          <button
            type="button"
            onClick={() => {
              setSuccess(null);
              setSlot(null);
              setTitle("");
              setNotes("");
            }}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Novo agendamento
          </button>
        </section>
      </main>
    );
  }

  const slots = availabilityQuery.data ?? [];
  const selectedProfessional = professionals.find((item) => item.id === professionalId)?.name ?? "Qualquer profissional disponível";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Agendamento avulso</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{data.establishment.name}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">Não encontrou o serviço que precisa? Descreva o atendimento e reserve um período disponível.</p>
      </header>

      <section className="mt-8 space-y-8">
        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">1. O que você precisa?</h2>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} maxLength={120} placeholder="Ex.: atendimento personalizado, consultoria, sessão..." className="w-full rounded-md border border-input bg-background px-3 py-2" />
        </section>

        {professionals.length > 1 ? (
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">2. Profissional</h2>
            <div className="flex flex-wrap gap-2">
              <Choice selected={!professionalId} onClick={() => { setProfessionalId(""); setSlot(null); }}>Qualquer profissional</Choice>
              {professionals.map((professional) => <Choice key={professional.id} selected={professionalId === professional.id} onClick={() => { setProfessionalId(professional.id); setSlot(null); }}>{professional.name}</Choice>)}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">{professionals.length > 1 ? 3 : 2}. Data</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dates.map((day) => (
              <button key={day} type="button" aria-pressed={day === date} onClick={() => { setDate(day); setSlot(null); }} className={`min-w-[92px] rounded-xl border px-3 py-2 text-sm ${day === date ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                {formatDate(`${day}T12:00:00Z`, timezone)}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">
            Outra data
            <input type="date" value={date} min={todayInTimezone(timezone)} onChange={(event) => { setDate(event.target.value); setSlot(null); }} className="ml-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">{professionals.length > 1 ? 4 : 3}. Duração</h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {DURATIONS.map((duration) => <button key={duration} type="button" aria-pressed={duration === durationMinutes} onClick={() => { setDurationMinutes(duration); setSlot(null); }} className={`rounded-md border px-2 py-2 text-xs font-medium ${duration === durationMinutes ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}>{formatDuration(duration)}</button>)}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-base font-semibold text-foreground">{professionals.length > 1 ? 5 : 4}. Horário</h2>
          {availabilityQuery.isPending ? <p className="text-sm text-muted-foreground">Calculando disponibilidade...</p> : availabilityQuery.isError ? <p className="text-sm text-destructive">Não foi possível carregar os horários.</p> : slots.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum horário comporta {formatDuration(durationMinutes)} nesta data.</p> : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {slots.map((item) => <button key={item.startsAt} type="button" disabled={!item.available} aria-pressed={slot === item.startsAt} onClick={() => setSlot(item.startsAt)} className={`rounded-md border px-2 py-2 text-sm ${slot === item.startsAt ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"} disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:line-through`}>{item.label}</button>)}
            </div>
          )}
        </section>

        {slot ? (
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">{professionals.length > 1 ? 6 : 5}. Seus dados</h2>
            <form className="space-y-4" onSubmit={submit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Nome" value={customerName} onChange={setCustomerName} required />
                <Input label="Telefone/WhatsApp" value={customerPhone} onChange={setCustomerPhone} required />
                <Input label="E-mail (opcional)" value={customerEmail} onChange={setCustomerEmail} type="email" />
              </div>
              <label className="block space-y-1 text-sm"><span className="font-medium text-foreground">Observações (opcional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">Resumo</p>
                <dl className="mt-2 space-y-1">
                  <Summary label="Atendimento" value={title} />
                  <Summary label="Profissional" value={selectedProfessional} />
                  <Summary label="Data" value={formatDate(slot, timezone)} />
                  <Summary label="Horário" value={`${formatTime(slot, timezone)} às ${formatTime(new Date(new Date(slot).getTime() + durationMinutes * 60_000).toISOString(), timezone)}`} />
                  <Summary label="Duração" value={formatDuration(durationMinutes)} />
                </dl>
              </div>
              {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
              <button type="submit" disabled={booking.isPending || title.trim().length < 2} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:w-auto">{booking.isPending ? "Confirmando..." : "Confirmar agendamento"}</button>
            </form>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`rounded-full border px-3 py-2 text-sm ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>{children}</button>;
}

function Input({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return <label className="space-y-1 text-sm"><span className="font-medium text-foreground">{label}{required ? "*" : ""}</span><input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}
