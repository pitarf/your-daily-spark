import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import {
  getIntegrationStatus,
  sendTestBrevoEmail,
  testGeminiIntegration,
} from "@/lib/notifications/integration-test.functions";

export const Route = createFileRoute("/_authenticated/dashboard/integrations")({
  component: IntegrationsPage,
});

async function requireAccessToken() {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
  return data.session.access_token;
}

function IntegrationsPage() {
  const { membership } = useEstablishment();
  const getStatus = useServerFn(getIntegrationStatus);
  const sendTest = useServerFn(sendTestBrevoEmail);
  const testGemini = useServerFn(testGeminiIntegration);

  const statusQuery = useQuery({
    queryKey: ["integration-status", membership.establishmentId],
    queryFn: async () => {
      const accessToken = await requireAccessToken();
      return getStatus({ data: { accessToken, establishmentId: membership.establishmentId } });
    },
  });

  const brevoMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await requireAccessToken();
      return sendTest({ data: { accessToken, establishmentId: membership.establishmentId } });
    },
  });

  const geminiMutation = useMutation({
    mutationFn: async () => {
      const accessToken = await requireAccessToken();
      return testGemini({ data: { accessToken, establishmentId: membership.establishmentId } });
    },
  });

  if (membership.role !== "admin") {
    return <p className="text-sm text-muted-foreground">Somente administradores podem gerenciar integrações.</p>;
  }

  const brevoState = stateOf(
    statusQuery.data?.brevoConfigured,
    brevoMutation.isPending,
    brevoMutation.data?.ok,
    brevoMutation.isError,
  );
  const geminiState = stateOf(
    statusQuery.data?.geminiConfigured,
    geminiMutation.isPending,
    geminiMutation.data?.ok,
    geminiMutation.isError,
  );

  const brevoMessage = brevoMutation.data?.ok
    ? `E-mail de teste enviado para ${brevoMutation.data.recipient}.`
    : (brevoMutation.data?.error ??
      (brevoMutation.error instanceof Error ? brevoMutation.error.message : null));
  const geminiMessage = geminiMutation.data?.ok
    ? `Modelo ${geminiMutation.data.model} respondeu normalmente.`
    : (geminiMutation.data?.error ??
      (geminiMutation.error instanceof Error ? geminiMutation.error.message : null));

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Sistema</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Integrações</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Teste as integrações do ambiente. Nenhuma chave é exibida ou enviada para o navegador.
        </p>
      </header>

      {statusQuery.isPending ? <p className="text-sm text-muted-foreground">Verificando ambiente…</p> : null}
      {statusQuery.isError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Não foi possível verificar as integrações.
        </p>
      ) : null}

      {statusQuery.data ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-5">
            <IntegrationHeader title="Gemini" state={geminiState} />
            <p className="mt-2 text-sm text-muted-foreground">
              Assistente de agenda e interpretação de consultas em linguagem natural.
            </p>
            <div className="mt-4 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                Modelo: <strong className="text-foreground">{statusQuery.data.geminiModel}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => geminiMutation.mutate()}
              disabled={!statusQuery.data.geminiConfigured || geminiMutation.isPending}
              className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {geminiMutation.isPending ? "Testando…" : "Testar conexão"}
            </button>
            <TestResult ok={geminiMutation.data?.ok ?? (geminiMutation.isError ? false : null)} message={geminiMessage} />
            <p className="mt-2 text-xs text-muted-foreground">A chave não é exibida no painel.</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <IntegrationHeader title="Brevo" state={brevoState} />
            <p className="mt-2 text-sm text-muted-foreground">Confirmação, cancelamento e lembretes por e-mail.</p>
            <div className="mt-4 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">
              <p>
                Remetente: <strong className="text-foreground">{statusQuery.data.notificationFromEmail}</strong>
              </p>
              <p className="mt-1">
                Nome: <strong className="text-foreground">{statusQuery.data.notificationFromName}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => brevoMutation.mutate()}
              disabled={!statusQuery.data.brevoConfigured || brevoMutation.isPending}
              className="mt-4 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {brevoMutation.isPending ? "Enviando…" : "Enviar e-mail de teste"}
            </button>
            <TestResult ok={brevoMutation.data?.ok ?? (brevoMutation.isError ? false : null)} message={brevoMessage} />
            <p className="mt-2 text-xs text-muted-foreground">
              O teste é enviado somente para o e-mail da conta do administrador conectado.
            </p>
          </section>
        </div>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Próximas integrações</h2>
        <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p className="rounded-lg bg-muted/30 p-3">Google Login, aguardando habilitação no provedor de autenticação.</p>
          <p className="rounded-lg bg-muted/30 p-3">WhatsApp/SMS, aguardando definição do provedor.</p>
          <p className="rounded-lg bg-muted/30 p-3">Pagamentos, aguardando escolha do gateway.</p>
          <p className="rounded-lg bg-muted/30 p-3">Scheduler da fila Brevo, aguardando configuração de produção.</p>
        </div>
      </section>
    </section>
  );
}

type IntegrationState = "missing" | "configured" | "testing" | "ok" | "failed";

function stateOf(
  configured: boolean | undefined,
  pending: boolean,
  ok: boolean | undefined,
  errored: boolean,
): IntegrationState {
  if (!configured) return "missing";
  if (pending) return "testing";
  if (ok === true) return "ok";
  if (ok === false || errored) return "failed";
  return "configured";
}

const STATE_LABEL: Record<IntegrationState, string> = {
  missing: "Não configurado",
  configured: "Configurado",
  testing: "Testando…",
  ok: "Configurado e testado",
  failed: "Falha no teste",
};

function IntegrationHeader({ title, state }: { title: string; state: IntegrationState }) {
  const tone =
    state === "failed"
      ? "bg-destructive/10 text-destructive"
      : state === "ok" || state === "configured"
        ? "bg-primary/10 text-primary"
        : "bg-muted text-muted-foreground";

  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{STATE_LABEL[state]}</span>
    </div>
  );
}

function TestResult({ ok, message }: { ok: boolean | null | undefined; message: string | null | undefined }) {
  if (ok === null || ok === undefined || !message) return null;
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`mt-3 rounded-md px-3 py-2 text-xs ${ok ? "bg-emerald-500/10 text-foreground" : "bg-destructive/10 text-destructive"}`}
    >
      {message}
    </p>
  );
}
