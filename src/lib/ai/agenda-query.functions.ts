import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  computeAvailability,
  type AvailabilitySlot,
  type ScheduleExceptionInput,
  type WeeklyScheduleInput,
  zonedWallTimeToUtc,
} from "@/lib/scheduling/availability";

const queryInput = z.object({
  accessToken: z.string().min(1),
  establishmentId: z.string().uuid(),
  question: z.string().trim().min(3).max(1500),
});

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(2500),
  highlights: z.array(z.string().trim().min(1).max(240)).max(8),
});

const availabilityIntentSchema = z
  .object({
    intent: z.enum(["availability", "operational"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time_start: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
    time_end: z.string().regex(/^$|^([01]\d|2[0-3]):[0-5]\d$/),
    service_name: z.string().trim().max(160),
    professional_name: z.string().trim().max(160),
    duration_minutes: z.number().int().refine((value) => value === 0 || (value >= 15 && value <= 240 && value % 15 === 0)),
    clarification: z.string().trim().max(300),
  })
  .superRefine((value, context) => {
    if (value.time_start && value.time_end && value.time_end <= value.time_start) {
      context.addIssue({
        code: "custom",
        path: ["time_end"],
        message: "O fim do período precisa ser depois do início.",
      });
    }
  });

function getGeminiConfig() {
  const apiKey = process.env["GEMINI_API_KEY"];
  const model = process.env["GEMINI_QUERY_MODEL"] ?? process.env["GEMINI_SCHEDULE_MODEL"] ?? "gemini-2.5-flash-lite";
  if (!apiKey) throw new Error("GEMINI_API_KEY ainda não foi configurada no ambiente.");
  return { apiKey, model };
}

async function requireAdmin(establishmentId: string, accessToken: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user) throw new Error("Sua sessão expirou. Entre novamente.");

  const { data: membership, error } = await supabaseAdmin
    .from("establishment_users")
    .select("role")
    .eq("establishment_id", establishmentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (membership?.role !== "admin") throw new Error("Somente administradores podem consultar o assistente.");
}

function localDateContext(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  return {
    date: `${parts["year"]}-${parts["month"]}-${parts["day"]}`,
    weekday: parts["weekday"],
  };
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveUniqueName<T extends { name: string }>(query: string, options: T[]) {
  const normalized = normalizeName(query);
  if (!normalized) return { match: null as T | null, ambiguous: [] as T[] };

  const exact = options.filter((option) => normalizeName(option.name) === normalized);
  if (exact.length === 1) return { match: exact[0], ambiguous: [] as T[] };
  if (exact.length > 1) return { match: null as T | null, ambiguous: exact };

  const partial = options.filter((option) => {
    const candidate = normalizeName(option.name);
    return candidate.includes(normalized) || normalized.includes(candidate);
  });
  return partial.length === 1
    ? { match: partial[0], ambiguous: [] as T[] }
    : { match: null as T | null, ambiguous: partial };
}

async function parseQuestionWithGemini(params: {
  question: string;
  timeZone: string;
  services: Array<{ name: string; duration_minutes: number }>;
  professionals: Array<{ name: string }>;
}) {
  const { apiKey, model } = getGeminiConfig();
  const today = localDateContext(params.timeZone);
  const schema = {
    type: "object",
    properties: {
      intent: { type: "string", enum: ["availability", "operational"] },
      date: { type: "string", description: "Data local no estabelecimento, YYYY-MM-DD." },
      time_start: { type: "string", description: "Início da janela local HH:MM ou string vazia quando não informado." },
      time_end: { type: "string", description: "Fim da janela local HH:MM ou string vazia quando não informado." },
      service_name: { type: "string", description: "Nome do serviço solicitado ou string vazia." },
      professional_name: { type: "string", description: "Nome do profissional solicitado ou string vazia." },
      duration_minutes: { type: "integer", description: "Duração personalizada em minutos, múltiplo de 15, ou 0 quando não informada." },
      clarification: { type: "string", description: "Escreva uma pergunta curta de esclarecimento somente quando a intenção de disponibilidade estiver claramente incompleta; caso contrário, string vazia." },
    },
    required: ["intent", "date", "time_start", "time_end", "service_name", "professional_name", "duration_minutes", "clarification"],
  };

  const instruction = [
    "Você interpreta perguntas de um administrador sobre a agenda de um estabelecimento.",
    "Classifique como availability quando a pergunta pedir horários/vagas/disponibilidade.",
    "Classifique como operational para contagens, cadastros, bloqueios, agenda existente e outras consultas administrativas.",
    `Hoje no fuso do estabelecimento é ${today.date} (${today.weekday}).`,
    "Converta expressões como amanhã, depois de amanhã e dias da semana para uma data YYYY-MM-DD.",
    "Para um dia da semana sem data explícita, use a próxima ocorrência desse dia a partir de hoje.",
    "Para 'manhã', use 06:00-12:00. Para 'à tarde', use 12:00-18:00. Para 'à noite', use 18:00-23:00.",
    "Não invente nomes. Copie os nomes somente da lista fornecida.",
    "Não confunda plano do cliente com serviço.",
    `Serviços cadastrados: ${JSON.stringify(params.services)}`,
    `Profissionais cadastrados: ${JSON.stringify(params.professionals)}`,
    "Retorne somente JSON válido seguindo o schema.",
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{ text: `${instruction}\n\nPergunta:\n${params.question}` }],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 900,
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao interpretar a pergunta (${response.status}). ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("O assistente não retornou uma interpretação válida.");

  return availabilityIntentSchema.parse(JSON.parse(text));
}

function mapSchedule(row: {
  id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  active: boolean;
  schedule_breaks?: Array<{ start_time: string; end_time: string }>;
}): WeeklyScheduleInput {
  return {
    id: row.id,
    professional_id: row.professional_id,
    weekday: row.weekday,
    start_time: row.start_time,
    end_time: row.end_time,
    active: row.active,
    breaks: (row.schedule_breaks ?? []).map((item) => ({ start: item.start_time, end: item.end_time })),
  };
}

async function computeAssistantAvailability(params: {
  establishmentId: string;
  timezone: string;
  date: string;
  durationMinutes: number;
  professionalId: string | null;
  serviceId: string | null;
}) {
  const { establishmentId, timezone, date, durationMinutes, professionalId, serviceId } = params;

  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" })
    .format(zonedWallTimeToUtc(date, 12 * 60, timezone));

  const [schedulesResult, exceptionsResult, professionalsResult, linksResult] = await Promise.all([
    supabaseAdmin
      .from("weekly_schedules")
      .select("id, professional_id, weekday, start_time, end_time, active, schedule_breaks(start_time, end_time)")
      .eq("establishment_id", establishmentId),
    supabaseAdmin
      .from("schedule_exceptions")
      .select("professional_id, date, type, start_time, end_time")
      .eq("establishment_id", establishmentId)
      .eq("date", date),
    supabaseAdmin
      .from("professionals")
      .select("id, name, active")
      .eq("establishment_id", establishmentId)
      .eq("active", true)
      .order("name"),
    serviceId
      ? supabaseAdmin.from("professional_services").select("professional_id").eq("service_id", serviceId)
      : Promise.resolve({ data: [] as Array<{ professional_id: string }>, error: null }),
  ]);

  for (const result of [schedulesResult, exceptionsResult, professionalsResult, linksResult]) {
    if (result.error) throw result.error;
  }

  const allProfessionals = professionalsResult.data ?? [];
  const linkedIds = new Set((linksResult.data ?? []).map((item) => item.professional_id));
  const candidates = professionalId
    ? allProfessionals.filter((professional) => professional.id === professionalId)
    : allProfessionals.filter((professional) => serviceId ? linkedIds.has(professional.id) : true);

  if (candidates.length === 0) return { slots: [] as AvailabilitySlot[], professionalNames: [] as string[] };

  const dayStart = zonedWallTimeToUtc(date, 0, timezone);
  const dayEnd = zonedWallTimeToUtc(date, 24 * 60, timezone);

  const [appointmentsResult, blocksResult] = await Promise.all([
    supabaseAdmin
      .from("appointments")
      .select("starts_at, ends_at, professional_id")
      .eq("establishment_id", establishmentId)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString()),
    supabaseAdmin
      .from("blocked_slots")
      .select("starts_at, ends_at, professional_id")
      .eq("establishment_id", establishmentId)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString()),
  ]);

  if (appointmentsResult.error) throw appointmentsResult.error;
  if (blocksResult.error) throw blocksResult.error;

  const allBusy = [
    ...(appointmentsResult.data ?? []),
    ...(blocksResult.data ?? []),
  ];

  const computeForProfessional = (candidateId: string) =>
    computeAvailability({
      date,
      timezone,
      serviceDurationMinutes: durationMinutes,
      professionalId: candidateId,
      schedules: (schedulesResult.data ?? []).map(mapSchedule),
      exceptions: (exceptionsResult.data ?? []) as ScheduleExceptionInput[],
      busy: allBusy
        .filter((item) => item.professional_id === null || item.professional_id === candidateId)
        .map((item) => ({ startsAt: new Date(item.starts_at), endsAt: new Date(item.ends_at) })),
      now: new Date(),
    });

  const perProfessional = candidates.map((candidate) => ({
    candidate,
    slots: computeForProfessional(candidate.id).filter((slot) => slot.available),
  }));

  if (professionalId || perProfessional.length === 1) {
    const first = perProfessional[0];
    return { slots: first?.slots ?? [], professionalNames: first ? [first.candidate.name] : [] };
  }

  const merged = new Map<string, AvailabilitySlot>();
  for (const entry of perProfessional) {
    for (const slot of entry.slots) {
      if (!merged.has(slot.startsAt)) merged.set(slot.startsAt, slot);
    }
  }
  return {
    slots: [...merged.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    professionalNames: candidates.map((candidate) => candidate.name),
  };
}

function formatLocalDate(date: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(zonedWallTimeToUtc(date, 12 * 60, timezone));
}

async function answerAvailability(params: {
  intent: z.infer<typeof availabilityIntentSchema>;
  establishment: { id: string; name: string; timezone: string };
  services: Array<{ id: string; name: string; duration_minutes: number; price: number }>;
  professionals: Array<{ id: string; name: string }>;
}) {
  const { intent, establishment, services, professionals } = params;
  if (intent.clarification) {
    return {
      answer: intent.clarification,
      highlights: ["Informe o serviço para consultar os horários reais disponíveis."],
    };
  }

  const resolvedService = resolveUniqueName(intent.service_name, services);
  if (intent.service_name && resolvedService.ambiguous.length > 1) {
    return {
      answer: `Encontrei mais de um serviço parecido. Escolha um: ${resolvedService.ambiguous.map((item) => item.name).join(", ")}.`,
      highlights: ["A disponibilidade depende do serviço e da duração."],
    };
  }
  if (intent.service_name && !resolvedService.match) {
    return {
      answer: `Não encontrei um serviço chamado "${intent.service_name}" no cadastro do estabelecimento.`,
      highlights: services.slice(0, 6).map((item) => item.name),
    };
  }

  const resolvedProfessional = resolveUniqueName(intent.professional_name, professionals);
  if (intent.professional_name && resolvedProfessional.ambiguous.length > 1) {
    return {
      answer: `Encontrei mais de um profissional parecido. Escolha um: ${resolvedProfessional.ambiguous.map((item) => item.name).join(", ")}.`,
      highlights: ["Você pode perguntar novamente com o nome completo do profissional."],
    };
  }
  if (intent.professional_name && !resolvedProfessional.match) {
    return {
      answer: `Não encontrei um profissional chamado "${intent.professional_name}" no cadastro.`,
      highlights: professionals.slice(0, 6).map((item) => item.name),
    };
  }

  const service = resolvedService.match;
  const durationMinutes = intent.duration_minutes || service?.duration_minutes || 0;
  if (!durationMinutes) {
    return {
      answer: "Para consultar um horário livre, preciso saber qual serviço você quer agendar ou a duração do atendimento.",
      highlights: services.slice(0, 6).map((item) => `${item.name}, ${item.duration_minutes} min`),
    };
  }

  const result = await computeAssistantAvailability({
    establishmentId: establishment.id,
    timezone: establishment.timezone,
    date: intent.date,
    durationMinutes,
    professionalId: resolvedProfessional.match?.id ?? null,
    serviceId: service?.id ?? null,
  });

  let filteredSlots = result.slots;
  if (intent.time_start && intent.time_end) {
    filteredSlots = filteredSlots.filter((slot) => slot.label >= intent.time_start && slot.label < intent.time_end);
  }

  const dateLabel = formatLocalDate(intent.date, establishment.timezone);
  const serviceLabel = service?.name ?? `atendimento de ${durationMinutes} minutos`;
  const professionalLabel = resolvedProfessional.match?.name;
  const shown = filteredSlots.slice(0, 12).map((slot) => slot.label);

  if (shown.length === 0) {
    return {
      answer: `Não encontrei horários livres para ${serviceLabel}${professionalLabel ? ` com ${professionalLabel}` : ""} em ${dateLabel}.`,
      highlights: [
        intent.time_start && intent.time_end ? `Período consultado: ${intent.time_start} às ${intent.time_end}.` : "Consultei todo o expediente disponível.",
        professionalLabel ? `Profissional: ${professionalLabel}.` : "Busquei entre os profissionais que atendem esse serviço.",
      ],
    };
  }

  const remaining = filteredSlots.length - shown.length;
  return {
    answer: `Sim. Para ${serviceLabel}${professionalLabel ? ` com ${professionalLabel}` : ""} em ${dateLabel}, encontrei ${filteredSlots.length} horário${filteredSlots.length === 1 ? "" : "s"} livre${filteredSlots.length === 1 ? "" : "s"}: ${shown.join(", ")}${remaining > 0 ? ` e mais ${remaining}.` : "."}`,
    highlights: [
      `Duração: ${durationMinutes} minutos.`,
      professionalLabel ? `Profissional: ${professionalLabel}.` : "O horário pode ser atendido por um dos profissionais que realizam o serviço.",
    ],
  };
}

async function askGemini(question: string, context: string) {
  const { apiKey, model } = getGeminiConfig();
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: [
              "Você é o assistente administrativo do Marca Minha Vez.",
              "Responda perguntas sobre a operação do estabelecimento usando somente os dados fornecidos.",
              "Não invente informações e não revele telefone, e-mail ou outros dados pessoais de clientes.",
              "Se os dados não forem suficientes, diga claramente que não é possível determinar.",
              "Responda em português do Brasil, de forma direta.",
              "Retorne somente JSON válido com os campos answer e highlights.",
              "Pergunta do administrador:",
              question,
              "Dados disponíveis:",
              context,
            ].join("\n\n"),
          }],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              highlights: { type: "array", items: { type: "string" } },
            },
            required: ["answer", "highlights"],
          },
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao consultar o assistente (${response.status}). ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("O assistente não retornou uma resposta.");

  return answerSchema.parse(JSON.parse(text));
}

