import { Link, createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { BookingPage } from "@/components/scheduling/BookingPage";
import { CustomerAppointmentLookupPage } from "@/components/scheduling/CustomerAppointmentLookupPage";
import { CustomDurationBookingPage } from "@/components/scheduling/CustomDurationBookingPage";
import { ManagedAppointmentPage } from "@/components/scheduling/ManagedAppointmentPage";
import { StandaloneCustomBookingPage } from "@/components/scheduling/StandaloneCustomBookingPage";
import { getEstablishmentScheduling } from "@/lib/scheduling/scheduling.functions";
import { getPublicSchedulingSettings } from "@/lib/scheduling/public-settings.functions";
import { businessThemeStyle, getBusinessThemeWithPreset, getBusinessTypeLabel } from "@/lib/theming/business-theme";
import { getEstablishmentThemeConfig } from "@/lib/theming/establishment-theme.functions";

const agendaSearchSchema = z.object({
  custom: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  standalone: z.preprocess((value) => value === true || value === "true", z.boolean()).optional(),
  manage: z.string().min(1).max(160).optional(),
  token: z.string().min(20).optional(),
  serviceId: z.string().uuid().optional(),
  professionalId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export const Route = createFileRoute("/agenda/$slug")({
  validateSearch: agendaSearchSchema,
  loader: async ({ params }) => {
    const [data, themeConfig, publicSettings] = await Promise.all([
      getEstablishmentScheduling({ data: { slug: params.slug } }),
      getEstablishmentThemeConfig({ data: { slug: params.slug } }),
      getPublicSchedulingSettings({ data: { slug: params.slug } }),
    ]);
    if (!data) return data;
    return {
      ...data,
      businessType: themeConfig.businessType ?? "outro",
      themePreset: themeConfig.themePreset ?? "auto",
      publicBranding: {
        logoUrl: themeConfig.logoUrl,
        whatsapp: themeConfig.whatsapp ?? themeConfig.phone,
      },
      publicSettings,
    };
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: `${loaderData?.establishment.name ?? "Agendamento"} | Marca Minha Vez` },
      { name: "description", content: loaderData?.establishment.description ?? "Agende seu atendimento online pelo Marca Minha Vez." },
      { name: "robots", content: "index,follow" },
      { name: "theme-color", content: "#ffffff" },
      { property: "og:title", content: loaderData?.establishment.name ?? "Agendamento" },
      { property: "og:description", content: loaderData?.establishment.description ?? "Agende seu atendimento online." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `https://marca-minha-vez.lovable.app/agenda/${encodeURIComponent(params.slug)}` },
      ...(loaderData?.publicBranding.logoUrl ? [{ property: "og:image", content: loaderData.publicBranding.logoUrl }] : []),
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: loaderData?.establishment.name ?? "Agendamento" },
      { name: "twitter:description", content: loaderData?.establishment.description ?? "Agende seu atendimento online." },
    ],
    links: [
      {
        rel: "canonical",
        href: `https://marca-minha-vez.lovable.app/agenda/${encodeURIComponent(params.slug)}`,
      },
    ],
  }),
  component: AgendaPage,
  errorComponent: () => <div className="p-8 text-center text-sm text-muted-foreground">Não foi possível carregar a agenda agora. Tente novamente em instantes.</div>,
  notFoundComponent: () => <div className="p-8 text-center text-sm text-muted-foreground">Estabelecimento não encontrado.</div>,
});

function AgendaPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const { custom, standalone, manage, token, serviceId, professionalId, date, time } = Route.useSearch();

  if (!data) return <div className="p-8 text-center text-sm text-muted-foreground">Nenhum estabelecimento ativo encontrado.</div>;

  const theme = getBusinessThemeWithPreset(data.businessType, data.themePreset);
  const customDurationEnabled = data.publicSettings.allowCustomDuration;

  if (manage === "find") {
    return (
      <div style={businessThemeStyle(theme)}>
        <PublicHeader data={data} />
        <CustomerAppointmentLookupPage slug={slug} timezone={data.establishment.timezone} establishmentName={data.establishment.name} />
      </div>
    );
  }

  if (manage && token) {
    return (
      <div style={businessThemeStyle(theme)}>
        <PublicHeader data={data} />
        <ManagedAppointmentPage appointmentId={manage} token={token} />
      </div>
    );
  }

  const requestedUnavailableFeature = (custom || standalone) && !customDurationEnabled;

  if (requestedUnavailableFeature) {
    return (
      <div style={businessThemeStyle(theme)}>
        <PublicHeader data={data} />
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Opção não disponível</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Este estabelecimento não permite agendamento personalizado no momento.</p>
          <Link to="/agenda/$slug" params={{ slug }} className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Voltar para a agenda</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={businessThemeStyle(theme)}>
      <PublicHeader data={data} />
      {standalone ? <StandaloneCustomBookingPage data={data} slug={slug} /> : custom ? <CustomDurationBookingPage data={data} slug={slug} /> : (
        <>
          <div className="mx-auto flex max-w-3xl flex-wrap justify-end gap-2 px-4 pt-5 sm:pt-7">
            <Link to="/agenda/$slug" params={{ slug }} search={{ manage: "find" }} className="inline-flex rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">Gerenciar agendamento</Link>
            {customDurationEnabled ? (
              <>
                <Link to="/agenda/$slug" params={{ slug }} search={{ standalone: true }} className="inline-flex rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">Não encontrei meu serviço</Link>
                <Link to="/agenda/$slug" params={{ slug }} search={{ custom: true }} className="inline-flex rounded-md border border-input px-3 py-2 text-xs font-medium text-foreground hover:bg-accent">Alterar duração do serviço</Link>
              </>
            ) : null}
          </div>
          <BookingPage
            data={data}
            slug={slug}
            initialServiceId={serviceId}
            initialProfessionalId={professionalId}
            initialDate={date}
            initialSlotLabel={time}
          />
        </>
      )}
    </div>
  );
}

function PublicHeader({ data }: { data: NonNullable<ReturnType<typeof Route.useLoaderData>> }) {
  const { establishment, businessType, publicBranding } = data;
  const businessLabel = getBusinessTypeLabel(businessType);
  const whatsapp = publicBranding.whatsapp?.replace(/\D/g, "") ?? "";
  const whatsappHref = whatsapp.length >= 10 ? `https://wa.me/${whatsapp}` : null;
  const phone = establishment.phone?.trim() ?? "";
  const phoneHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <header className="mx-auto max-w-3xl px-4 pt-6 sm:pt-8">
      <div className="rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {publicBranding.logoUrl ? <img src={publicBranding.logoUrl} alt="" className="h-11 w-11 rounded-xl border border-border bg-background object-contain p-1" /> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground" aria-hidden="true">{establishment.name.slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{establishment.name}</p>
              <p className="text-xs text-muted-foreground">{businessLabel}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {phoneHref ? <a href={phoneHref} aria-label={`Ligar para ${establishment.name}`} className="inline-flex rounded-full border border-input px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">Ligar</a> : null}
            {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" aria-label={`Abrir WhatsApp de ${establishment.name}`} className="inline-flex rounded-full border border-input px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent">WhatsApp</a> : null}
          </div>
        </div>
        {establishment.address || phone ? (
          <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
            {establishment.address ? <span className="truncate" title={establishment.address}>📍 {establishment.address}</span> : null}
            {phone ? <span>{phone}</span> : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
