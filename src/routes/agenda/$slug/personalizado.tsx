import { createFileRoute } from "@tanstack/react-router";

import { CustomDurationBookingPage } from "@/components/scheduling/CustomDurationBookingPage";
import { getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";

export const Route = createFileRoute("/agenda/$slug/personalizado")({
  loader: ({ params }) => getEstablishmentScheduling({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `Agendamento personalizado | ${loaderData?.establishment.name ?? "Marca Minha Vez"}` },
      {
        name: "description",
        content: `Escolha uma duração personalizada para seu atendimento em ${loaderData?.establishment.name ?? "nosso estabelecimento"}.`,
      },
    ],
  }),
  component: CustomDurationRoute,
  errorComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar o agendamento personalizado agora.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Estabelecimento não encontrado.</div>
  ),
});

function CustomDurationRoute() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();

  if (!data) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum estabelecimento ativo encontrado.</div>;
  }

  return <CustomDurationBookingPage data={data} slug={slug} />;
}
