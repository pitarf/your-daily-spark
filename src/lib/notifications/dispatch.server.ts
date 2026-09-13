import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { sendNotificationEmail } from "@/lib/notifications/email.server";
import { redactSecrets } from "@/lib/integrations/secret-safe.server";
import type { NotificationType } from "@/lib/notifications";
import { signManagementToken } from "@/lib/security/management-token.server";

type NotificationRow = {
  id: string;
  type: NotificationType;
  scheduled_at: string;
  customer: { name: string; email: string | null; phone: string | null } | null;
  appointment: {
    id: string;
    starts_at: string;
    ends_at: string;
    custom_title: string | null;
    custom_price: number | null;
    service: { name: string; price: number } | null;
    professional: { name: string } | null;
  } | null;
  establishment: {
    name: string;
    slug: string;
    timezone: string;
  } | null;
};

export type DispatchResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
};

function isEmailDeliveryConfigured() {
  return Boolean(process.env["BREVO_API_KEY"]);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDateTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatMoney(value: number | null) {
  if (value === null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getManagementPath(row: NotificationRow) {
  if (!row.customer?.phone || !row.establishment || !row.appointment) return null;

  const expiresAtMs = new Date(row.appointment.ends_at).getTime() + 30 * 24 * 60 * 60 * 1000;
  const token = `${expiresAtMs}.${signManagementToken(
    row.appointment.id,
    row.customer.phone,
    expiresAtMs,
  )}`;
  const appUrl = (process.env["PUBLIC_APP_URL"] || "https://marca-minha-vez.lovable.app").replace(/\/$/, "");

  return `${appUrl}/agenda/${encodeURIComponent(row.establishment.slug)}?manage=${encodeURIComponent(row.appointment.id)}&token=${encodeURIComponent(token)}`;
}

function notificationCopy(type: NotificationType, establishmentName: string) {
  switch (type) {
    case "confirmation":
      return {
        subject: `Agendamento confirmado · ${establishmentName}`,
        heading: "Agendamento confirmado",
      };
    case "cancellation":
      return {
        subject: `Agendamento cancelado · ${establishmentName}`,
        heading: "Agendamento cancelado",
      };
    case "reminder":
      return {
        subject: `Lembrete de atendimento · ${establishmentName}`,
        heading: "Lembrete de atendimento",
      };
  }
}

function buildEmail(row: NotificationRow) {
  if (!row.customer?.email) throw new Error("Cliente não possui e-mail cadastrado.");
  if (!row.establishment) throw new Error("Estabelecimento da notificação não encontrado.");
  if (!row.appointment) throw new Error("Agendamento da notificação não encontrado.");

  const timezone = row.establishment.timezone || "America/Sao_Paulo";
  const title = row.appointment.custom_title?.trim() || row.appointment.service?.name || "Atendimento";
  const professional = row.appointment.professional?.name || "Profissional";
  const dateTime = formatDateTime(row.appointment.starts_at, timezone);
  const startTime = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, timeStyle: "short" }).format(new Date(row.appointment.starts_at));
  const endTime = new Intl.DateTimeFormat("pt-BR", { timeZone: timezone, timeStyle: "short" }).format(new Date(row.appointment.ends_at));
  const durationMinutes = Math.max(15, Math.round((new Date(row.appointment.ends_at).getTime() - new Date(row.appointment.starts_at).getTime()) / 60000));
  const price = formatMoney(row.appointment.custom_price ?? row.appointment.service?.price ?? null);
  const copy = notificationCopy(row.type, row.establishment.name);
  const managementUrl = row.type === "cancellation" ? null : getManagementPath(row);

  const text = [
    copy.heading,
    "",
    `Olá, ${row.customer.name}!`,
    `Estabelecimento: ${row.establishment.name}`,
    `Atendimento: ${title}`,
    `Profissional: ${professional}`,
    `Data e horário: ${dateTime}`,
    `Período: ${startTime} às ${endTime}`,
    `Duração: ${durationMinutes} minutos`,
    ...(price ? [`Valor: ${price}`] : []),
    ...(managementUrl ? ["", `Gerenciar agendamento: ${managementUrl}`] : []),
    "",
    "Marca Minha Vez",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f6f7f9;font-family:Arial,sans-serif;color:#17181a;">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e7e9ee;border-radius:16px;padding:28px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#6b7280;">Marca Minha Vez</p>
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.2;">${escapeHtml(copy.heading)}</h1>
        <p style="margin:0 0 20px;">Olá, <strong>${escapeHtml(row.customer.name)}</strong>!</p>
        <div style="background:#f7f8fa;border-radius:12px;padding:16px;">
          <p style="margin:0 0 8px;"><strong>${escapeHtml(title)}</strong></p>
          <p style="margin:4px 0;">${escapeHtml(row.establishment.name)}</p>
          <p style="margin:4px 0;">${escapeHtml(professional)}</p>
          <p style="margin:4px 0;">${escapeHtml(dateTime)}</p>
          <p style="margin:4px 0;">${escapeHtml(startTime)} às ${escapeHtml(endTime)} · ${durationMinutes} minutos</p>
          ${price ? `<p style="margin:4px 0;">${escapeHtml(price)}</p>` : ""}
        </div>
        ${managementUrl ? `<div style="margin:24px 0 0;text-align:center;"><a href="${escapeHtml(managementUrl)}" style="display:inline-block;background:#17181a;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 18px;font-weight:700;">Gerenciar agendamento</a></div>` : ""}
        <p style="margin:20px 0 0;font-size:12px;color:#6b7280;">Este e-mail foi gerado automaticamente pelo sistema de agendamento.</p>
      </div>
    </div>
  </body>
</html>`;

  return { to: row.customer.email, subject: copy.subject, html, text };
}

async function markNotificationSent(id: string) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) throw error;
}

async function markNotificationFailed(id: string) {
  const { error } = await supabaseAdmin
    .from("notifications")
    .update({ status: "failed", sent_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function dispatchDueNotifications(limit = 25): Promise<DispatchResult> {
  if (!isEmailDeliveryConfigured()) {
    return { processed: 0, sent: 0, failed: 0, skipped: 1 };
  }

  const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .select("id, type, scheduled_at, customer:customer_id(name, email, phone), appointment:appointment_id(id, starts_at, ends_at, custom_title, custom_price, service:service_id(name, price), professional:professional_id(name)), establishment:establishment_id(name, slug, timezone)")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(safeLimit);

  if (error) throw error;

  const result: DispatchResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  const notifications = (data ?? []) as unknown as NotificationRow[];

  for (const notification of notifications) {
    result.processed += 1;

    let claimed = false;
    try {
      const { data: claim, error: claimError } = await supabaseAdmin
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claim) {
        result.skipped += 1;
        continue;
      }
      claimed = true;

      const message = buildEmail(notification);
      await sendNotificationEmail(message);
      result.sent += 1;
    } catch (error) {
      if (claimed) {
        try {
          await markNotificationFailed(notification.id);
        } catch {
          // Preserve the original delivery error in the process result/log.
        }
      }
      result.failed += 1;
      console.error("Notification delivery failed", {
        notificationId: notification.id,
        error: error instanceof Error ? redactSecrets(error.message) : "unknown error",
      });
    }
  }

  return result;
}
