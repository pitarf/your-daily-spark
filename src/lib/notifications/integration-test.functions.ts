import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";
import { describeHttpFailure, toSafeIntegrationError } from "@/lib/integrations/secret-safe.server";

const authInput = z.object({
  accessToken: z.string().min(1),
  establishmentId: z.string().uuid(),
});

async function requireAdmin(establishmentId: string, accessToken: string) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData.user?.email) throw new Error("Sua sessão expirou. Entre novamente.");

  const { data: membership, error } = await supabaseAdmin
    .from("establishment_users")
    .select("role")
    .eq("establishment_id", establishmentId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (membership?.role !== "admin") throw new Error("Somente administradores podem testar integrações.");

  return { user: userData.user };
}

export const getIntegrationStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.establishmentId, data.accessToken);
    return {
      brevoConfigured: Boolean(process.env["BREVO_API_KEY"]),
      geminiConfigured: Boolean(process.env["GEMINI_API_KEY"]),
      geminiModel: process.env["GEMINI_SCHEDULE_MODEL"] ?? "gemini-3.5-flash-lite",
      notificationFromEmail: process.env["NOTIFICATION_FROM_EMAIL"] || "rfpita.work@gmail.com",
      notificationFromName: process.env["NOTIFICATION_FROM_NAME"]?.trim() || "Marca Minha Vez",
    };
  });

export const testGeminiIntegration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.establishmentId, data.accessToken);

    const apiKey = process.env["GEMINI_API_KEY"];
    const model = process.env["GEMINI_SCHEDULE_MODEL"] ?? "gemini-3.5-flash-lite";

    if (!apiKey) {
      return { ok: false as const, model, error: "GEMINI_API_KEY ainda não foi configurada no ambiente." };
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Responda apenas: ok" }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 8 },
          }),
        },
      );

      if (!response.ok) {
        // O corpo do provedor pode ecoar a chave; nunca é repassado ao navegador.
        await response.text().catch(() => "");
        return { ok: false as const, model, error: describeHttpFailure("O Gemini", response.status) };
      }

      await response.json();
      return { ok: true as const, model, error: null };
    } catch (error) {
      return {
        ok: false as const,
        model,
        error: toSafeIntegrationError(error, "Não foi possível contatar o Gemini."),
      };
    }
  });

export const sendTestBrevoEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authInput.parse(data))
  .handler(async ({ data }) => {
    const { user } = await requireAdmin(data.establishmentId, data.accessToken);
    const recipient = user.email;
    if (!recipient) {
      return { ok: false as const, recipient: null, error: "Sua conta não possui e-mail para receber o teste." };
    }

    try {
      await sendNotificationEmail({
        to: recipient,
        subject: "Teste de e-mail · Marca Minha Vez",
        text: "Este é um teste de integração do envio de e-mail do Marca Minha Vez via Brevo.",
        html: "<p>Este é um teste de integração do envio de e-mail do <strong>Marca Minha Vez</strong> via Brevo.</p><p>Se você recebeu esta mensagem, a chave e o remetente configurados no ambiente foram aceitos pela Brevo.</p>",
      });

      return { ok: true as const, recipient, error: null };
    } catch (error) {
      return {
        ok: false as const,
        recipient,
        error: toSafeIntegrationError(error, "A Brevo recusou o envio de teste."),
      };
    }
  });