export const askAgendaAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => queryInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.establishmentId, data.accessToken);

    const { data: establishment, error: establishmentError } = await supabaseAdmin
      .from("establishments")
      .select("id,name,business_type,timezone")
      .eq("id", data.establishmentId)
      .single();
    if (establishmentError) throw establishmentError;

    const [professionalsResult, servicesResult] = await Promise.all([
      supabaseAdmin
        .from("professionals")
        .select("id,name,active")
        .eq("establishment_id", data.establishmentId)
        .order("name"),
      supabaseAdmin
        .from("services")
        .select("id,name,active,duration_minutes,price")
        .eq("establishment_id", data.establishmentId)
        .order("name"),
    ]);
    if (professionalsResult.error) throw professionalsResult.error;
    if (servicesResult.error) throw servicesResult.error;

    const professionals = professionalsResult.data ?? [];
    const services = (servicesResult.data ?? []).map((item) => ({ ...item, price: Number(item.price) }));

    const intent = await parseQuestionWithGemini({
      question: data.question,
      timeZone: establishment.timezone,
      services: services.map((item) => ({ name: item.name, duration_minutes: item.duration_minutes })),
      professionals: professionals.filter((item) => item.active).map((item) => ({ name: item.name })),
    });

    if (intent.intent === "availability") {
      return answerAvailability({
        intent,
        establishment,
        services,
        professionals: professionals.filter((item) => item.active),
      });
    }

    const now = new Date().toISOString();
    const horizon = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

    const [appointmentsResult, blocksResult] = await Promise.all([
      supabaseAdmin
        .from("appointments")
        .select("starts_at,ends_at,status,custom_title,custom_price,professionals(name),services(name,duration_minutes,price)")
        .eq("establishment_id", data.establishmentId)
        .gte("starts_at", now)
        .lt("starts_at", horizon)
        .order("starts_at")
        .limit(500),
      supabaseAdmin
        .from("blocked_slots")
        .select("starts_at,ends_at,reason,professionals(name)")
        .eq("establishment_id", data.establishmentId)
        .gte("ends_at", now)
        .lt("starts_at", horizon)
        .order("starts_at")
        .limit(300),
    ]);
    if (appointmentsResult.error) throw appointmentsResult.error;
    if (blocksResult.error) throw blocksResult.error;

    const context = JSON.stringify({
      estabelecimento: {
        name: establishment.name,
        business_type: establishment.business_type,
        timezone: establishment.timezone,
      },
      profissionais: professionals.map((item) => ({ name: item.name, active: item.active })),
      servicos: services,
      agendamentos_proximos_30_dias: appointmentsResult.data,
      bloqueios_proximos_30_dias: blocksResult.data,
    });

    return askGemini(data.question, context);
  });
