import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { formatPrice } from "@/lib/scheduling/format";

export const Route = createFileRoute("/_authenticated/dashboard/services")({
  component: ServicesPage,
});

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  active: boolean;
};

type Draft = {
  id: string | null;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  active: boolean;
};

const EMPTY: Draft = {
  id: null,
  name: "",
  description: "",
  duration_minutes: 30,
  price: 0,
  active: true,
};

function ServicesPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-services", membership.establishmentId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("services")
        .select("id, name, description, duration_minutes, price, active")
        .eq("establishment_id", membership.establishmentId)
        .order("name");
      if (err) throw err;
      return (data ?? []).map((s) => ({ ...s, price: Number(s.price) })) as Service[];
    },
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        establishment_id: membership.establishmentId,
        name: value.name.trim(),
        description: value.description.trim() || null,
        duration_minutes: value.duration_minutes,
        price: value.price,
        active: value.active,
      };
      const res = value.id
        ? await supabase.from("services").update(payload).eq("id", value.id)
        : await supabase.from("services").insert(payload);
      if (res.error) throw res.error;
    },
    onSuccess: async () => {
      setDraft(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-services"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggle = useMutation({
    mutationFn: async (service: Service) => {
      const { error: err } = await supabase
        .from("services")
        .update({ active: !service.active })
        .eq("id", service.id);
      if (err) throw err;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-services"] }),
  });

  const services = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
          <p className="text-sm text-muted-foreground">Dados reais do seu estabelecimento.</p>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ ...EMPTY })}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Novo serviço
        </button>
      </div>

      {draft ? (
        <form
          className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(draft);
          }}
        >
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-foreground">Nome</span>
            <input
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="font-medium text-foreground">Descrição</span>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Duração (minutos)</span>
            <input
              type="number"
              min={5}
              step={5}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.duration_minutes}
              onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) })}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-foreground">Preço (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            <span className="text-foreground">Ativo</span>
          </label>
          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2 sm:col-span-2">
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

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        {query.isPending ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
        ) : services.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhum serviço cadastrado.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Serviço</th>
                <th className="px-3 py-2">Duração</th>
                <th className="px-3 py-2">Preço</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {services.map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{s.name}</span>
                    {s.description ? (
                      <span className="block text-xs text-muted-foreground">{s.description}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.duration_minutes} min</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatPrice(s.price)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{s.active ? "Ativo" : "Inativo"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-2 text-xs underline"
                      onClick={() =>
                        setDraft({
                          id: s.id,
                          name: s.name,
                          description: s.description ?? "",
                          duration_minutes: s.duration_minutes,
                          price: s.price,
                          active: s.active,
                        })
                      }
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs underline"
                      onClick={() => toggle.mutate(s)}
                    >
                      {s.active ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
