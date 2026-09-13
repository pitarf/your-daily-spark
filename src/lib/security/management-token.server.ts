import { createHmac, timingSafeEqual } from "node:crypto";

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function getSigningSecrets() {
  const preferred = process.env["NOTIFICATION_SIGNING_SECRET"]?.trim();
  const legacy = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  const secrets = [preferred, legacy].filter((secret): secret is string => Boolean(secret));
  const uniqueSecrets = [...new Set(secrets)];

  if (uniqueSecrets.length === 0) {
    throw new Error("NOTIFICATION_SIGNING_SECRET is required for management links.");
  }

  return uniqueSecrets;
}

function signWithSecret(secret: string, appointmentId: string, customerPhone: string, expiresAtMs: number) {
  const payload = `${appointmentId}:${expiresAtMs}:${normalizePhone(customerPhone)}`;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeSignatureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function signManagementToken(appointmentId: string, customerPhone: string, expiresAtMs: number) {
  const [currentSecret] = getSigningSecrets();
  return signWithSecret(currentSecret, appointmentId, customerPhone, expiresAtMs);
}

export function verifyManagementToken(
  appointmentId: string,
  customerPhone: string,
  token: string,
) {
  const [expiryRaw, signature] = token.split(".");
  const expiresAtMs = Number(expiryRaw);
  if (!Number.isSafeInteger(expiresAtMs) || !signature || expiresAtMs <= Date.now()) return false;

  return getSigningSecrets().some((secret) =>
    safeSignatureEqual(signWithSecret(secret, appointmentId, customerPhone, expiresAtMs), signature),
  );
}
