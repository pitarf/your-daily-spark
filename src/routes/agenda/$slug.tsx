import { createFileRoute, Link } from "@tanstack/react-router";

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
    <div className="space-y-3 bg-muted/20 py-3">
      {data.services.length > 0 ? (
        <section className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Precisa de mais tempo?</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Escolha uma duração personalizada, em intervalos de 15 minutos, sujeita à disponibilidade da agenda.
            </p>
          </div>
          <Link
            to="/agenda/$slug/personalizado"
            params={{ slug }}
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Agendamento personalizado
          </Link>
        </section>
      ) : null}
      <BookingPage data={data} slug={slug} />
    </div>
  );
}
