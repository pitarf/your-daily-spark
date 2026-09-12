import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";
import { analyzeScheduleWithAI, applySchedulePlan, type schedulePlanSchema } from "@/lib/ai/schedule-assistant.functions";
import { askAgendaAssistant } from "@/lib/ai/agenda-query.functions";

type SchedulePlan = ReturnType<typeof schedulePlanSchema.parse>;
type AssistantAnswer = {
  answer: string;
  highlights: string[];
  availability?: Array<{ label: string; url: string; professionalName?: string }>;
};

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export const Route = createFileRoute("/_authenticated/dashboard/assistant")({
  component: AssistantPage,
});

function AssistantPage() {
  const { membership } = useEstablishment();
  const [prompt, setPrompt] = useState("Estou disponível de segunda a sexta das 9 às 18, com intervalo das 12 às 13. No sábado das 9 às 14. Domingo fechado.");
  const [plan, setPlan] = useState<SchedulePlan | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);

  const analyze = useServerFn(analyzeScheduleWithAI);
  const apply = useServerFn(applySchedulePlan);
  const ask = useServerFn(askAgendaAssistant);

  const currentScheduleQuery = useQuery({
    queryKey: ["assistant-current-schedule", membership.establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_schedules")
        .select("weekday,start_time,end_time,active,schedule_breaks(start_time,end_time)")
        .eq("establishment_id", membership.establishmentId)
        .is("professional_id", null)
        .order("weekday")
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  const currentScheduleText = useMemo(() => {
    if (!currentScheduleQuery.data?.length) return "Nenhum expediente geral configurado.";
    return currentScheduleQuery.data
      .map((item) => {
        const breaks = ((item.schedule_breaks ?? []) as unknown as Array<{ start_time: string; end_time: string }>)
          .map((item) => `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`)
          .join(", ");
        return `${DAY_NAMES[item.weekday]}: ${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}${breaks ? ` (intervalos: ${breaks})` : ""}`;
      })
      .join("\n");
  }, [currentScheduleQuery.data]);

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      return analyze({
        data: {
          accessToken,
          establishmentId: membership.establishmentId,
          prompt,
          currentSchedule: currentScheduleText,
        },
      });
    },
    onSuccess: (result) => {
      setPlan(result);
      setAnalysisError(null);
      setApplyError(null);
      setConfirmed(false);
    },
    onError: (error) => setAnalysisError(error instanceof Error ? error.message : "Não foi possível analisar a agenda."),
  });

  const applyMutation = useMutation({
    mutationFn: async () => {
      if (!plan) throw new Error("Analise a agenda antes de aplicar.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      return apply({
        data: {
          accessToken,
          establishmentId: membership.establishmentId,
          confirm: true,
          plan,
        },
      });
    },
    onSuccess: async () => {
      setApplyError(null);
      setConfirmed(false);
      await currentScheduleQuery.refetch();
    },
    onError: (error) => setApplyError(error instanceof Error ? error.message : "Não foi possível aplicar a agenda."),
  });

  const queryMutation = useMutation({
    mutationFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente.");
      return ask({
        data: {
          accessToken,
          establishmentId: membership.establishmentId,
          question,
        },
      });
    },
    onSuccess: (result) => {
      setAnswer(result);
      setQueryError(null);
    },
    onError: (error) => setQueryError(error instanceof Error ? error.message : "Não foi possível consultar o assistente."),
  });

  const planByDay = new Map(plan?.days.map((day) => [day.weekday, day]) ?? []);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Assistente</p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">Configure sua agenda com linguagem natural</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Descreva como você trabalha normalmente. O assistente transforma a frase em uma prévia estruturada. Você revisa antes de aplicar.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Consulta operacional</p>
        <h2 className="mt-1 text-xl font-bold text-foreground">Pergunte sobre sua operação</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Consulte agenda, profissionais, serviços, bloqueios e agendamentos dos próximos 30 dias. A consulta é somente leitura.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && question.trim().length >= 3) queryMutation.mutate();
            }}
            maxLength={1500}
            className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground"
            placeholder="Ex.: tem horário livre amanhã à tarde para corte?"
          />
          <button
            type="button"
            onClick={() => queryMutation.mutate()}
            disabled={queryMutation.isPending || question.trim().length < 3}
            className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {queryMutation.isPending ? "Consultando…" : "Perguntar"}
          </button>
        </div>
        {queryError ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{queryError}</p> : null}
        {answer ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-sm leading-6 text-foreground">{answer.answer}</p>
            {answer.highlights.length ? (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {answer.highlights.map((highlight) => <li key={highlight}>• {highlight}</li>)}
              </ul>
            ) : null}
            {answer.availability?.length ? (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Horários encontrados</p>
                <div className="flex flex-wrap gap-2">
                  {answer.availability.map((slot) => (
                    <a
                      key={`${slot.label}-${slot.professionalName ?? "any"}`}
                      href={slot.url}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                    >
                      {slot.label}
                      {slot.professionalName ? <span className="text-xs font-normal text-muted-foreground">· {slot.professionalName}</span> : null}
                    </a>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Clique em um horário para abrir a agenda já com a data, serviço e horário sugeridos.</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">1. Explique seu horário</h2>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={10}
            maxLength={3000}
            className="mt-3 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm text-foreground"
            placeholder="Ex.: de terça a sábado das 8 às 19, almoço das 12 às 13:30..."
          />
          <button
            type="button"
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending || prompt.trim().length < 5}
            className="mt-3 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {analyzeMutation.isPending ? "Analisando…" : "Analisar agenda"}
          </button>
          {analysisError ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{analysisError}</p> : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Agenda atual</h2>
              <p className="mt-1 text-xs text-muted-foreground">Somente o expediente geral. Horários individuais dos profissionais não serão alterados.</p>
            </div>
          </div>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-muted/30 p-3 text-xs text-foreground">{currentScheduleText}</pre>
        </section>
      </div>

      {plan ? (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Prévia gerada</p>
              <h2 className="mt-1 text-xl font-bold text-foreground">{plan.summary}</h2>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-foreground">
              Revise antes de aplicar. A ação substitui apenas o expediente geral.
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-[110px_1fr] border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[150px_1fr]">
              <span>Dia</span><span>Horários</span>
            </div>
            {DAY_NAMES.map((name, weekday) => {
              const day = planByDay.get(weekday);
              return (
                <div key={name} className="grid grid-cols-[110px_1fr] border-b border-border px-3 py-3 last:border-b-0 sm:grid-cols-[150px_1fr]">
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <div className="text-sm text-muted-foreground">
                    {!day?.enabled ? "Fechado" : day.windows.length === 0 ? "Sem janela configurada" : day.windows.map((window) => `${window.start} às ${window.end}`).join(" · ")}
                    {day?.breaks.length ? <p className="mt-1 text-xs">Intervalos: {day.breaks.map((item) => `${item.start} às ${item.end}`).join(" · ")}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>

          {plan.warnings.length ? (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-sm font-medium text-foreground">Atenção</p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {plan.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
              </ul>
            </div>
          ) : null}

          <label className="mt-5 flex items-start gap-2 text-sm text-foreground">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" />
            <span>Confirmo que revisei a prévia e quero substituir o expediente geral por esta configuração.</span>
          </label>

          {applyError ? <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{applyError}</p> : null}

          <button
            type="button"
            disabled={!confirmed || applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
            className="mt-4 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {applyMutation.isPending ? "Aplicando…" : "Aplicar configuração"}
          </button>
          {applyMutation.isSuccess ? <p className="mt-3 text-sm text-foreground">Expediente geral atualizado. As agendas individuais dos profissionais permaneceram intactas.</p> : null}
        </section>
      ) : null}
    </section>
  );
}
