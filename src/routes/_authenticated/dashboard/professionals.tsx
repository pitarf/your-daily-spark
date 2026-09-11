import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/professionals")({
  component: ProfessionalsPage,
});

type Professional = {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  active: boolean;
  serviceIds: string[];
};

type Draft = {
  id: string | null;
  name: string;
  description: string;
  photo_url: string;
  active: boolean;
  serviceIds: string[];
};

const EMPTY: Draft = {
  id: null,
  name: "",
  description: "",
  photo_url: "",
  active: true,
  serviceIds: [],
};

function ProfessionalsPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["admin-services-min", membership.establishmentId],
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

  const query = useQuery({
    queryKey: ["admin-professionals", membership.establishmentId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("professionals")
        .select("id, name, description, photo_url, active, professional_services(service_id)")
        .eq("establishment_id", membership.establishmentId)
        .order("name");
      if (err) throw err;
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        photo_url: p.photo_url,
        active: p.active,
        serviceIds: (
          (p as unknown as { professional_services: { service_id: string }[] }).professional_services ?? []
        ).map((l) => l.service_id),
      })) as Professional[];
    },
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        establishment_id: membership.establishmentId,
        name: value.name.trim(),
        description: value.description.trim() || null,
        photo_url: value.photo_url.trim() || null,
        active: value.active,
      };
      let id = value.id;
      if (id) {
        const { error: err } = await supabase.from("professionals").update(payload).eq("id", id);
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase
          .from("professionals")
          .insert(payload)
          .select("id")
          .single();
        if (err || !data) throw err ?? new Error("Falha ao criar profissional.");
        id = data.id;
      }

      const { error: delError } = await supabase
        .from("professional_services")
        .delete()
        .eq("professional_id", id);
      if (delError) throw delError;

      if (value.serviceIds.length > 0) {
        const { error: linkError } = await supabase
          .from("professional_services")
          .insert(value.serviceIds.map((service_id) => ({ professional_id: id!, service_id })));
        if (linkError) throw linkError;
      }
    },
    onSuccess: async () => {
      setDraft(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const services = servicesQuery.data ?? [];
  const professionals = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-sm text-muted-foreground">Quem atende e quais serviços realiza.</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Novo profissional
        </button>
      </div>

      {draft ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Nome</span>
            <input
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Descrição</span>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Foto (link opcional)</span>
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.photo_url}
              onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-foreground">Serviços que realiza</legend>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => {
                const checked = draft.serviceIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 ${
                      checked ? "border-primary bg-primary/10" : "border-input"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          serviceIds: checked
                            ? draft.serviceIds.filter((id) => id !== s.id)
                            : [...draft.serviceIds, s.id],
                        })
                      }
                    />
                    {s.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            <span className="text-foreground">Ativo</span>
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {save.isPending ? "Salvando…" : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-md border border-input px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : professionals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
        ) : (
          professionals.map((p) => (
            <article key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    p.name.slice(0, 1)
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.active ? "Ativo" : "Inativo"}</p>
                </div>
                <button
                  type="button"
                  className="ml-auto text-xs underline"
                  onClick={() =>
                    setDraft({
                      id: p.id,
                      name: p.name,
                      description: p.description ?? "",
                      photo_url: p.photo_url ?? "",
                      active: p.active,
                      serviceIds: p.serviceIds,
                    })
                  }
                >
                  Editar
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {p.serviceIds
                  .map((id) => services.find((s) => s.id === id)?.name)
                  .filter(Boolean)
                  .join(" · ") || "Sem serviços vinculados"}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
