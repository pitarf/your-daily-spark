import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/plans")({
  component: PlansPage,
});

type Service = {
  id: string;
  name: string;
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  duration_limit_minutes: number | null;
  active: boolean;
  serviceIds: string[];
};

type Draft = {
  id: string | null;
  name: string;
  description: string;
  durationLimitMinutes: number | null;
  active: boolean;
  serviceIds: string[];
};

const EMPTY: Draft = {
  id: null,
  name: "",
  description: "",
  durationLimitMinutes: null,
  active: true,
  serviceIds: [],
};

function PlansPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["admin-plan-services", membership.establishmentId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("services")
        .select("id, name")
        .eq("establishment_id", membership.establishmentId)
        .order("name");
      if (queryError) throw queryError;
      return (data ?? []) as Service[];
    },
  });

  const plansQuery = useQuery({
    queryKey: ["admin-plans", membership.establishmentId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("customer_plans")
        .select("id, name, description, duration_limit_minutes, active, customer_plan_services(service_id)")
        .eq("establishment_id", membership.establishmentId)
        .order("created_at", { ascending: true });
      if (queryError) throw queryError;
      return (data ?? []).map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        duration_limit_minutes: plan.duration_limit_minutes,
        active: plan.active,
        serviceIds: ((plan.customer_plan_services ?? []) as { service_id: string }[]).map((item) => item.service_id),
      })) as Plan[];
    },
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const name = value.name.trim();
      if (name.length < 2) throw new Error("Informe um nome válido para o plano.");
      if (value.durationLimitMinutes !== null && (!Number.isInteger(value.durationLimitMinutes) || value.durationLimitMinutes < 5)) {
        throw new Error("A duração máxima precisa ser um número inteiro de pelo menos 5 minutos.");
      }

      const payload = {
        establishment_id: membership.establishmentId,
        name,
        description: value.description.trim() || null,
        duration_limit_minutes: value.durationLimitMinutes,
        active: value.active,
      };

      let id = value.id;
      if (id) {
        const { error: updateError } = await supabase
          .from("customer_plans")
          .update(payload)
          .eq("id", id)
          .eq("establishment_id", membership.establishmentId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("customer_plans")
          .insert(payload)
          .select("id")
          .single();
        if (insertError || !data) throw insertError ?? new Error("Não foi possível criar o plano.");
        id = data.id;
      }

      const { error: deleteError } = await supabase
        .from("customer_plan_services")
        .delete()
        .eq("plan_id", id);
      if (deleteError) throw deleteError;

      if (value.serviceIds.length > 0) {
        const { error: linksError } = await supabase
          .from("customer_plan_services")
          .insert(value.serviceIds.map((service_id) => ({ plan_id: id!, service_id })));
        if (linksError) throw linksError;
      }
    },
    onSuccess: async () => {
      setDraft(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const toggle = useMutation({
    mutationFn: async (plan: Plan) => {
      const { error: updateError } = await supabase
        .from("customer_plans")
        .update({ active: !plan.active })
        .eq("id", plan.id)
        .eq("establishment_id", membership.establishmentId);
      if (updateError) throw updateError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-plans"] }),
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const services = servicesQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Regras comerciais</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Planos de clientes</h1>
          <p className="text-sm text-muted-foreground">Defina os serviços e a duração máxima permitidos para cada plano.</p>
        </div>
        <button type="button" onClick={() => { setError(null); setDraft({ ...EMPTY }); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Novo plano</button>
      </header>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {draft ? (
        <form
          className="rounded-xl border border-border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate(draft);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do plano" required className="sm:col-span-2">
              <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} placeholder="Ex.: Premium" />
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={inputClass} placeholder="Descreva os benefícios ou regras deste plano." />
            </Field>
            <Field label="Duração máxima (minutos)">
              <input
                type="number"
                min={5}
                step={5}
                value={draft.durationLimitMinutes ?? ""}
                onChange={(e) => setDraft({ ...draft, durationLimitMinutes: e.target.value ? Number(e.target.value) : null })}
                className={inputClass}
                placeholder="Sem limite"
              />
              <span className="text-xs text-muted-foreground">Deixe vazio para não limitar a duração por este plano.</span>
            </Field>
            <label className="flex items-center gap-2 pt-7 text-sm">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              <span className="text-foreground">Plano ativo</span>
            </label>

            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-foreground">Serviços permitidos</p>
              <p className="mt-1 text-xs text-muted-foreground">Quando nenhum serviço for marcado, o plano não restringe por serviço.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {services.map((service) => (
                  <label key={service.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input checked={draft.serviceIds.includes(service.id)} onChange={(e) => setDraft({ ...draft, serviceIds: e.target.checked ? [...draft.serviceIds, service.id] : draft.serviceIds.filter((id) => id !== service.id) })} type="checkbox" />
                    <span className="text-foreground">{service.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 flex gap-2 border-t border-border pt-4">
            <button type="submit" disabled={save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{save.isPending ? "Salvando…" : "Salvar plano"}</button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button>
          </div>
        </form>
      ) : null}

      {plansQuery.isPending ? <p className="text-sm text-muted-foreground">Carregando planos…</p> : plansQuery.isError ? <p className="text-sm text-destructive">Não foi possível carregar os planos.</p> : plans.length === 0 ? <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Nenhum plano criado ainda.</div> : <div className="grid gap-3 md:grid-cols-2">{plans.map((plan) => <PlanCard key={plan.id} plan={plan} services={services} onEdit={() => setDraft({ id: plan.id, name: plan.name, description: plan.description ?? "", durationLimitMinutes: plan.duration_limit_minutes, active: plan.active, serviceIds: plan.serviceIds })} onToggle={() => toggle.mutate(plan)} />)}</div>}
    </div>
  );
}

function PlanCard({ plan, services, onEdit, onToggle }: { plan: Plan; services: Service[]; onEdit: () => void; onToggle: () => void }) {
  const serviceNames = plan.serviceIds.map((id) => services.find((service) => service.id === id)?.name).filter(Boolean) as string[];
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">{plan.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${plan.active ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}>{plan.active ? "Ativo" : "Inativo"}</span>
          </div>
          {plan.description ? <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Duração máxima</p><p className="mt-1 text-sm font-semibold text-foreground">{plan.duration_limit_minutes ? `${plan.duration_limit_minutes} min` : "Sem limite"}</p></div>
        <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Serviços</p><p className="mt-1 text-sm font-semibold text-foreground">{serviceNames.length === 0 ? "Todos" : `${serviceNames.length} selecionado${serviceNames.length === 1 ? "" : "s"}`}</p></div>
      </div>
      {serviceNames.length > 0 ? <p className="mt-3 text-xs text-muted-foreground">{serviceNames.join(" · ")}</p> : null}
      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onEdit} className="text-xs font-medium underline">Editar</button>
        <button type="button" onClick={onToggle} className="text-xs font-medium underline">{plan.active ? "Desativar" : "Ativar"}</button>
      </div>
    </article>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:opacity-60";

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={`block space-y-1 ${className}`}><span className="text-sm font-medium text-foreground">{label}{required ? <span className="text-destructive"> *</span> : null}</span>{children}</label>;
}
