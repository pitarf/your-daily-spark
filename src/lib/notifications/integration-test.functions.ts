import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendNotificationEmail } from "@/lib/notifications/email.server";

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
      notificationFromEmail: process.env["NOTIFICATION_FROM_EMAIL"] || "rfpita.work@gmail.com",
      notificationFromName: process.env["NOTIFICATION_FROM_NAME"]?.trim() || "Marca Minha Vez",
    };
  });

export const sendTestBrevoEmail = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => authInput.parse(data))
  .handler(async ({ data }) => {
    const { user } = await requireAdmin(data.establishmentId, data.accessToken);
    const recipient = user.email;
    if (!recipient) throw new Error("Sua conta não possui e-mail para receber o teste.");

    await sendNotificationEmail({
      to: recipient,
      subject: "Teste de e-mail · Marca Minha Vez",
      text: "Este é um teste de integração do envio de e-mail do Marca Minha Vez via Brevo.",
      html: "<p>Este é um teste de integração do envio de e-mail do <strong>Marca Minha Vez</strong> via Brevo.</p><p>Se você recebeu esta mensagem, a chave e o remetente configurados no ambiente foram aceitos pela Brevo.</p>",
    });

    return { ok: true as const, recipient };
  });
