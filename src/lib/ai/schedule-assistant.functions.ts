import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário inválido.");
const rangeSchema = z.object({
  start: timeSchema,
  end: timeSchema,
}).refine((value) => value.end > value.start, { message: "O fim deve ser depois do início." });

const daySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  windows: z.array(rangeSchema).max(4),
  breaks: z.array(rangeSchema).max(6),
});

export const schedulePlanSchema = z.object({
  days: z.array(daySchema).length(7),
  summary: z.string().trim().min(1).max(500),
  warnings: z.array(z.string().trim().min(1).max(240)).max(10),
});

const assistantInput = z.object({
  prompt: z.string().trim().min(5).max(3000),
  currentSchedule: z.string().max(12000).optional(),
});

const applyInput = z.object({
  accessToken: z.string().min(1),
  establishmentId: z.string().uuid(),
  confirm: z.literal(true),
  plan: schedulePlanSchema,
});

const DAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;

function getOpenAiConfig() {
  const apiKey = process.env["OPENAI_API_KEY"];
  const model = process.env["OPENAI_SCHEDULE_MODEL"] ?? "gpt-5.6-luna";
  if (!apiKey) throw new Error("OPENAI_API_KEY ainda não foi configurada no ambiente.");
  return { apiKey, model };
}

async function callOpenAI(prompt: string, currentSchedule?: string) {
  const { apiKey, model } = getOpenAiConfig();
  const system = [
    "Você é o assistente de agenda do Marca Minha Vez.",
    "Sua tarefa é converter a descrição em português do administrador em uma configuração de expediente geral.",
    "Use weekday 0 para domingo, 1 segunda, 2 terça, 3 quarta, 4 quinta, 5 sexta e 6 sábado.",
    "Sempre retorne exatamente um JSON válido, sem markdown, no formato:",
    JSON.stringify({
      days: [{ weekday: 1, enabled: true, windows: [{ start: "09:00", end: "18:00" }], breaks: [{ start: "12:00", end: "13:00" }] }],
      summary: "Resumo curto",
      warnings: ["Apenas avisos importantes"],
    }),
    "Inclua os sete dias, mesmo os fechados.",
    "Se houver um intervalo como 12 às 13, registre em breaks e mantenha a janela de atendimento maior.",
    "Se houver dois períodos, como 09 às 12 e 13 às 18, use duas windows e não invente break.",
    "Não invente dias ou horários que não possam ser inferidos. Em caso de ambiguidade, mantenha o melhor entendimento e registre um warning.",
    "Os horários são locais do estabelecimento e devem estar no formato HH:MM.",
    currentSchedule ? `Agenda atual para referência:\n${currentSchedule}` : "Nenhuma agenda atual foi informada.",
  ].join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "developer", content: [{ type: "input_text", text: system }] },
        { role: "user", content: [{ type: "input_text", text: prompt }] },
      ],
      max_output_tokens: 1800,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao consultar o assistente (${response.status}). ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };

  const outputText = payload.output_text?.trim() || payload.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text?.trim();

  if (!outputText) throw new Error("O assistente não retornou uma configuração válida.");
  return outputText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function validatePlan(plan: z.infer<typeof schedulePlanSchema>) {
  const weekdays = plan.days.map((day) => day.weekday);
  if (new Set(weekdays).size !== 7) throw new Error("A configuração precisa conter exatamente os sete dias da semana.");

  for (const day of plan.days) {
    if (!day.enabled && (day.windows.length > 0 || day.breaks.length > 0)) {
      throw new Error(`O dia ${DAY_NAMES[day.weekday]} está fechado, mas possui horários configurados.`);
    }
    for (const breakRange of day.breaks) {
      const fits = day.windows.some((window) => breakRange.start >= window.start && breakRange.end <= window.end);
      if (!fits) throw new Error(`O intervalo de ${DAY_NAMES[day.weekday]} precisa ficar dentro de uma janela de atendimento.`);
    }
  }
}

async function requireAdmin(establishmentId: string, accessToken: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("establishment_users")
    .select("role")
    .eq("establishment_id", establishmentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (membership?.role !== "admin") throw new Error("Somente administradores podem usar o assistente de agenda.");
  return userData.user;
}

export const analyzeScheduleWithAI = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => assistantInput.parse(data))
  .handler(async ({ data }) => {
    const raw = await callOpenAI(data.prompt, data.currentSchedule);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("O assistente retornou um formato inválido. Tente descrever a agenda novamente.");
    }

    const plan = schedulePlanSchema.parse(parsed);
    validatePlan(plan);
    return plan;
  });

export const applySchedulePlan = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applyInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.establishmentId, data.accessToken);
    validatePlan(data.plan);

    const { data: existingSchedules, error: existingError } = await supabaseAdmin
      .from("weekly_schedules")
      .select("id")
      .eq("establishment_id", data.establishmentId)
      .is("professional_id", null);
    if (existingError) throw existingError;

    if ((existingSchedules ?? []).length > 0) {
      const ids = existingSchedules.map((item) => item.id);
      const { error: deleteError } = await supabaseAdmin
        .from("weekly_schedules")
        .delete()
        .in("id", ids);
      if (deleteError) throw deleteError;
    }

    const rows = data.plan.days.flatMap((day) =>
      day.enabled
        ? day.windows.map((window) => ({
            establishment_id: data.establishmentId,
            professional_id: null,
            weekday: day.weekday,
            start_time: window.start,
            end_time: window.end,
            active: true,
          }))
        : [],
    );

    if (rows.length === 0) {
      return { ok: true as const, createdSchedules: 0, createdBreaks: 0, message: "Todos os dias foram configurados como fechados." };
    }

    const { data: createdSchedules, error: insertError } = await supabaseAdmin
      .from("weekly_schedules")
      .insert(rows)
      .select("id, weekday, start_time, end_time");
    if (insertError) throw insertError;

    const breaks = data.plan.days.flatMap((day) =>
      day.breaks.flatMap((breakRange) => {
        const matchingSchedules = (createdSchedules ?? []).filter(
          (schedule) => schedule.weekday === day.weekday && breakRange.start >= schedule.start_time && breakRange.end <= schedule.end_time,
        );
        return matchingSchedules.map((schedule) => ({
          weekly_schedule_id: schedule.id,
          start_time: breakRange.start,
          end_time: breakRange.end,
        }));
      }),
    );

    if (breaks.length > 0) {
      const { error: breakError } = await supabaseAdmin.from("schedule_breaks").insert(breaks);
      if (breakError) throw breakError;
    }

    return {
      ok: true as const,
      createdSchedules: createdSchedules?.length ?? 0,
      createdBreaks: breaks.length,
      message: "Expediente geral atualizado com sucesso.",
    };
  });
