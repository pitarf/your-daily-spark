import { describeHttpFailure, redactSecrets } from "@/lib/integrations/secret-safe.server";

export type NotificationEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getBrevoConfig() {
  const apiKey = process.env["BREVO_API_KEY"];
  const fromEmail = process.env["NOTIFICATION_FROM_EMAIL"] || "rfpita.work@gmail.com";
  const fromName = process.env["NOTIFICATION_FROM_NAME"]?.trim() || "Marca Minha Vez";

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is required to deliver notification emails.");
  }

  return {
    apiKey,
    sender: {
      email: fromEmail,
      name: fromName,
    },
  };
}

export async function sendNotificationEmail(message: NotificationEmail) {
  const config = getBrevoConfig();
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: config.sender,
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
      textContent: message.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `${describeHttpFailure("A Brevo", response.status)} ${redactSecrets(body.slice(0, 200))}`.trim(),
    );
  }

  return (await response.json()) as { messageId?: string };
}
