export type NotificationEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getResendConfig() {
  const apiKey = process.env["RESEND_API_KEY"];
  const fromEmail = process.env["NOTIFICATION_FROM_EMAIL"];
  const fromName = process.env["NOTIFICATION_FROM_NAME"]?.trim();

  if (!apiKey || !fromEmail) {
    throw new Error("RESEND_API_KEY and NOTIFICATION_FROM_EMAIL are required to deliver notification emails.");
  }

  return {
    apiKey,
    from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
  };
}

export async function sendNotificationEmail(message: NotificationEmail) {
  const config = getResendConfig();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend rejected the notification (${response.status}): ${body.slice(0, 300)}`);
  }

  return (await response.json()) as { id?: string };
}
