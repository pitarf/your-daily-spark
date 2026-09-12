import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";

import { addDaysInTimezone, formatDate, formatPrice, formatTime, todayInTimezone } from "@/lib/scheduling/format";
import type { EstablishmentSchedulingData } from "@/lib/scheduling/scheduling.functions";
import {
  createCustomDurationAppointment,
  getCustomDurationAvailability,
  type CreateCustomDurationResult,
} from "@/lib/scheduling/custom-duration.functions";

const DURATIONS = Array.from({ length: 16 }, (_, index) => (index + 1) * 15);

type Success = Extract<CreateCustomDurationResult, { ok: true }>["appointment"];

type Props = {
  data: EstablishmentSchedulingData;
  slug: string;
};

export function CustomDurationBookingPage({ data, slug }: Props) {
  const timezone = data.establishment.timezone || "America/Sao_Paulo";
  const fetchAvailability = useServerFn(getCustomDurationAvailability);
  const submitAppointment = useServerFn(createCustomDurationAppointment);

  const [serviceId, setServiceId] = useState(data.services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState(() => todayInTimezone(timezone));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [slot, setSlot] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const service = useMemo(
    () => data.services.find((item) => item.id === serviceId) ?? null,
    [data.services, serviceId],
  );

  const professionals = useMemo(
    () => data.professionals.filter((item) => !service || service.professionalIds.includes(item.id)),
    [data.professionals, service],
  );

  const dates = useMemo(
    () => Array.from({ length: 14 }, (_, index) => addDaysInTimezone(date, index === 0 ? 0 : index, timezone)),
    [date, timezone],
  );

  const availabilityQuery = useQuery({
    queryKey: ["custom-duration-availability", slug, serviceId, professionalId, date, durationMinutes],
    enabled: Boolean(serviceId) && !success,
    queryFn: () =>
      fetchAvailability({
        data: {
          slug,
          date,
          serviceId,
          professionalId: professionalId || null,
          durationMinutes,
        },
      }),
  });

  const booking = useMutation({
    mutationFn: () =>
      submitAppointment({
        data: {
          slug,
          date,
          serviceId,
          professionalId: professionalId || null,
          startsAt: slot!,
          durationMinutes,
          customerName,
          customerPhone,
          customerEmail: customerEmail || "",
        },
      }),
    onSuccess: async (result) => {
      if (result.ok) {
        setSuccess(result.appointment);
        setError(null);
        return;
      }
      setError(result.error);
      setSlot(null);
      await availabilityQuery.refetch();
    },
    onError: () => setError("Não foi possível concluir o agendamento agora. Tente novamente."),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slot) return;
    setError(null);
    booking.mutate();
  }

  function selectService(nextId: string) {
    setServiceId(nextId);
    setProfessionalId("");
    setSlot(null);
    setError(null);
  }

  if (success) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">✓</div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Agendamento confirmado</h1>
          <p className="mt-2 text-sm text-muted-foreground">Seu atendimento personalizado foi reservado.</p>
          <dl className="mt-6 space-y-2 text-left text-sm">
            <Summary label="Estabelecimento" value={data.establishment.name} />
            <Summary label="Serviço" value={success.serviceName} />
            <Summary label="Profissional" value={success.professionalName} />
            <Summary label="Data" value={formatDate(success.startsAt, timezone)} />
            <Summary label="Horário" value={`${formatTime(success.startsAt, timezone)} às ${formatTime(success.endsAt, timezone)}`} />
            <Summary label="Duração" value={formatDuration(success.durationMinutes)} />
            <Summary label="Valor" value={formatPrice(success.price)} />
          </dl>
          <button
            type="button"
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              setSuccess(null);
              setSlot(null);
              setError(null);
            }}
          >
            Novo agendamento
          </button>
        </section>
      </main>
    );
  }

  const slots = availabilityQuery.data ?? [];
  const selectedProfessionalName =
    professionals.find((item) => item.id === professionalId)?.name ?? "Qualquer profissional disponível";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Agendamento personalizado</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{data.establishment.name}</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Defina a duração do atendimento e escolha um horário que comporte o período inteiro.
        </p>
      </header>

      <section className="mt-8 space-y-8">
        <Fieldset title="1. Serviço">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.services.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === serviceId}
                onClick={() => selectService(item.id)}
                className={`rounded-xl border p-4 text-left transition ${item.id === serviceId ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
              >
                <span className="block font-medium text-foreground">{item.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatPrice(item.price)} · padrão {formatDuration(item.duration_minutes)}
                </span>
              </button>
            ))}
          </div>
        </Fieldset>

        {professionals.length > 1 ? (
          <Fieldset title="2. Profissional">
            <div className="flex flex-wrap gap-2">
              <Choice selected={!professionalId} onClick={() => { setProfessionalId(""); setSlot(null); }}>
                Qualquer profissional
              </Choice>
              {professionals.map((professional) => (
                <Choice
                  key={professional.id}
                  selected={professional.id === professionalId}
                  onClick={() => { setProfessionalId(professional.id); setSlot(null); }}
                >
                  {professional.name}
                </Choice>
              ))}
            </div>
          </Fieldset>
        ) : null}

        <Fieldset title={`${professionals.length > 1 ? 3 : 2}. Data`}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dates.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={day === date}
                onClick={() => { setDate(day); setSlot(null); }}
                className={`min-w-[92px] rounded-xl border px-3 py-2 text-sm ${day === date ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
              >
                {formatDate(`${day}T12:00:00Z`, timezone)}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">
            Outra data
            <input
              type="date"
              value={date}
              min={todayInTimezone(timezone)}
              onChange={(event) => { setDate(event.target.value); setSlot(null); }}
              className="ml-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
            />
          </label>
        </Fieldset>

        <Fieldset title={`${professionals.length > 1 ? 4 : 3}. Duração`}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {DURATIONS.map((duration) => (
              <button
                key={duration}
                type="button"
                aria-pressed={duration === durationMinutes}
                onClick={() => { setDurationMinutes(duration); setSlot(null); }}
                className={`rounded-md border px-2 py-2 text-xs font-medium ${duration === durationMinutes ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"}`}
              >
                {formatDuration(duration)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">15 minutos a 4 horas, em intervalos de 15 minutos.</p>
        </Fieldset>

        <Fieldset title={`${professionals.length > 1 ? 5 : 4}. Horário disponível`}>
          {availabilityQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Calculando disponibilidade...</p>
          ) : availabilityQuery.isError ? (
            <p className="text-sm text-destructive" role="alert">Não foi possível carregar os horários.</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário comporta {formatDuration(durationMinutes)} nesta data.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {slots.map((item) => (
                <button
                  key={item.startsAt}
                  type="button"
                  disabled={!item.available}
                  aria-pressed={slot === item.startsAt}
                  aria-label={`${item.label}: ${item.available ? "disponível" : "indisponível"}`}
                  onClick={() => setSlot(item.startsAt)}
                  className={`rounded-md border px-2 py-2 text-sm ${slot === item.startsAt ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-accent"} disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:line-through`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </Fieldset>

        {slot ? (
          <Fieldset title={`${professionals.length > 1 ? 6 : 5}. Confirmar`}>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Nome" value={customerName} onChange={setCustomerName} required />
                <Input label="Telefone/WhatsApp" value={customerPhone} onChange={setCustomerPhone} required />
                <Input label="E-mail (opcional)" type="email" value={customerEmail} onChange={setCustomerEmail} />
              </div>

              <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <p className="font-medium text-foreground">Resumo</p>
                <dl className="mt-2 space-y-1">
                  <Summary label="Serviço" value={service?.name ?? ""} />
                  <Summary label="Profissional" value={selectedProfessionalName} />
                  <Summary label="Data" value={formatDate(slot, timezone)} />
                  <Summary label="Horário" value={`${formatTime(slot, timezone)} às ${formatTime(new Date(new Date(slot).getTime() + durationMinutes * 60_000).toISOString(), timezone)}`} />
                  <Summary label="Duração" value={formatDuration(durationMinutes)} />
                </dl>
              </div>

              {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}

              <button type="submit" disabled={booking.isPending} className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60 sm:w-auto">
                {booking.isPending ? "Confirmando..." : "Confirmar agendamento"}
              </button>
            </form>
          </Fieldset>
        ) : null}
      </section>
    </main>
  );
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

function Fieldset({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>{children}</section>;
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
