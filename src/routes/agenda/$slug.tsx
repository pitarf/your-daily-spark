import { Link, createFileRoute } from "@tanstack/react-router";

import { BookingPage } from "@/components/scheduling/BookingPage";
import { getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";

export const Route = createFileRoute("/agenda/$slug")({
  loader: ({ params }) => getEstablishmentScheduling({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.establishment.name ?? "Agendamento"} | Marca Minha Vez` },
      {
        name: "description",
        content:
          loaderData?.establishment.description ??
          "Agende seu atendimento online pelo Marca Minha Vez.",
      },
      { property: "og:title", content: loaderData?.establishment.name ?? "Agendamento" },
      {
        property: "og:description",
        content: loaderData?.establishment.description ?? "Agende seu atendimento online.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
  errorComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">
      Não foi possível carregar a agenda agora. Tente novamente em instantes.
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Estabelecimento não encontrado.</div>
  ),
});

function AgendaPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();

  if (!data) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum estabelecimento ativo encontrado.</div>;
  }

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 pt-5 text-right sm:pt-7">
        <Link
          to="/agenda-personalizada/$slug"
          params={{ slug }}
          className="inline-flex rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
        >
          Agendamento personalizado
        </Link>
      </div>
      <BookingPage data={data} slug={slug} />
    </div>
  );
}
