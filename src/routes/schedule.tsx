import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";

import { getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";

const DEMO_SLUG = "barbearia-marca-minha-vez";

export const Route = createFileRoute("/schedule")({
  validateSearch: z.object({ slug: z.string().min(1).optional() }),
  loaderDeps: ({ search }) => ({ slug: search.slug ?? DEMO_SLUG }),
  loader: ({ deps }) => getEstablishmentScheduling({ data: { slug: deps.slug } }),
  head: () => ({
    meta: [
      { title: "Agendar horário | Marca Minha Vez" },
      {
        name: "description",
        content: "Escolha o serviço, o profissional e o horário livre para marcar seu atendimento em poucos toques.",
      },
    ],
  }),
  component: LegacyScheduleRoute,
  errorComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível encontrar este estabelecimento.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Estabelecimento não encontrado.</div>
  ),
});

function LegacyScheduleRoute() {
  const navigate = useNavigate();
  const { slug = DEMO_SLUG } = Route.useSearch();
  const data = Route.useLoaderData();

  useEffect(() => {
    if (!data) return;
    navigate({
      to: "/agenda/$slug",
      params: { slug },
      replace: true,
    });
  }, [data, navigate, slug]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg items-center justify-center px-4 py-12 text-center">
      <p className="text-sm text-muted-foreground">Abrindo a agenda…</p>
    </main>
  );
}
