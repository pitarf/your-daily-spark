import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  planId: string | null;
  planName: string | null;
};

type CustomerDraft = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

type Plan = {
  id: string;
  name: string;
  description: string | null;
  duration_limit_minutes: number | null;
  active: boolean;
  serviceIds: string[];
};

type PlanDraft = {
  id: string | null;
  name: string;
  description: string;
  durationLimitMinutes: string;
  active: boolean;
  serviceIds: string[];
};

const EMPTY_PLAN: PlanDraft = {
  id: null,
  name: "",
  description: "",
  durationLimitMinutes: "",
  active: true,
  serviceIds: [],
};

function CustomersPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"customers" | "plans">("customers");
  const [planDraft, setPlanDraft] = useState<PlanDraft | null>(null);
  const [assigningCustomer, setAssigningCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDraft | null>(null);
  const [assignPlanId, setAssignPlanId] = useState("");
  const [assignExpiresAt, setAssignExpiresAt] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPlanFilter, setCustomerPlanFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ["admin-customers", membership.establishmentId],
    queryFn: async () => {
      const { data: customers, error: customerError } = await supabase
        .from("customers")
        .select("id, name, phone, email, notes, created_at")
        .eq("establishment_id", membership.establishmentId)
        .order("created_at", { ascending: false });
      if (customerError) throw customerError;

      const { data: assignments, error: assignmentError } = await supabase
        .from("customer_plan_assignments")
        .select("customer_id, plan_id, starts_at, expires_at, customer_plans(name)")
        .eq("customer_plans.establishment_id", membership.establishmentId)
        .order("starts_at", { ascending: false });
      if (assignmentError) throw assignmentError;

      const byCustomer = new Map<string, { planId: string; planName: string | null }>();
      for (const assignment of assignments ?? []) {
        const existing = byCustomer.get(assignment.customer_id);
        const now = Date.now();
        const starts = new Date(assignment.starts_at).getTime();
        const expires = assignment.expires_at ? new Date(assignment.expires_at).getTime() : Infinity;
        if (!existing && starts <= now && expires >= now) {
          const plan = assignment.customer_plans as unknown as { name: string } | null;
          byCustomer.set(assignment.customer_id, { planId: assignment.plan_id, planName: plan?.name ?? null });
        }
      }

      return (customers ?? []).map((customer) => ({
        ...customer,
        planId: byCustomer.get(customer.id)?.planId ?? null,
        planName: byCustomer.get(customer.id)?.planName ?? null,
      })) as Customer[];
    },
  });

  const servicesQuery = useQuery({
    queryKey: ["admin-plan-services", membership.establishmentId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("services")
        .select("id, name")
        .eq("establishment_id", membership.establishmentId)
        .order("name");
      if (err) throw err;
      return data ?? [];
    },
  });

  const plansQuery = useQuery({
    queryKey: ["admin-customer-plans", membership.establishmentId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("customer_plans")
        .select("id, name, description, duration_limit_minutes, active, customer_plan_services(service_id)")
        .eq("establishment_id", membership.establishmentId)
        .order("name");
      if (err) throw err;
      return (data ?? []).map((plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        duration_limit_minutes: plan.duration_limit_minutes,
        active: plan.active,
        serviceIds: (
          (plan as unknown as { customer_plan_services: { service_id: string }[] }).customer_plan_services ?? []
        ).map((link) => link.service_id),
      })) as Plan[];
    },
  });

  const saveCustomer = useMutation({
    mutationFn: async (value: CustomerDraft) => {
      const name = value.name.trim();
      const phone = value.phone.trim();
      const email = value.email.trim().toLowerCase();
      if (name.length < 2) throw new Error("Informe um nome válido para o cliente.");
      if (phone.length < 8) throw new Error("Informe um telefone válido para o cliente.");
      if (email && !email.includes("@")) throw new Error("Informe um e-mail válido.");

      const { error: updateError } = await supabase
        .from("customers")
        .update({
          name,
          phone,
          email: email || null,
          notes: value.notes.trim() || null,
        })
        .eq("id", value.id)
        .eq("establishment_id", membership.establishmentId);
      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      setEditingCustomer(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const savePlan = useMutation({
    mutationFn: async (value: PlanDraft) => {
      const duration = value.durationLimitMinutes.trim() === "" ? null : Number(value.durationLimitMinutes);
      if (value.name.trim().length < 2) throw new Error("Informe um nome válido para o plano.");
      if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
        throw new Error("A duração máxima deve ser um número inteiro maior que zero.");
      }

      let planId = value.id;
      const payload = {
        establishment_id: membership.establishmentId,
        name: value.name.trim(),
        description: value.description.trim() || null,
        duration_limit_minutes: duration,
        active: value.active,
      };

      if (planId) {
        const { error: updateError } = await supabase
          .from("customer_plans")
          .update(payload)
          .eq("id", planId)
          .eq("establishment_id", membership.establishmentId);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("customer_plans")
          .insert(payload)
          .select("id")
          .single();
        if (insertError || !data) throw insertError ?? new Error("Não foi possível criar o plano.");
        planId = data.id;
      }

      const { error: deleteError } = await supabase
        .from("customer_plan_services")
        .delete()
        .eq("plan_id", planId);
      if (deleteError) throw deleteError;

      if (value.serviceIds.length > 0) {
        const { error: linkError } = await supabase.from("customer_plan_services").insert(
          value.serviceIds.map((service_id) => ({ plan_id: planId!, service_id })),
        );
        if (linkError) throw linkError;
      }
    },
    onSuccess: async () => {
      setPlanDraft(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-customer-plans"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const assignPlan = useMutation({
    mutationFn: async () => {
      if (!assigningCustomer) throw new Error("Selecione um cliente.");
      if (!assignPlanId) {
        const { error: deleteError } = await supabase
          .from("customer_plan_assignments")
          .delete()
          .eq("customer_id", assigningCustomer.id);
        if (deleteError) throw deleteError;
        return;
      }

      const chosenPlan = plans.find((plan) => plan.id === assignPlanId);
      if (!chosenPlan || !chosenPlan.active) throw new Error("Selecione um plano ativo.");

      const existing = await supabase
        .from("customer_plan_assignments")
        .select("id")
        .eq("customer_id", assigningCustomer.id);
      if (existing.error) throw existing.error;
      if ((existing.data ?? []).length > 0) {
        const { error: deleteError } = await supabase
          .from("customer_plan_assignments")
          .delete()
          .eq("customer_id", assigningCustomer.id);
        if (deleteError) throw deleteError;
      }

      const { error: insertError } = await supabase.from("customer_plan_assignments").insert({
        customer_id: assigningCustomer.id,
        plan_id: assignPlanId,
        starts_at: new Date().toISOString(),
        expires_at: assignExpiresAt ? new Date(`${assignExpiresAt}T23:59:59`).toISOString() : null,
      });
      if (insertError) throw insertError;
    },
    onSuccess: async () => {
      setAssigningCustomer(null);
      setAssignPlanId("");
      setAssignExpiresAt("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-customers"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const customers = customersQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const services = servicesQuery.data ?? [];

  const activePlans = useMemo(() => plans.filter((plan) => plan.active), [plans]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLocaleLowerCase("pt-BR");
    return customers.filter((customer) => {
      const matchesSearch =
        query.length === 0 ||
        [customer.name, customer.phone, customer.email, customer.planName]
          .filter(Boolean)
          .some((value) => value!.toLocaleLowerCase("pt-BR").includes(query));
      const matchesPlan =
        customerPlanFilter === "all" ||
        (customerPlanFilter === "none" ? !customer.planId : customer.planId === customerPlanFilter);
      return matchesSearch && matchesPlan;
    });
  }, [customerPlanFilter, customerSearch, customers]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes e planos</h1>
        <p className="text-sm text-muted-foreground">Gerencie clientes e regras de atendimento por plano.</p>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setView("customers")}
          className={`rounded-md px-3 py-1.5 text-sm ${view === "customers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
        >
          Clientes
        </button>
        <button
          type="button"
          onClick={() => setView("plans")}
          className={`rounded-md px-3 py-1.5 text-sm ${view === "plans" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}
        >
          Planos
        </button>
      </div>

      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {view === "customers" ? (
        <div className="space-y-3">
          <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_220px_auto]">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Buscar cliente</span>
              <input
                type="search"
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="Nome, telefone, e-mail ou plano"
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-foreground">Filtrar por plano</span>
              <select
                value={customerPlanFilter}
                onChange={(event) => setCustomerPlanFilter(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="all">Todos os planos</option>
                <option value="none">Sem plano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}{plan.active ? "" : " (inativo)"}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setCustomerSearch("");
                  setCustomerPlanFilter("all");
                }}
                className="w-full rounded-md border border-input px-4 py-2 text-sm sm:w-auto"
              >
                Limpar filtros
              </button>
            </div>
          </div>

          {editingCustomer ? (
            <form
              className="space-y-4 rounded-xl border border-primary/20 bg-card p-4"
              onSubmit={(event) => {
                event.preventDefault();
                saveCustomer.mutate(editingCustomer);
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">Editar cliente</h2>
                  <p className="text-xs text-muted-foreground">Atualize os dados usados no atendimento e nas notificações.</p>
                </div>
                <button type="button" onClick={() => setEditingCustomer(null)} className="text-xs underline">Fechar</button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-foreground">Nome</span>
                  <input required minLength={2} value={editingCustomer.name} onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-foreground">Telefone/WhatsApp</span>
                  <input required minLength={8} value={editingCustomer.phone} onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-foreground">E-mail</span>
                  <input type="email" value={editingCustomer.email} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-foreground">Observações</span>
                  <input value={editingCustomer.notes} onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })} placeholder="Preferências, observações..." className="w-full rounded-md border border-input bg-background px-3 py-2" />
                </label>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={saveCustomer.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{saveCustomer.isPending ? "Salvando…" : "Salvar cliente"}</button>
              </div>
            </form>
          ) : null}

          <section className="overflow-x-auto rounded-xl border border-border bg-card">
            {customersQuery.isPending ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
            ) : customers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum cliente ainda.</p>
            ) : filteredCustomers.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhum cliente corresponde aos filtros atuais.</p>
            ) : (
              <>
                <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Mostrando {filteredCustomers.length} de {customers.length} cliente(s)</div>
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Nome</th>
                      <th className="px-3 py-2">Telefone</th>
                      <th className="px-3 py-2">E-mail</th>
                      <th className="px-3 py-2">Plano</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="px-3 py-2 font-medium text-foreground">{customer.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{customer.phone ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{customer.email ?? "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{customer.planName ?? "Sem plano"}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() => setEditingCustomer({ id: customer.id, name: customer.name, phone: customer.phone ?? "", email: customer.email ?? "", notes: customer.notes ?? "" })}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs underline"
                              onClick={() => {
                                setAssigningCustomer(customer);
                                setAssignPlanId(customer.planId ?? "");
                              }}
                            >
                              Alterar plano
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Planos de clientes</h2>
              <p className="text-xs text-muted-foreground">Sem limite de duração, o plano permite qualquer serviço. Quando houver limite, o serviço precisa caber nele.</p>
            </div>
            <button type="button" onClick={() => setPlanDraft({ ...EMPTY_PLAN })} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Novo plano</button>
          </div>

          {planDraft ? (
            <form className="space-y-4 rounded-xl border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); savePlan.mutate(planDraft); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm"><span className="font-medium text-foreground">Nome</span><input required value={planDraft.name} onChange={(e) => setPlanDraft({ ...planDraft, name: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
                <label className="space-y-1 text-sm"><span className="font-medium text-foreground">Duração máxima (minutos)</span><input type="number" min={1} step={1} value={planDraft.durationLimitMinutes} onChange={(e) => setPlanDraft({ ...planDraft, durationLimitMinutes: e.target.value })} placeholder="Ex.: 60" className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              </div>
              <label className="block space-y-1 text-sm"><span className="font-medium text-foreground">Descrição</span><textarea rows={3} value={planDraft.description} onChange={(e) => setPlanDraft({ ...planDraft, description: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
              <fieldset className="space-y-2"><legend className="text-sm font-medium text-foreground">Serviços permitidos</legend><p className="text-xs text-muted-foreground">Deixe todos desmarcados para permitir qualquer serviço.</p><div className="flex flex-wrap gap-2">{services.map((service) => { const checked = planDraft.serviceIds.includes(service.id); return <label key={service.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${checked ? "border-primary bg-primary/10" : "border-input"}`}><input type="checkbox" className="sr-only" checked={checked} onChange={() => setPlanDraft({ ...planDraft, serviceIds: checked ? planDraft.serviceIds.filter((id) => id !== service.id) : [...planDraft.serviceIds, service.id] })} />{service.name}</label>; })}</div></fieldset>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planDraft.active} onChange={(e) => setPlanDraft({ ...planDraft, active: e.target.checked })} /><span className="text-foreground">Plano ativo</span></label>
              <div className="flex gap-2"><button type="submit" disabled={savePlan.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{savePlan.isPending ? "Salvando…" : "Salvar plano"}</button><button type="button" onClick={() => setPlanDraft(null)} className="rounded-md border border-input px-4 py-2 text-sm">Cancelar</button></div>
            </form>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            {plans.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum plano criado.</p> : plans.map((plan) => (
              <article key={plan.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2"><h3 className="font-medium text-foreground">{plan.name}</h3><span className="text-xs text-muted-foreground">{plan.active ? "Ativo" : "Inativo"}</span></div>
                {plan.description ? <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p> : null}
                <p className="mt-2 text-xs text-muted-foreground">{plan.duration_limit_minutes ? `Até ${plan.duration_limit_minutes} min` : "Sem limite de duração"}{plan.serviceIds.length > 0 ? ` · ${plan.serviceIds.length} serviço(s)` : " · Todos os serviços"}</p>
                <button type="button" className="mt-3 text-xs underline" onClick={() => setPlanDraft({ id: plan.id, name: plan.name, description: plan.description ?? "", durationLimitMinutes: plan.duration_limit_minutes?.toString() ?? "", active: plan.active, serviceIds: plan.serviceIds })}>Editar</button>
              </article>
            ))}
          </div>
        </div>
      )}

      {assigningCustomer ? (
        <div className="rounded-xl border border-primary/20 bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-foreground">Plano de {assigningCustomer.name}</h2><p className="text-xs text-muted-foreground">A atribuição passa a valer imediatamente.</p></div><button type="button" onClick={() => setAssigningCustomer(null)} className="text-xs underline">Fechar</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm"><span className="font-medium text-foreground">Plano</span><select value={assignPlanId} onChange={(e) => setAssignPlanId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2"><option value="">Sem plano</option>{activePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
            <label className="space-y-1 text-sm"><span className="font-medium text-foreground">Validade até (opcional)</span><input type="date" value={assignExpiresAt} onChange={(e) => setAssignExpiresAt(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2" /></label>
          </div>
          <div className="mt-4 flex justify-end"><button type="button" onClick={() => assignPlan.mutate()} disabled={assignPlan.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{assignPlan.isPending ? "Salvando…" : "Salvar plano do cliente"}</button></div>
        </div>
      ) : null}
    </div>
  );
}
