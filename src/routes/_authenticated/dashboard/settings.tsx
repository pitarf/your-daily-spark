import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useEstablishment } from "@/lib/auth/establishment-context";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  component: SettingsPage,
});

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

type BreakDraft = {
  startTime: string;
  endTime: string;
};

type DayDraft = {
  weekday: number;
  id: string | null;
  active: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakDraft[];
};

type ExceptionRow = {
  id: string;
  date: string;
  type: "closed" | "custom_hours";
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

function createDefaultDrafts(): DayDraft[] {
  return WEEKDAYS.map((_, weekday) => ({
    weekday,
    id: null,
    active: false,
    startTime: "09:00",
    endTime: "18:00",
    breaks: [],
  }));
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function draftsFromSchedules(schedules: any[]): DayDraft[] {
  const drafts = createDefaultDrafts();
  for (const schedule of schedules) {
    if (schedule.professional_id !== null) continue;
    const weekday = Number(schedule.weekday);
    if (weekday < 0 || weekday > 6) continue;
    drafts[weekday] = {
      weekday,
      id: schedule.id,
      active: Boolean(schedule.active),
      startTime: schedule.start_time.slice(0, 5),
      endTime: schedule.end_time.slice(0, 5),
      breaks: ((schedule.schedule_breaks ?? []) as { start_time: string; end_time: string }[]).map((item) => ({
        startTime: item.start_time.slice(0, 5),
        endTime: item.end_time.slice(0, 5),
      })),
    };
  }
  return drafts;
}

function SettingsPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [drafts, setDrafts] = useState<DayDraft[]>(createDefaultDrafts);
  const [hydratedEstablishment, setHydratedEstablishment] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionReason, setExceptionReason] = useState("");

  const query = useQuery({
    queryKey: ["admin-settings", membership.establishmentId],
    queryFn: async () => {
      const [establishment, schedules, exceptions] = await Promise.all([
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
        supabase
          .from("schedule_exceptions")
          .select("id, date, type, start_time, end_time, reason")
          .eq("establishment_id", membership.establishmentId)
          .is("professional_id", null)
          .order("date"),
      ]);
      if (establishment.error) throw establishment.error;
      if (schedules.error) throw schedules.error;
      if (exceptions.error) throw exceptions.error;
      return {
        establishment: establishment.data,
        schedules: schedules.data ?? [],
        exceptions: (exceptions.data ?? []) as ExceptionRow[],
      };
    },
  });

  useEffect(() => {
    if (!query.data || hydratedEstablishment === membership.establishmentId) return;
    setDrafts(draftsFromSchedules(query.data.schedules));
    setHydratedEstablishment(membership.establishmentId);
  }, [query.data, membership.establishmentId, hydratedEstablishment]);

  const saveSchedules = useMutation({
    mutationFn: async () => {
      const errors: string[] = [];

      for (const draft of drafts) {
        if (!draft.active && !draft.id) continue;
        if (draft.active && timeToMinutes(draft.endTime) <= timeToMinutes(draft.startTime)) {
          errors.push(`${WEEKDAYS[draft.weekday]}: o fim deve ser depois do início.`);
          continue;
        }
        if (draft.active) {
          const scheduleStart = timeToMinutes(draft.startTime);
          const scheduleEnd = timeToMinutes(draft.endTime);
          for (const [index, item] of draft.breaks.entries()) {
            if (timeToMinutes(item.endTime) <= timeToMinutes(item.startTime)) {
              errors.push(`${WEEKDAYS[draft.weekday]}: intervalo ${index + 1} inválido.`);
              continue;
            }
            if (
              timeToMinutes(item.startTime) < scheduleStart ||
              timeToMinutes(item.endTime) > scheduleEnd
            ) {
              errors.push(`${WEEKDAYS[draft.weekday]}: intervalo deve ficar dentro do expediente.`);
            }
          }
        }
      }

      if (errors.length > 0) throw new Error(errors.join(" "));

      for (const draft of drafts) {
        if (!draft.active && !draft.id) continue;

        let scheduleId = draft.id;
        if (scheduleId) {
          const { error } = await supabase
            .from("weekly_schedules")
            .update({
              weekday: draft.weekday,
              start_time: draft.startTime,
              end_time: draft.endTime,
              active: draft.active,
            })
            .eq("id", scheduleId)
            .eq("establishment_id", membership.establishmentId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("weekly_schedules")
            .insert({
              establishment_id: membership.establishmentId,
              weekday: draft.weekday,
              start_time: draft.startTime,
              end_time: draft.endTime,
              active: draft.active,
              professional_id: null,
            })
            .select("id")
            .single();
          if (error || !data) throw error ?? new Error("Não foi possível criar o horário.");
          scheduleId = data.id;
          setDrafts((current) =>
            current.map((item) =>
              item.weekday === draft.weekday ? { ...item, id: data.id } : item,
            ),
          );
        }

        await supabase.from("schedule_breaks").delete().eq("weekly_schedule_id", scheduleId);

        if (draft.active && draft.breaks.length > 0) {
          const { error } = await supabase.from("schedule_breaks").insert(
            draft.breaks.map((item) => ({
              weekly_schedule_id: scheduleId,
              start_time: item.startTime,
              end_time: item.endTime,
            })),
          );
          if (error) throw error;
        }
      }
    },
    onSuccess: async () => {
      setSaveError(null);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["admin-settings", membership.establishmentId] });
      window.setTimeout(() => setSaved(false), 1800);
    },
    onError: (error) => {
      setSaved(false);
      setSaveError(error instanceof Error ? error.message : "Não foi possível salvar a agenda.");
    },
  });

  const addException = useMutation({
    mutationFn: async () => {
      if (!exceptionDate) throw new Error("Escolha uma data.");
      const { error } = await supabase.from("schedule_exceptions").insert({
        establishment_id: membership.establishmentId,
        date: exceptionDate,
        type: "closed",
        reason: exceptionReason.trim() || null,
        professional_id: null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setExceptionDate("");
      setExceptionReason("");
      await queryClient.invalidateQueries({ queryKey: ["admin-settings", membership.establishmentId] });
    },
  });

  const deleteException = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("schedule_exceptions")
        .delete()
        .eq("id", id)
        .eq("establishment_id", membership.establishmentId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-settings", membership.establishmentId] });
    },
  });

  if (query.isPending) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (query.isError) return <p className="text-sm text-destructive">Não foi possível carregar.</p>;

  const est = query.data?.establishment;
  const publicPath = est?.slug ? `/schedule?slug=${encodeURIComponent(est.slug)}` : "/schedule";
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}${publicPath}` : publicPath;
  const individualSchedules = (query.data?.schedules ?? []).filter((item) => item.professional_id !== null);
  const exceptions = query.data?.exceptions ?? [];

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function updateDay(weekday: number, patch: Partial<DayDraft>) {
    setDrafts((current) =>
      current.map((item) => (item.weekday === weekday ? { ...item, ...patch } : item)),
    );
    setSaveError(null);
    setSaved(false);
  }

  function addBreak(weekday: number) {
    setDrafts((current) =>
      current.map((item) =>
        item.weekday === weekday
          ? { ...item, breaks: [...item.breaks, { startTime: "12:00", endTime: "13:00" }] }
          : item,
      ),
    );
  }

  function removeBreak(weekday: number, breakIndex: number) {
    setDrafts((current) =>
      current.map((item) =>
        item.weekday === weekday
          ? { ...item, breaks: item.breaks.filter((_, index) => index !== breakIndex) }
          : item,
      ),
    );
  }

  function updateBreak(weekday: number, breakIndex: number, patch: Partial<BreakDraft>) {
    setDrafts((current) =>
      current.map((item) =>
        item.weekday === weekday
          ? {
              ...item,
              breaks: item.breaks.map((breakItem, index) =>
                index === breakIndex ? { ...breakItem, ...patch } : breakItem,
              ),
            }
          : item,
      ),
    );
    setSaveError(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground">Seu papel: {membership.role}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <h2 className="text-base font-semibold text-foreground">Estabelecimento</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Info label="Nome" value={est?.name} />
          <Info label="Tipo" value={est?.business_type} />
          <Info label="Fuso horário" value={est?.timezone} />
          <Info label="Telefone" value={est?.phone} />
          <Info label="E-mail" value={est?.email} />
          <Info label="Endereço" value={est?.address} />
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Link público da agenda</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Compartilhe este link com seus clientes para que eles façam o agendamento.
            </p>
          </div>
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
          >
            Abrir agenda
          </a>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={publicUrl}
            className="min-w-0 flex-1 rounded-md border border-input bg-muted/30 px-3 py-2 text-xs text-foreground"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            onClick={copyPublicLink}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            {copied ? "Copiado" : "Copiar link"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Horários de funcionamento</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure o expediente geral. Os intervalos são respeitados pelo motor de disponibilidade.
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveSchedules.mutate()}
            disabled={saveSchedules.isPending}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
          >
            {saveSchedules.isPending ? "Salvando…" : saved ? "Salvo" : "Salvar agenda"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {drafts.map((day) => (
            <div key={day.weekday} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-w-[110px] items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={day.active}
                    onChange={(e) => updateDay(day.weekday, { active: e.target.checked })}
                    className="h-4 w-4"
                  />
                  {WEEKDAYS[day.weekday]}
                </label>

                {day.active ? (
                  <>
                    <label className="text-xs text-muted-foreground">
                      Início
                      <input
                        type="time"
                        value={day.startTime}
                        onChange={(e) => updateDay(day.weekday, { startTime: e.target.value })}
                        className="ml-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                    <label className="text-xs text-muted-foreground">
                      Fim
                      <input
                        type="time"
                        value={day.endTime}
                        onChange={(e) => updateDay(day.weekday, { endTime: e.target.value })}
                        className="ml-2 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                      />
                    </label>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Fechado</span>
                )}
              </div>

              {day.active ? (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intervalos</span>
                    <button
                      type="button"
                      onClick={() => addBreak(day.weekday)}
                      className="rounded-md border border-input px-2.5 py-1 text-xs text-foreground hover:bg-accent"
                    >
                      + Adicionar intervalo
                    </button>
                  </div>

                  {day.breaks.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Sem intervalo.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {day.breaks.map((item, index) => (
                        <div key={`${day.weekday}-${index}`} className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            value={item.startTime}
                            onChange={(e) => updateBreak(day.weekday, index, { startTime: e.target.value })}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                          <span className="text-xs text-muted-foreground">até</span>
                          <input
                            type="time"
                            value={item.endTime}
                            onChange={(e) => updateBreak(day.weekday, index, { endTime: e.target.value })}
                            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                          />
                          <button
                            type="button"
                            onClick={() => removeBreak(day.weekday, index)}
                            className="rounded-md border border-input px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            Remover
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {saveError ? (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{saveError}</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Exceções e folgas</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Feche um dia específico sem alterar o expediente semanal.
          </p>
        </div>

        <form
          className="mt-4 grid gap-2 sm:grid-cols-[180px_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            addException.mutate();
          }}
        >
          <input
            required
            type="date"
            value={exceptionDate}
            onChange={(e) => setExceptionDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <input
            value={exceptionReason}
            onChange={(e) => setExceptionReason(e.target.value)}
            placeholder="Motivo opcional, ex.: feriado, folga, férias"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="submit"
            disabled={addException.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {addException.isPending ? "Adicionando…" : "Adicionar fechamento"}
          </button>
        </form>

        {addException.isError ? (
          <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {addException.error instanceof Error ? addException.error.message : "Não foi possível adicionar o fechamento."}
          </p>
        ) : null}

        {exceptions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nenhuma exceção cadastrada.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {exceptions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
                <span className="font-medium text-foreground">{formatDateOnly(item.date)}</span>
                <span className="text-muted-foreground">Fechado</span>
                {item.reason ? <span className="text-muted-foreground">{item.reason}</span> : null}
                <button
                  type="button"
                  onClick={() => deleteException.mutate(item.id)}
                  disabled={deleteException.isPending}
                  className="ml-auto rounded-md border border-input px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-60"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {individualSchedules.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-4 text-sm">
          <h2 className="text-base font-semibold text-foreground">Agendas individuais</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Existem horários específicos de profissionais. Eles continuam separados do expediente geral e serão editados na área de cada profissional.
          </p>
        </section>
      ) : null}
    </div>
  );
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value || "—"}</dd>
    </div>
  );
}
