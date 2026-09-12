import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const queryInput = z.object({
  accessToken: z.string().min(1),
  establishmentId: z.string().uuid(),
  question: z.string().trim().min(3).max(1500),
});

const answerSchema = z.object({
  answer: z.string().trim().min(1).max(2500),
  highlights: z.array(z.string().trim().min(1).max(240)).max(8),
});

function getGeminiConfig() {
  const apiKey = process.env["GEMINI_API_KEY"];
  const model = process.env["GEMINI_SCHEDULE_MODEL"] ?? "gemini-2.5-flash-lite";
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

function isoDaysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
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

    const now = new Date().toISOString();
    const horizon = isoDaysFromNow(30);

    const [establishmentResult, professionalsResult, servicesResult, appointmentsResult, blocksResult] = await Promise.all([
      supabaseAdmin
        .from("establishments")
        .select("name,business_type,timezone")
        .eq("id", data.establishmentId)
        .single(),
      supabaseAdmin
        .from("professionals")
        .select("name,active")
        .eq("establishment_id", data.establishmentId)
        .order("name"),
      supabaseAdmin
        .from("services")
        .select("name,active,duration_minutes,price")
        .eq("establishment_id", data.establishmentId)
        .order("name"),
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

    for (const result of [establishmentResult, professionalsResult, servicesResult, appointmentsResult, blocksResult]) {
      if (result.error) throw result.error;
    }

    const context = JSON.stringify({
      estabelecimento: establishmentResult.data,
      profissionais: professionalsResult.data,
      servicos: servicesResult.data,
      agendamentos_proximos_30_dias: appointmentsResult.data,
      bloqueios_proximos_30_dias: blocksResult.data,
    });

    return askGemini(data.question, context);
  });
