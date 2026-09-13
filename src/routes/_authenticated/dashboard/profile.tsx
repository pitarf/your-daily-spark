import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { getBusinessTheme, getBusinessThemeWithPreset, getBusinessTypeLabel, type ThemePreset } from "@/lib/theming/business-theme";

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

const THEME_PRESETS: Array<{ value: ThemePreset; label: string; description: string }> = [
  { value: "auto", label: "Automático", description: "Usa o tema sugerido para o seu tipo de negócio." },
  { value: "minimal", label: "Minimalista", description: "Visual limpo, neutro e discreto." },
  { value: "soft", label: "Suave", description: "Visual leve, acolhedor e delicado." },
  { value: "bold", label: "Marcante", description: "Contraste maior e presença visual forte." },
  { value: "dark", label: "Escuro", description: "Base elegante com aparência mais sofisticada." },
  { value: "warm", label: "Quente", description: "Tons acolhedores para negócios de atendimento." },
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
  allowCustomDuration: boolean;
  themePreset: ThemePreset;
};

type EstablishmentProfile = {
  name: string;
  slug: string;
  description: string | null;
  business_type: string;
  timezone: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  allow_custom_duration: boolean;
  theme_preset: ThemePreset;
};

function ProfilePage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const canEdit = membership.role === "admin";
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hydrated, setHydrated] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["establishment-profile", membership.establishmentId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("establishments")
        .select("name, slug, description, business_type, timezone, phone, whatsapp, email, address, logo_url, allow_custom_duration, theme_preset")
        .eq("id", membership.establishmentId)
        .maybeSingle();
      if (queryError) throw queryError;
      return data as unknown as EstablishmentProfile | null;
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
      allowCustomDuration: Boolean(query.data.allow_custom_duration),
      themePreset: query.data.theme_preset ?? "auto",
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
          allow_custom_duration: draft.allowCustomDuration,
          theme_preset: draft.themePreset,
        } as never)
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
    ? `/agenda/${encodeURIComponent(establishment.slug)}`
    : "/schedule";
  const publicUrl = typeof window !== "undefined" ? new URL(publicPath, window.location.origin).toString() : publicPath;
  const previewTheme = getBusinessThemeWithPreset(draft?.businessType ?? establishment.business_type, draft?.themePreset ?? establishment.theme_preset);
  const autoTheme = getBusinessTheme(establishment.business_type);

  function update(patch: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setError(null);
    setSaved(false);
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setShareMessage("Link copiado.");
    } catch {
      setShareMessage("Não foi possível copiar automaticamente. Abra a agenda e copie o endereço do navegador.");
    }
    window.setTimeout(() => setShareMessage(null), 2500);
  }

  async function sharePublicLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: establishment.name, text: "Agende seu atendimento", url: publicUrl });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    await copyPublicLink();
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
              <input disabled={!canEdit} value={draft.name} onChange={(e) => update({ name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="Tipo de negócio">
              <select disabled={!canEdit} value={draft.businessType} onChange={(e) => update({ businessType: e.target.value })} className={inputClass}>
                {BUSINESS_TYPES.map((type) => <option key={type} value={type}>{getBusinessTypeLabel(type)}</option>)}
              </select>
            </Field>
            <Field label="Descrição" className="sm:col-span-2">
              <textarea disabled={!canEdit} rows={4} value={draft.description} onChange={(e) => update({ description: e.target.value })} className={inputClass} placeholder="Ex.: barbearia especializada em cortes masculinos e barba." />
            </Field>
            <Field label="Telefone">
              <input disabled={!canEdit} value={draft.phone} onChange={(e) => update({ phone: e.target.value })} autoComplete="tel" className={inputClass} />
            </Field>
            <Field label="WhatsApp">
              <input disabled={!canEdit} value={draft.whatsapp} onChange={(e) => update({ whatsapp: e.target.value })} autoComplete="tel" className={inputClass} />
            </Field>
            <Field label="E-mail comercial" required>
              <input disabled={!canEdit} type="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} autoComplete="email" className={inputClass} />
            </Field>
            <Field label="Fuso horário">
              <select disabled={!canEdit} value={draft.timezone} onChange={(e) => update({ timezone: e.target.value })} className={inputClass}>
                {!TIMEZONES.includes(draft.timezone) ? <option value={draft.timezone}>{draft.timezone}</option> : null}
                {TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
              </select>
            </Field>
            <Field label="Endereço" className="sm:col-span-2">
              <input disabled={!canEdit} value={draft.address} onChange={(e) => update({ address: e.target.value })} autoComplete="street-address" className={inputClass} />
            </Field>
            <Field label="URL da logo" className="sm:col-span-2">
              <input disabled={!canEdit} type="url" value={draft.logoUrl} onChange={(e) => update({ logoUrl: e.target.value })} placeholder="https://..." className={inputClass} />
              {draft.logoUrl ? <img src={draft.logoUrl} alt="Pré-visualização da logo" className="mt-2 h-20 w-20 rounded-xl border border-border bg-muted object-contain p-2" /> : null}
            </Field>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            Slug público: <span className="font-medium text-foreground">{establishment.slug || "—"}</span>
          </div>
          {canEdit ? (
            <button type="button" disabled={save.isPending || !draft} onClick={() => save.mutate()} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {save.isPending ? "Salvando…" : saved ? "Salvo" : "Salvar alterações"}
            </button>
          ) : null}
        </div>

        {error ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {!canEdit ? <p className="mt-3 text-xs text-muted-foreground">Somente administradores podem editar a identidade do estabelecimento.</p> : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-foreground">Tema da agenda pública</h2>
          <p className="text-sm text-muted-foreground">Escolha a aparência que seus clientes verão. O modo Automático usa a identidade sugerida para {getBusinessTypeLabel(draft?.businessType ?? establishment.business_type)}.</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEME_PRESETS.map((preset) => {
            const selected = draft?.themePreset === preset.value;
            const theme = preset.value === "auto" ? autoTheme : getBusinessThemeWithPreset(draft?.businessType ?? establishment.business_type, preset.value);
            return (
              <button
                key={preset.value}
                type="button"
                disabled={!canEdit}
                onClick={() => update({ themePreset: preset.value })}
                aria-pressed={selected}
                className={`rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${selected ? "border-primary ring-2 ring-primary/15" : "border-border hover:bg-accent"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: theme.primary }} aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">{preset.label}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{preset.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border" style={{ background: `linear-gradient(135deg, ${previewTheme.accent}, transparent)` }}>
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewTheme.primary }}>Pré-visualização</p>
            <div className="mt-2 flex items-center gap-3">
              {draft?.logoUrl ? <img src={draft.logoUrl} alt="" className="h-10 w-10 rounded-xl border border-border bg-background object-contain p-1" /> : <span className="h-10 w-10 rounded-xl" style={{ backgroundColor: previewTheme.primary }} aria-hidden="true" />}
              <div>
                <p className="font-semibold text-foreground">{draft?.name || establishment.name}</p>
                <p className="text-xs text-muted-foreground">{getBusinessTypeLabel(draft?.businessType ?? establishment.business_type)}</p>
              </div>
            </div>
            <button type="button" className="mt-4 rounded-md px-4 py-2 text-xs font-semibold" style={{ backgroundColor: previewTheme.primary, color: previewTheme.primaryForeground }}>Escolher horário</button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <input id="allow-custom-duration" type="checkbox" disabled={!canEdit || save.isPending} checked={Boolean(draft?.allowCustomDuration)} onChange={(event) => update({ allowCustomDuration: event.target.checked })} className="mt-1 h-4 w-4" />
          <div>
            <label htmlFor="allow-custom-duration" className="text-sm font-semibold text-foreground">Permitir agendamento personalizado</label>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Permite que o cliente altere a duração do serviço e também solicite um atendimento sem serviço pré-cadastrado. O motor continua respeitando expediente, intervalos, folgas, bloqueios, conflitos e limites do plano.</p>
            <p className="mt-2 text-xs font-medium text-foreground">Durações disponíveis: 15 minutos a 4 horas, em intervalos de 15 minutos.</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Agenda pública</h2>
            <p className="mt-1 text-sm text-muted-foreground">Veja exatamente o endereço que seus clientes podem acessar.</p>
            <p className="mt-2 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{publicUrl}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={publicPath} target="_blank" rel="noreferrer" className="inline-flex rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Abrir agenda</a>
            {canEdit ? <button type="button" onClick={() => void copyPublicLink()} className="inline-flex rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Copiar link</button> : null}
            {canEdit ? <button type="button" onClick={() => void sharePublicLink()} className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Compartilhar</button> : null}
          </div>
        </div>
        {shareMessage ? <p className="mt-3 text-xs font-medium text-primary" role="status">{shareMessage}</p> : null}
      </section>
    </div>
  );
}

const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-60";

function Field({ label, required, className = "", children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-1 ${className}`}>
      <span className="text-sm font-medium text-foreground">{label}{required ? <span className="text-destructive"> *</span> : null}</span>
      {children}
    </label>
  );
}