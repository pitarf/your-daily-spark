import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

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
  hasCustomSchedule: boolean;
};

type ProfessionalDraft = {
  id: string | null;
  name: string;
  description: string;
  photo_url: string;
  active: boolean;
  serviceIds: string[];
};

type BreakDraft = { startTime: string; endTime: string };
type DayDraft = {
  weekday: number;
  id: string | null;
  active: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakDraft[];
};

type RawSchedule = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
  professional_id: string | null;
  schedule_breaks?: { start_time: string; end_time: string }[];
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const EMPTY: ProfessionalDraft = {
  id: null,
  name: "",
  description: "",
  photo_url: "",
  active: true,
  serviceIds: [],
};

function createDefaultDays(): DayDraft[] {
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

function formatTime(value: string) {
  return value.slice(0, 5);
}

function daysFromSchedules(schedules: RawSchedule[], fallback: RawSchedule[] = []): DayDraft[] {
  const general = new Map(fallback.map((item) => [item.weekday, item]));
  const specific = new Map(schedules.map((item) => [item.weekday, item]));
  return WEEKDAYS.map((_, weekday) => {
    const row = specific.get(weekday) ?? general.get(weekday);
    return {
      weekday,
      id: specific.get(weekday)?.id ?? null,
      active: Boolean(row?.active),
      startTime: formatTime(row?.start_time ?? "09:00"),
      endTime: formatTime(row?.end_time ?? "18:00"),
      breaks: (row?.schedule_breaks ?? []).map((item) => ({
        startTime: formatTime(item.start_time),
        endTime: formatTime(item.end_time),
      })),
    };
  });
}

function ProfessionalsPage() {
  const { membership } = useEstablishment();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfessionalDraft | null>(null);
  const [scheduleProfessionalId, setScheduleProfessionalId] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<DayDraft[]>(createDefaultDays);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

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

      const { data: customSchedules, error: scheduleErr } = await supabase
        .from("weekly_schedules")
        .select("professional_id, weekday")
        .eq("establishment_id", membership.establishmentId)
        .not("professional_id", "is", null);
      if (scheduleErr) throw scheduleErr;

      const customIds = new Set((customSchedules ?? []).map((row) => row.professional_id as string));
      return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        photo_url: p.photo_url,
        active: p.active,
        serviceIds: (
          (p as unknown as { professional_services: { service_id: string }[] }).professional_services ?? []
        ).map((l) => l.service_id),
        hasCustomSchedule: customIds.has(p.id),
      })) as Professional[];
    },
  });

  const save = useMutation({
    mutationFn: async (value: ProfessionalDraft) => {
      if (value.name.trim().length < 2) throw new Error("Informe um nome válido.");
      if (value.serviceIds.length === 0) throw new Error("Vincule pelo menos um serviço.");

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

      const { error: linkError } = await supabase
        .from("professional_services")
        .insert(value.serviceIds.map((service_id) => ({ professional_id: id!, service_id })));
      if (linkError) throw linkError;
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

  const generalScheduleQuery = useQuery({
    queryKey: ["admin-general-schedule", membership.establishmentId],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from("weekly_schedules")
        .select("id, weekday, start_time, end_time, active, professional_id, schedule_breaks(start_time, end_time)")
        .eq("establishment_id", membership.establishmentId)
        .is("professional_id", null)
        .order("weekday");
      if (err) throw err;
      return (data ?? []) as unknown as RawSchedule[];
    },
  });

  const selectedProfessional = useMemo(
    () => professionals.find((professional) => professional.id === scheduleProfessionalId) ?? null,
    [professionals, scheduleProfessionalId],
  );

  async function openSchedule(professionalId: string) {
    setScheduleProfessionalId(professionalId);
    setScheduleError(null);
    setScheduleSaved(false);
    setScheduleLoading(true);
    try {
      const { data, error: err } = await supabase
        .from("weekly_schedules")
        .select("id, weekday, start_time, end_time, active, professional_id, schedule_breaks(start_time, end_time)")
        .eq("establishment_id", membership.establishmentId)
        .eq("professional_id", professionalId)
        .order("weekday");
      if (err) throw err;
      setScheduleDrafts(daysFromSchedules((data ?? []) as unknown as RawSchedule[], generalScheduleQuery.data ?? []));
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "Não foi possível carregar a agenda.");
      setScheduleDrafts(createDefaultDays());
    } finally {
      setScheduleLoading(false);
    }
  }

  useEffect(() => {
    if (!scheduleProfessionalId || generalScheduleQuery.isPending) return;
    void openSchedule(scheduleProfessionalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalScheduleQuery.data, scheduleProfessionalId]);

  const saveSchedule = useMutation({
    mutationFn: async () => {
      if (!scheduleProfessionalId) throw new Error("Selecione um profissional.");
      const errors: string[] = [];

      for (const day of scheduleDrafts) {
        if (!day.active) continue;
        if (timeToMinutes(day.endTime) <= timeToMinutes(day.startTime)) {
          errors.push(`${WEEKDAYS[day.weekday]}: o fim deve ser depois do início.`);
        }
        const start = timeToMinutes(day.startTime);
        const end = timeToMinutes(day.endTime);
        day.breaks.forEach((item, index) => {
          const breakStart = timeToMinutes(item.startTime);
          const breakEnd = timeToMinutes(item.endTime);
          if (breakEnd <= breakStart || breakStart < start || breakEnd > end) {
            errors.push(`${WEEKDAYS[day.weekday]}: intervalo ${index + 1} inválido.`);
          }
        });
      }
      if (errors.length > 0) throw new Error(errors.join(" "));

      for (const day of scheduleDrafts) {
        let scheduleId = day.id;
        if (scheduleId) {
          const { error: updateError } = await supabase
            .from("weekly_schedules")
            .update({
              weekday: day.weekday,
              start_time: day.startTime,
              end_time: day.endTime,
              active: day.active,
            })
            .eq("id", scheduleId)
            .eq("establishment_id", membership.establishmentId)
            .eq("professional_id", scheduleProfessionalId);
          if (updateError) throw updateError;
        } else {
          const { data, error: insertError } = await supabase
            .from("weekly_schedules")
            .insert({
              establishment_id: membership.establishmentId,
              professional_id: scheduleProfessionalId,
              weekday: day.weekday,
              start_time: day.startTime,
              end_time: day.endTime,
              active: day.active,
            })
            .select("id")
            .single();
          if (insertError || !data) throw insertError ?? new Error("Não foi possível salvar a agenda.");
          scheduleId = data.id;
        }

        const { error: deleteBreaksError } = await supabase
          .from("schedule_breaks")
          .delete()
          .eq("weekly_schedule_id", scheduleId);
        if (deleteBreaksError) throw deleteBreaksError;

        if (day.active && day.breaks.length > 0) {
          const { error: breaksError } = await supabase.from("schedule_breaks").insert(
            day.breaks.map((item) => ({
              weekly_schedule_id: scheduleId!,
              start_time: item.startTime,
              end_time: item.endTime,
            })),
          );
          if (breaksError) throw breaksError;
        }
      }
    },
    onSuccess: async () => {
      setScheduleError(null);
      setScheduleSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["admin-professionals"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-general-schedule"] });
      window.setTimeout(() => setScheduleSaved(false), 1800);
    },
    onError: (err: Error) => {
      setScheduleSaved(false);
      setScheduleError(err.message);
    },
  });

  function updateDay(weekday: number, patch: Partial<DayDraft>) {
    setScheduleDrafts((current) =>
      current.map((item) => (item.weekday === weekday ? { ...item, ...patch } : item)),
    );
    setScheduleError(null);
    setScheduleSaved(false);
  }

  function addBreak(weekday: number) {
    setScheduleDrafts((current) =>
      current.map((item) =>
        item.weekday === weekday
          ? { ...item, breaks: [...item.breaks, { startTime: "12:00", endTime: "13:00" }] }
          : item,
      ),
    );
  }

  function updateBreak(weekday: number, index: number, patch: Partial<BreakDraft>) {
    setScheduleDrafts((current) =>
      current.map((item) =>
        item.weekday === weekday
          ? {
              ...item,
              breaks: item.breaks.map((breakItem, breakIndex) =>
                breakIndex === index ? { ...breakItem, ...patch } : breakItem,
              ),
            }
          : item,
      ),
    );
  }

  function removeBreak(weekday: number, index: number) {
    setScheduleDrafts((current) =>
      current.map((item) =>
        item.weekday === weekday
          ? { ...item, breaks: item.breaks.filter((_, breakIndex) => breakIndex !== index) }
          : item,
      ),
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profissionais</h1>
          <p className="text-sm text-muted-foreground">Equipe, serviços realizados e agenda individual.</p>
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
          <div className="grid gap-3 sm:grid-cols-2">
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
              <span className="font-medium text-foreground">Foto (link opcional)</span>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={draft.photo_url}
                onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
                placeholder="https://…"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Descrição</span>
            <textarea
              className="w-full rounded-md border border-input bg-background px-3 py-2"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
            />
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium text-foreground">Serviços que realiza</legend>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => {
                const checked = draft.serviceIds.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={`cursor-pointer rounded-full border px-3 py-1 ${checked ? "border-primary bg-primary/10" : "border-input"}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setDraft({
                          ...draft,
                          serviceIds: checked
                            ? draft.serviceIds.filter((id) => id !== service.id)
                            : [...draft.serviceIds, service.id],
                        })
                      }
                    />
                    {service.name}
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

      {scheduleProfessionalId && selectedProfessional ? (
        <section className="space-y-4 rounded-xl border border-primary/20 bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Agenda de {selectedProfessional.name}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                A agenda individual substitui a agenda geral nos dias em que houver uma configuração específica.
                Para fechar um dia específico deste profissional, deixe-o inativo aqui.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setScheduleProfessionalId(null)}
              className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Fechar
            </button>
          </div>

          {scheduleLoading ? (
            <p className="text-sm text-muted-foreground">Carregando agenda…</p>
          ) : (
            <>
              <div className="space-y-3">
                {scheduleDrafts.map((day) => (
                  <div key={day.weekday} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex min-w-[110px] items-center gap-2 text-sm font-medium text-foreground">
                        <input
                          type="checkbox"
                          checked={day.active}
                          onChange={(e) => updateDay(day.weekday, { active: e.target.checked })}
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
                        <span className="text-xs text-muted-foreground">Fechado para este profissional</span>
                      )}
                    </div>

                    {day.active ? (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Intervalos</span>
                          <button
                            type="button"
                            onClick={() => addBreak(day.weekday)}
                            className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-accent"
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

              {scheduleError ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{scheduleError}</p>
              ) : null}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => saveSchedule.mutate()}
                  disabled={saveSchedule.isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {saveSchedule.isPending ? "Salvando…" : scheduleSaved ? "Salvo" : "Salvar agenda individual"}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {query.isPending ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : professionals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
        ) : (
          professionals.map((professional) => (
            <article key={professional.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold text-foreground">
                  {professional.photo_url ? (
                    <img src={professional.photo_url} alt={professional.name} className="h-full w-full object-cover" />
                  ) : (
                    professional.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{professional.name}</p>
                  <p className="text-xs text-muted-foreground">{professional.active ? "Ativo" : "Inativo"}</p>
                </div>
                <button
                  type="button"
                  className="ml-auto text-xs underline"
                  onClick={() =>
                    setDraft({
                      id: professional.id,
                      name: professional.name,
                      description: professional.description ?? "",
                      photo_url: professional.photo_url ?? "",
                      active: professional.active,
                      serviceIds: professional.serviceIds,
                    })
                  }
                >
                  Editar
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {professional.serviceIds
                  .map((id) => services.find((service) => service.id === id)?.name)
                  .filter(Boolean)
                  .join(" · ") || "Sem serviços vinculados"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openSchedule(professional.id)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent"
                >
                  {professional.hasCustomSchedule ? "Editar agenda individual" : "Configurar agenda individual"}
                </button>
                {professional.hasCustomSchedule ? (
                  <span className="text-xs text-muted-foreground">Agenda personalizada ativa</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Usando agenda geral</span>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
