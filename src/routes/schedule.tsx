import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { getAvailability, getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";

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

function SchedulePage() {
  const data = Route.useLoaderData();
  const fetchAvailability = useServerFn(getAvailability);

  const [serviceId, setServiceId] = useState<string>(data?.services[0]?.id ?? "");
  const [professionalId, setProfessionalId] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());

  const service = useMemo(
    () => data?.services.find((s) => s.id === serviceId),
    [data, serviceId],
  );

  const slotsQuery = useQuery({
    queryKey: ["availability", DEMO_SLUG, date, serviceId, professionalId],
    enabled: Boolean(serviceId),
    queryFn: () =>
      fetchAvailability({
        data: { slug: DEMO_SLUG, date, serviceId, professionalId: professionalId || null },
      }),
  });

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Nenhum estabelecimento ativo encontrado.
      </div>
    );
  }

  const slots = slotsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">{data.establishment.name}</h1>
      {data.establishment.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{data.establishment.description}</p>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Serviço</span>
          <select
            className="rounded-md border border-input bg-background px-3 py-2"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            {data.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.duration_minutes} min — R$ {s.price.toFixed(2)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Profissional</span>
          <select
            className="rounded-md border border-input bg-background px-3 py-2"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
          >
            <option value="">Qualquer profissional</option>
            {data.professionals
              .filter((p) => !service || service.professionalIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Data</span>
          <input
            type="date"
            className="rounded-md border border-input bg-background px-3 py-2"
            value={date}
            min={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Horários</h2>
        {slotsQuery.isPending ? (
          <p className="mt-2 text-sm text-muted-foreground">Carregando horários…</p>
        ) : slots.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Sem atendimento nesta data para o serviço escolhido.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {slots.map((slot) => (
              <button
                key={slot.startsAt}
                type="button"
                disabled={!slot.available}
                className="rounded-md border border-input px-2 py-2 text-sm transition-colors enabled:hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {slot.label}
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
