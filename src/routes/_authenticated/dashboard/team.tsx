import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { inviteProfessional, unlinkProfessional } from "@/lib/auth/team.functions";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/team")({
  component: TeamPage,
});

function TeamPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const canManage = membership.role === "admin";
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["team", membership.establishmentId],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("professionals")
        .select("id, name, description, photo_url, active, user_id")
        .eq("establishment_id", membership.establishmentId)
        .order("name");
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  const invite = useMutation({
    mutationFn: async (professionalId: string) => {
      const email = emails[professionalId]?.trim() ?? "";
      if (!email) throw new Error("Informe o e-mail do profissional.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      return inviteProfessional({ data: { establishmentId: membership.establishmentId, professionalId, email, accessToken } });
    },
    onSuccess: async (result) => {
      setError(null);
      setSuccess(result.message);
      setEmails((current) => ({ ...current, [result.message]: "" }));
      await queryClient.invalidateQueries({ queryKey: ["team", membership.establishmentId] });
      window.setTimeout(() => setSuccess(null), 3000);
    },
    onError: (mutationError) => {
      setSuccess(null);
      setError(mutationError instanceof Error ? mutationError.message : "Não foi possível enviar o convite.");
    },
  });

  const unlink = useMutation({
    mutationFn: async (professionalId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      return unlinkProfessional({ data: { establishmentId: membership.establishmentId, professionalId, accessToken } });
    },
    onSuccess: async () => {
      setError(null);
      setSuccess("Acesso do profissional removido.");
      await queryClient.invalidateQueries({ queryKey: ["team", membership.establishmentId] });
      window.setTimeout(() => setSuccess(null), 2500);
    },
    onError: (mutationError) => {
      setSuccess(null);
      setError(mutationError instanceof Error ? mutationError.message : "Não foi possível remover o acesso.");
    },
  });

  if (query.isPending) return <p className="text-sm text-muted-foreground">Carregando equipe…</p>;
  if (query.isError) return <p className="text-sm text-destructive">Não foi possível carregar a equipe.</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
        <p className="text-sm text-muted-foreground">Vincule profissionais a contas para dar acesso individual ao painel.</p>
      </div>

      {!canManage ? (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Somente administradores podem convidar ou remover acessos.</div>
      ) : null}
      {error ? <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      {success ? <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground" role="status">{success}</p> : null}

      {query.data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">Cadastre um profissional primeiro.</div>
      ) : (
        <div className="space-y-3">
          {query.data.map((professional) => {
            const linked = Boolean(professional.user_id);
            return (
              <article key={professional.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-foreground">
                    {professional.photo_url ? <img src={professional.photo_url} alt="" className="h-full w-full object-cover" /> : professional.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold text-foreground">{professional.name}</h2>
                    <p className="text-xs text-muted-foreground">{professional.description || "Sem descrição"}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${linked ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}>
                    {linked ? "Conta vinculada" : "Sem conta"}
                  </span>
                </div>

                {canManage && !linked ? (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={emails[professional.id] ?? ""}
                      onChange={(event) => setEmails((current) => ({ ...current, [professional.id]: event.target.value }))}
                      placeholder="email@profissional.com"
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <button type="button" disabled={invite.isPending} onClick={() => invite.mutate(professional.id)} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                      {invite.isPending ? "Enviando…" : "Enviar convite"}
                    </button>
                  </div>
                ) : null}

                {canManage && linked ? (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                    <p className="text-xs text-muted-foreground">O profissional pode entrar com sua própria conta neste estabelecimento.</p>
                    <button type="button" disabled={unlink.isPending} onClick={() => unlink.mutate(professional.id)} className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60">
                      Remover acesso
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
