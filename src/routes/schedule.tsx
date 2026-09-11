import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import {
  createAppointment,
  getAvailability,
  getEstablishmentScheduling,
  type CreateAppointmentResult,
} from "@/lib/scheduling/scheduling.functions";
import { formatDate, formatPrice, formatTime } from "@/lib/scheduling/format";

const DEMO_SLUG = "barbearia-marca-minha-vez";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Agendar horário | Marca Minha Vez" },
      {
        name: "description",
        content:
          "Escolha o serviço, o profissional e o horário livre para marcar seu atendimento em poucos toques.",
      },
      { property: "og:title", content: "Agendar horário | Marca Minha Vez" },
      {
        property: "og:description",
        content: "Veja os horários disponíveis e reserve seu atendimento online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getEstablishmentScheduling({ data: { slug: DEMO_SLUG } }),
  component: SchedulePage,
  errorComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar a agenda agora. Tente novamente em instantes.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Estabelecimento não encontrado.</div>
  ),
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function nextDays(count: number) {
  const base = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base.getTime() + i * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
}

type Success = Extract<CreateAppointmentResult, { ok: true }>["appointment"];

function SchedulePage() {
  const data = Route.useLoaderData();
  const fetchAvailability = useServerFn(getAvailability);
  const submitAppointment = useServerFn(createAppointment);

  const [serviceId, setServiceId] = useState<string>(data?.services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<Success | null>(null);

  const service = useMemo(() => data?.services.find((s) => s.id === serviceId), [data, serviceId]);
  const timezone = data?.establishment.timezone ?? "America/Sao_Paulo";

  const slotsQuery = useQuery({
    queryKey: ["availability", DEMO_SLUG, date, serviceId, professionalId],
    enabled: Boolean(serviceId) && !success,
    queryFn: () =>
      fetchAvailability({
        data: { slug: DEMO_SLUG, date, serviceId, professionalId: professionalId || null },
      }),
  });

  const booking = useMutation({
    mutationFn: async () => {
      const result = await submitAppointment({
        data: {
          slug: DEMO_SLUG,
          date,
          serviceId,
          professionalId: professionalId || null,
          startsAt: slot!,
          customerName: name,
          customerPhone: phone,
          ...(email ? { customerEmail: email } : {}),
        },
      });
      return result;
    },
    onSuccess: async (result) => {
      if (result.ok) {
        setSuccess(result.appointment);
        setError(null);
      } else {
        setError(result.error);
        setSlot(null);
        await slotsQuery.refetch();
      }
    },
    onError: () => setError("Não foi possível concluir agora. Tente novamente."),
  });

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Nenhum estabelecimento ativo encontrado.
      </div>
    );
  }

  if (success) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
            ✓
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground">Agendamento confirmado!</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enviamos seus dados para {data.establishment.name}.
          </p>
          <dl className="mt-6 space-y-2 text-left text-sm">
            <Row label="Serviço" value={success.serviceName} />
            <Row label="Profissional" value={success.professionalName} />
            <Row label="Data" value={formatDate(success.startsAt, timezone)} />
            <Row
              label="Horário"
              value={`${formatTime(success.startsAt, timezone)} — ${formatTime(success.endsAt, timezone)}`}
            />
            <Row label="Duração" value={`${success.durationMinutes} minutos`} />
            <Row label="Valor" value={formatPrice(success.price)} />
          </dl>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => {
                setSuccess(null);
                setSlot(null);
              }}
            >
              Fazer novo agendamento
            </button>
            <Link
              to="/"
              className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground"
            >
              Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const availableProfessionals = data.professionals.filter(
    (p) => !service || service.professionalIds.includes(p.id),
  );
  const slots = slotsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{data.establishment.name}</h1>
        {data.establishment.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{data.establishment.description}</p>
        ) : null}
      </header>

      <Step number={1} title="Escolha o serviço">
        <div className="grid gap-2 sm:grid-cols-2">
          {data.services.map((s) => {
            const selected = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setServiceId(s.id);
                  setSlot(null);
                  if (professionalId && !s.professionalIds.includes(professionalId)) {
                    setProfessionalId("");
                  }
                }}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                <span className="block font-medium text-foreground">{s.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {s.duration_minutes} min · {formatPrice(s.price)}
                </span>
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
            {availableProfessionals.map((p) => (
              <ProfessionalChip
                key={p.id}
                label={p.name}
                photoUrl={p.photo_url}
                selected={professionalId === p.id}
                onClick={() => {
                  setProfessionalId(p.id);
                  setSlot(null);
                }}
              />
            ))}
          </div>
        </Step>
      ) : null}

      <Step number={availableProfessionals.length > 1 ? 3 : 2} title="Escolha o dia">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {nextDays(14).map((d) => {
            const selected = d === date;
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDate(d);
                  setSlot(null);
                }}
                className={`min-w-[84px] rounded-xl border px-3 py-2 text-center text-sm ${
                  selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                }`}
              >
                {formatDate(`${d}T12:00:00Z`, timezone)}
              </button>
            );
          })}
        </div>
        <label className="mt-2 block text-xs text-muted-foreground">
          Ou escolha outra data:{" "}
          <input
            type="date"
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={date}
            min={todayIso()}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot(null);
            }}
          />
        </label>
      </Step>

      <Step number={availableProfessionals.length > 1 ? 4 : 3} title="Escolha o horário">
        {slotsQuery.isPending ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : slotsQuery.isError ? (
          <p className="text-sm text-destructive">
            Não conseguimos carregar os horários. Tente novamente.
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sem atendimento nesta data para o serviço escolhido.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slots.map((s) => {
              const selected = slot === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  disabled={!s.available}
                  title={s.available ? "Disponível" : "Indisponível"}
                  onClick={() => setSlot(s.startsAt)}
                  className={`rounded-md border px-2 py-2 text-sm transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input enabled:hover:bg-accent"
                  } disabled:cursor-not-allowed disabled:border-dashed disabled:bg-muted/40 disabled:text-muted-foreground disabled:line-through`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </Step>

      {slot ? (
        <Step number={availableProfessionals.length > 1 ? 5 : 4} title="Seus dados e confirmação">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              booking.mutate();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Nome*</span>
                <input
                  required
                  minLength={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">Telefone/WhatsApp*</span>
                <input
                  required
                  minLength={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-0000"
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="font-medium text-foreground">E-mail (opcional)</span>
                <input
                  type="email"
                  className="w-full rounded-md border border-input bg-background px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
              <p className="font-medium text-foreground">Revise seu atendimento</p>
              <dl className="mt-2 space-y-1">
                <Row label="Serviço" value={service?.name ?? "—"} />
                <Row
                  label="Profissional"
                  value={
                    professionalId
                      ? (availableProfessionals.find((p) => p.id === professionalId)?.name ?? "—")
                      : "Qualquer profissional disponível"
                  }
                />
                <Row label="Data" value={formatDate(slot, timezone)} />
                <Row label="Horário" value={formatTime(slot, timezone)} />
                <Row label="Duração" value={`${service?.duration_minutes ?? 0} minutos`} />
                <Row label="Valor" value={formatPrice(service?.price ?? 0)} />
              </dl>
            </div>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="submit"
                disabled={booking.isPending}
                className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {booking.isPending ? "Confirmando…" : "Confirmar agendamento"}
              </button>
              <button
                type="button"
                onClick={() => setSlot(null)}
                className="rounded-md border border-input px-5 py-2.5 text-sm"
              >
                Escolher outro horário
              </button>
            </div>
          </form>
        </Step>
      ) : error ? (
        <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}
    </main>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ProfessionalChip({
  label,
  photoUrl,
  selected,
  onClick,
}: {
  label: string;
  photoUrl?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-foreground">
        {photoUrl ? (
          <img src={photoUrl} alt={label} className="h-full w-full object-cover" />
        ) : (
          label.slice(0, 1)
        )}
      </span>
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
