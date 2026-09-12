import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { BookingPage } from "@/components/scheduling/BookingPage";
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
      { property: "og:title", content: "Agendar horário | Marca Minha Vez" },
      {
        property: "og:description",
        content: "Veja os horários disponíveis e reserve seu atendimento online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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

function SchedulePage() {
  const data = Route.useLoaderData();
  const { slug = DEMO_SLUG } = Route.useSearch();

  if (!data) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Nenhum estabelecimento ativo encontrado.
      </div>
    );
  }

  return <BookingPage data={data} slug={slug} />;
}
