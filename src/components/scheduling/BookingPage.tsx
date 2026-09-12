import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect, type ReactNode } from "react";

import { AppointmentManagementButton } from "@/components/scheduling/AppointmentManagementButton";
import { calendarDataUrl } from "@/lib/calendar/ics";
import {
  createAppointment,
  getAvailability,
  type CreateAppointmentResult,
} from "@/lib/scheduling/scheduling.functions";
import { addDaysInTimezone, formatDate, formatPrice, formatTime, todayInTimezone } from "@/lib/scheduling/format";

type EstablishmentSchedulingData = {
  establishment: {
    name: string;
    description: string | null;
    timezone: string;
    slug: string;
  };
  professionals: Array<{
    id: string;
    name: string;
    photo_url: string | null;
  }>;
  services: Array<{
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number;
    professionalIds: string[];
  }>;
};

type Success = Extract<CreateAppointmentResult, { ok: true }>["appointment"];

export function BookingPage({
  data,
  slug,
  initialServiceId,
  initialProfessionalId,
  initialDate,
  initialSlotLabel,
}: {
  data: EstablishmentSchedulingData;
  slug: string;
  initialServiceId?: string;
  initialProfessionalId?: string;
  initialDate?: string;
  initialSlotLabel?: string;
}) {
  const fetchAvailability = useServerFn(getAvailability);
  const submitAppointment = useServerFn(createAppointment);
  const timezone = data.establishment.timezone || "America/Sao_Paulo";
  const firstServiceId = data.services[0]?.id ?? "";
  const initialService = data.services.find((item) => item.id === initialServiceId);

  const [serviceId, setServiceId] = useState(
    initialService ? initialService.id : firstServiceId,
  );
  const [professionalId, setProfessionalId] = useState(() => {
    if (!initialProfessionalId) return "";
    if (initialService?.professionalIds.includes(initialProfessionalId)) return initialProfessionalId;
    return "";
  });
  const [date, setDate] = useState(() => initialDate ?? todayInTimezone(timezone));
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const service = useMemo(
    () => data.services.find((item) => item.id === serviceId),
    [data.services, serviceId],
  );

  const availableProfessionals = data.professionals.filter(
    (professional) => !service || service.professionalIds.includes(professional.id),
  );

  const slotsQuery = useQuery({
    queryKey: ["availability", slug, date, serviceId, professionalId],
    enabled: Boolean(serviceId) && !success,
    queryFn: () =>
      fetchAvailability({
        data: {
          slug,
          date,
          serviceId,
          professionalId: professionalId || null,
        },
      }),
  });

  useEffect(() => {
    if (!initialSlotLabel || slot || !slotsQuery.data) return;
    const matched = slotsQuery.data.find((item) => item.available && item.label === initialSlotLabel);
    if (matched) setSlot(matched.startsAt);
  }, [initialSlotLabel, slot, slotsQuery.data]);

  const booking = useMutation({
    mutationFn: async () =>
      submitAppointment({
        data: {
          slug,
          date,
          serviceId,
          professionalId: professionalId || null,
          startsAt: slot!,
          customerName: name,
          customerPhone: phone,
          ...(email ? { customerEmail: email } : {}),
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
      await slotsQuery.refetch();
    },
    onError: () => setError("Não foi possível concluir agora. Tente novamente."),
  });

  if (success) {
    const calendarUrl = calendarDataUrl({
      title: `${success.serviceName} · ${data.establishment.name}`,
      start: success.startsAt,
      end: success.endsAt,
      description: `Agendamento com ${success.professionalName}. Duração: ${success.durationMinutes} minutos.`,
    });

    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">✓</div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Agendamento confirmado!</h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu horário foi reservado em {data.establishment.name}.</p>
          <dl className="mt-6 space-y-2 text-left text-sm">
            <SummaryRow label="Serviço" value={success.serviceName} />
            <SummaryRow label="Profissional" value={success.professionalName} />
            <SummaryRow label="Data" value={formatDate(success.startsAt, timezone)} />
            <SummaryRow label="Horário" value={`${formatTime(success.startsAt, timezone)} até ${formatTime(success.endsAt, timezone)}`} />
            <SummaryRow label="Duração" value={`${success.durationMinutes} minutos`} />
            <SummaryRow label="Valor" value={formatPrice(success.price)} />
          </dl>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <a
              href={calendarUrl}
              download="agendamento-marca-minha-vez.ics"
              className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground"
            >
              Adicionar ao calendário
            </a>
            <AppointmentManagementButton slug={slug} appointmentId={success.id} customerPhone={phone} />
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => {
                setSuccess(null);
                setSlot(null);
                setError(null);
              }}
            >
              Fazer novo agendamento
            </button>
            <Link to="/" className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground">Voltar ao início</Link>
          </div>
        </div>
      </main>
    );
  }

  const dates = nextDays(14, timezone);
  const slots = slotsQuery.data ?? [];
  const minimumDate = todayInTimezone(timezone);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Agendamento online</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">{data.establishment.name}</h1>
        {data.establishment.description ? <p className="mt-1 text-sm text-muted-foreground">{data.establishment.description}</p> : null}
        <p className="mt-2 text-xs text-muted-foreground">Escolha um horário livre. Dados de outros clientes nunca são exibidos.</p>
      </header>

      <Step number={1} title="Escolha o serviço">
        <div className="grid gap-2 sm:grid-cols-2">
          {data.services.map((item) => {
            const selected = item.id === serviceId;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setServiceId(item.id);
                  setSlot(null);
                  setError(null);
                  if (professionalId && !item.professionalIds.includes(professionalId)) setProfessionalId("");
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
              >
                <span className="block font-medium text-foreground">{item.name}</span>
                <span className="block text-xs text-muted-foreground">{item.duration_minutes} min · {formatPrice(item.price)}</span>
                {item.description ? <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span> : null}
              </button>
            );
          })}
        </div>
      </Step>

      {availableProfessionals.length > 1 ? (
        <Step number={2} title="Escolha o profissional">
          <div className="flex flex-wrap gap-2">
            <ProfessionalChip
              label="Qualquer profissional"
              selected={professionalId === ""}
              onClick={() => {
                setProfessionalId("");
                setSlot(null);
              }}
            />
            {availableProfessionals.map((professional) => (
              <ProfessionalChip
                key={professional.id}
                label={professional.name}
                photoUrl={professional.photo_url}
                selected={professionalId === professional.id}
                onClick={() => {
                  setProfessionalId(professional.id);
                  setSlot(null);
                }}
              />
            ))}
          </div>
        </Step>
      ) : null}

      <Step number={availableProfessionals.length > 1 ? 3 : 2} title="Escolha o dia">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map((day) => {
            const selected = day === date;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setDate(day);
                  setSlot(null);
                }}
                className={`min-w-[84px] rounded-xl border px-3 py-2 text-center text-sm ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}
              >
                {formatDate(`${day}T12:00:00Z`, timezone)}
              </button>
            );
          })}
        </div>
        <label className="mt-2 block text-xs text-muted-foreground">
          Outra data:{" "}
          <input
            type="date"
            value={date}
            min={minimumDate}
            onChange={(event) => {
              setDate(event.target.value);
              setSlot(null);
            }}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          />
        </label>
      </Step>

      <Step number={availableProfessionals.length > 1 ? 4 : 3} title="Escolha o horário">
        {slotsQuery.isPending ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Carregando horários">
            {Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded-md bg-muted" />)}
          </div>
        ) : slotsQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">Não conseguimos carregar os horários. Tente novamente.</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem horários disponíveis nesta data para o serviço escolhido.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {slots.map((item) => {
                const selected = slot === item.startsAt;
                return (
                  <button
                    key={item.startsAt}
                    type="button"
                    disabled={!item.available}
                    aria-pressed={selected}
                    aria-label={`${item.label}: ${item.available ? "disponível" : "indisponível"}`}
                    title={item.available ? "Disponível" : "Indisponível"}
                    onClick={() => setSlot(item.startsAt)}
                    className={`rounded-md border px-2 py-2 text-sm transition-colors ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input enabled:hover:bg-accent"} disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted/40 disabled:text-muted-foreground disabled:line-through`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Horários riscados já estão ocupados ou não comportam o serviço completo.</p>
          </>
        )}
      </Step>

      {slot ? (
        <Step number={availableProfessionals.length > 1 ? 5 : 4} title="Seus dados e confirmação">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              booking.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome*">
                <input required minLength={2} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
              </Field>
              <Field label="Telefone/WhatsApp*">
                <input required minLength={8} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} placeholder="(11) 99999-0000" />
              </Field>
              <Field label="E-mail (opcional)" className="sm:col-span-2">
                <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
              </Field>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">Revise seu atendimento</p>
              <dl className="mt-2 space-y-1">
                <SummaryRow label="Serviço" value={service?.name ?? "—"} />
                <SummaryRow label="Profissional" value={professionalId ? availableProfessionals.find((p) => p.id === professionalId)?.name ?? "—" : "Qualquer profissional disponível"} />
                <SummaryRow label="Data" value={formatDate(slot, timezone)} />
                <SummaryRow label="Horário" value={formatTime(slot, timezone)} />
                <SummaryRow label="Duração" value={`${service?.duration_minutes ?? 0} minutos`} />
                <SummaryRow label="Valor" value={formatPrice(service?.price ?? 0)} />
              </dl>
            </div>

            {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={booking.isPending} className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
                {booking.isPending ? "Confirmando…" : "Confirmar agendamento"}
              </button>
              <button type="button" onClick={() => setSlot(null)} className="rounded-md border border-input px-5 py-2.5 text-sm">Escolher outro horário</button>
            </div>
          </form>
        </Step>
      ) : null}
    </main>
  );
}

function nextDays(count: number, timeZone: string) {
  const base = todayInTimezone(timeZone);
  return Array.from({ length: count }, (_, index) => addDaysInTimezone(base, index, timeZone));
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{number}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <label className={`space-y-1 text-sm ${className}`}><span className="font-medium text-foreground">{label}</span>{children}</label>;
}

function ProfessionalChip({ label, photoUrl, selected, onClick }: { label: string; photoUrl?: string | null; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
      <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground">
        {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : label.slice(0, 1)}
      </span>
      {label}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>;
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2";
