import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { BookingPage } from "@/components/scheduling/BookingPage";
import { CustomDurationBookingPage } from "@/components/scheduling/CustomDurationBookingPage";
import { StandaloneCustomBookingPage } from "@/components/scheduling/StandaloneCustomBookingPage";
import { getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";
import { businessThemeStyle, getBusinessTheme } from "@/lib/theming/business-theme";
import { getEstablishmentTheme } from "@/lib/theming/establishment-theme.functions";

const agendaSearchSchema = z.object({
  custom: z
    .preprocess((value) => value === true || value === "true", z.boolean())
    .optional(),
  standalone: z
    .preprocess((value) => value === true || value === "true", z.boolean())
    .optional(),
});

export const Route = createFileRoute("/agenda/$slug")({
  validateSearch: agendaSearchSchema,
  loader: async ({ params }) => {
    const [data, theme] = await Promise.all([
      getEstablishmentScheduling({ data: { slug: params.slug } }),
      getEstablishmentTheme({ data: { slug: params.slug } }),
    ]);

    if (!data) return data;
    return { ...data, businessType: theme?.businessType ?? "outro" };
  },
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
  const { custom, standalone } = Route.useSearch();

  if (!data) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum estabelecimento ativo encontrado.</div>;
  }

  const theme = getBusinessTheme(data.businessType);

  return (
    <div style={businessThemeStyle(theme)}>
      {standalone ? (
        <StandaloneCustomBookingPage data={data} slug={slug} />
      ) : custom ? (
        <CustomDurationBookingPage data={data} slug={slug} />
      ) : (
        <>
          <div className="mx-auto flex max-w-3xl flex-wrap justify-end gap-2 px-4 pt-5 sm:pt-7">
            <Link
              to="/agenda/$slug"
              params={{ slug }}
              search={{ standalone: true }}
              className="inline-flex rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              Não encontrei meu serviço
            </Link>
            <Link
              to="/agenda/$slug"
              params={{ slug }}
              search={{ custom: true }}
              className="inline-flex rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
            >
              Alterar duração do serviço
            </Link>
          </div>
          <BookingPage data={data} slug={slug} />
        </>
      )}
    </div>
  );
}
