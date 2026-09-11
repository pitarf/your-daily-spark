import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function SettingsPage() {
  const { membership } = useEstablishment();

  const query = useQuery({
    queryKey: ["admin-settings", membership.establishmentId],
    queryFn: async () => {
      const [establishment, schedules] = await Promise.all([
        supabase
          .from("establishments")
          .select("name, slug, business_type, timezone, phone, whatsapp, email, address")
          .eq("id", membership.establishmentId)
          .maybeSingle(),
        supabase
          .from("weekly_schedules")
          .select("id, weekday, start_time, end_time, active, professional_id, schedule_breaks(start_time, end_time)")
          .eq("establishment_id", membership.establishmentId)
          .order("weekday"),
      ]);
      if (establishment.error) throw establishment.error;
      if (schedules.error) throw schedules.error;
      return { establishment: establishment.data, schedules: schedules.data ?? [] };
    },
  });

  if (query.isPending) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (query.isError) return <p className="text-sm text-destructive">Não foi possível carregar.</p>;

  const est = query.data?.establishment;
  const schedules = query.data?.schedules ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Seu papel: {membership.role}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="text-base font-semibold text-foreground">Estabelecimento</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          <Info label="Nome" value={est?.name} />
          <Info label="Tipo" value={est?.business_type} />
          <Info label="Link público" value={`/schedule`} />
          <Info label="Fuso horário" value={est?.timezone} />
          <Info label="Telefone" value={est?.phone} />
          <Info label="E-mail" value={est?.email} />
          <Info label="Endereço" value={est?.address} />
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="text-base font-semibold text-foreground">Horários de funcionamento</h2>
        {schedules.length === 0 ? (
          <p className="mt-2 text-muted-foreground">Nenhum horário cadastrado.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {schedules.map((s) => {
              const breaks = (
                (s as unknown as { schedule_breaks: { start_time: string; end_time: string }[] })
                  .schedule_breaks ?? []
              )
                .map((b) => `${b.start_time.slice(0, 5)}–${b.end_time.slice(0, 5)}`)
                .join(", ");
              return (
                <li key={s.id} className="flex flex-wrap gap-2 py-2">
                  <span className="w-24 font-medium text-foreground">{WEEKDAYS[s.weekday]}</span>
                  <span className="text-muted-foreground">
                    {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                  </span>
                  {breaks ? <span className="text-muted-foreground">intervalo {breaks}</span> : null}
                  {s.professional_id ? (
                    <span className="text-xs text-muted-foreground">(agenda individual)</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          A edição de horários pela tela ainda será liberada em uma próxima etapa.
        </p>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value || "—"}</dd>
    </div>
  );
}
