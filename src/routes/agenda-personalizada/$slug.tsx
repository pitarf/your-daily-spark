import { createFileRoute } from "@tanstack/react-router";

import { CustomDurationBookingPage } from "@/components/scheduling/CustomDurationBookingPage";
import { getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";

export const Route = createFileRoute("/agenda-personalizada/$slug")({
  loader: ({ params }) => getEstablishmentScheduling({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.establishment.name ?? "Agendamento personalizado"} | Marca Minha Vez` },
      {
        name: "description",
        content:
          loaderData?.establishment.description ??
          "Defina a duração do seu atendimento e reserve um horário pelo Marca Minha Vez.",
      },
      { property: "og:title", content: loaderData?.establishment.name ?? "Agendamento personalizado" },
      {
        property: "og:description",
        content: loaderData?.establishment.description ?? "Agendamento personalizado online.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PersonalizedAgendaPage,
  errorComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar o agendamento personalizado agora. Tente novamente em instantes.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Estabelecimento não encontrado.</div>
  ),
});

function PersonalizedAgendaPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();

  if (!data) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum estabelecimento ativo encontrado.</div>;
  }

  return <CustomDurationBookingPage data={data} slug={slug} />;
}
