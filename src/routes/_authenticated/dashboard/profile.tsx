import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  component: ProfilePage,
});

const BUSINESS_TYPES = [
  "barbearia",
  "salão",
  "nail designer",
  "sobrancelhas",
  "estética",
  "clínica",
  "tatuagem",
  "consultório",
  "outro",
];

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Fortaleza",
  "America/Recife",
  "America/Manaus",
  "America/Belem",
  "America/Rio_Branco",
  "UTC",
];

type Draft = {
  name: string;
  description: string;
  businessType: string;
  timezone: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  logoUrl: string;
};

function ProfilePage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const canEdit = membership.role === "admin";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hydrated, setHydrated] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["establishment-profile", membership.establishmentId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("establishments")
        .select("name, slug, description, business_type, timezone, phone, whatsapp, email, address, logo_url")
        .eq("id", membership.establishmentId)
        .maybeSingle();
      if (queryError) throw queryError;
      return data;
    },
  });

  useEffect(() => {
    if (!query.data || hydrated === membership.establishmentId) return;
    setDraft({
      name: query.data.name ?? "",
      description: query.data.description ?? "",
      businessType: query.data.business_type ?? "outro",
      timezone: query.data.timezone ?? membership.timezone,
      phone: query.data.phone ?? "",
      whatsapp: query.data.whatsapp ?? "",
      email: query.data.email ?? "",
      address: query.data.address ?? "",
      logoUrl: query.data.logo_url ?? "",
    });
    setHydrated(membership.establishmentId);
  }, [query.data, membership.establishmentId, membership.timezone, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      if (!canEdit || !draft) throw new Error("Você não tem permissão para editar este estabelecimento.");
      if (draft.name.trim().length < 2) throw new Error("Informe um nome válido.");
      if (!draft.email.trim()) throw new Error("Informe um e-mail comercial.");

      const { error: updateError } = await supabase
        .from("establishments")
        .update({
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          business_type: draft.businessType,
          timezone: draft.timezone,
          phone: draft.phone.trim() || null,
          whatsapp: draft.whatsapp.trim() || null,
          email: draft.email.trim(),
          address: draft.address.trim() || null,
          logo_url: draft.logoUrl.trim() || null,
        })
        .eq("id", membership.establishmentId);
      if (updateError) throw updateError;
    },
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["establishment-profile", membership.establishmentId] });
      await queryClient.invalidateQueries({ queryKey: ["admin-settings", membership.establishmentId] });
      await queryClient.invalidateQueries({ queryKey: ["memberships"] });
      window.setTimeout(() => setSaved(false), 1800);
    },
    onError: (mutationError) => {
      setSaved(false);
      setError(mutationError instanceof Error ? mutationError.message : "Não foi possível salvar.");
    },
  });

  if (query.isPending) return <p className="text-sm text-muted-foreground">Carregando perfil…</p>;
  if (query.isError || !query.data) return <p className="text-sm text-destructive">Não foi possível carregar o perfil.</p>;

  const establishment = query.data;
  const publicPath = establishment.slug
    ? `/schedule?slug=${encodeURIComponent(establishment.slug)}`
    : "/schedule";

  function update(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setError(null);
    setSaved(false);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Perfil do estabelecimento</h1>
        <p className="text-sm text-muted-foreground">
          Essas informações compõem a identidade e a apresentação pública do seu negócio.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        {draft ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do estabelecimento" required>
              <input
                disabled={!canEdit}
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Tipo de negócio">
              <select
                disabled={!canEdit}
                value={draft.businessType}
                onChange={(e) => update({ businessType: e.target.value })}
                className={inputClass}
              >
                {BUSINESS_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <textarea
                disabled={!canEdit}
                rows={4}
                value={draft.description}
                onChange={(e) => update({ description: e.target.value })}
                className={inputClass}
                placeholder="Ex.: barbearia especializada em cortes masculinos e barba."
              />
            </Field>
            <Field label="Telefone">
              <input
                disabled={!canEdit}
                value={draft.phone}
                onChange={(e) => update({ phone: e.target.value })}
                autoComplete="tel"
                className={inputClass}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                disabled={!canEdit}
                value={draft.whatsapp}
                onChange={(e) => update({ whatsapp: e.target.value })}
                autoComplete="tel"
                className={inputClass}
              />
            </Field>
            <Field label="E-mail comercial" required>
              <input
                disabled={!canEdit}
                type="email"
                value={draft.email}
                onChange={(e) => update({ email: e.target.value })}
                autoComplete="email"
                className={inputClass}
              />
            </Field>
            <Field label="Fuso horário">
              <select
                disabled={!canEdit}
                value={draft.timezone}
                onChange={(e) => update({ timezone: e.target.value })}
                className={inputClass}
              >
                {!TIMEZONES.includes(draft.timezone) ? <option value={draft.timezone}>{draft.timezone}</option> : null}
                {TIMEZONES.map((timezone) => (
                  <option key={timezone} value={timezone}>{timezone}</option>
                ))}
              </select>
            </Field>
            <Field label="Endereço" className="sm:col-span-2">
              <input
                disabled={!canEdit}
                value={draft.address}
                onChange={(e) => update({ address: e.target.value })}
                autoComplete="street-address"
                className={inputClass}
              />
            </Field>
            <Field label="URL da logo" className="sm:col-span-2">
              <input
                disabled={!canEdit}
                type="url"
                value={draft.logoUrl}
                onChange={(e) => update({ logoUrl: e.target.value })}
                placeholder="https://..."
                className={inputClass}
              />
              {draft.logoUrl ? (
                <img
                  src={draft.logoUrl}
                  alt="Pré-visualização da logo"
                  className="mt-2 h-20 w-20 rounded-xl border border-border bg-muted object-contain p-2"
                />
              ) : null}
            </Field>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            Slug público: <span className="font-medium text-foreground">{establishment.slug || "—"}</span>
          </div>
          {canEdit ? (
            <button
              type="button"
              disabled={save.isPending || !draft}
              onClick={() => save.mutate()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? "Salvando…" : saved ? "Salvo" : "Salvar alterações"}
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {!canEdit ? (
          <p className="mt-3 text-xs text-muted-foreground">Somente administradores podem editar a identidade do estabelecimento.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Agenda pública</h2>
        <p className="mt-1 text-sm text-muted-foreground">Veja exatamente o endereço que seus clientes podem acessar.</p>
        <a
          href={publicPath}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
        >
          Abrir agenda pública
        </a>
      </section>
    </div>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  label,
  required,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-sm font-medium text-foreground">
        {label}{required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
