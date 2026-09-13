const SECRET_ENV_NAMES = [
  "BREVO_API_KEY",
  "GEMINI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LOVABLE_API_KEY",
  "NOTIFICATIONS_CRON_SECRET",
] as const;

/**
 * Remove qualquer valor de segredo conhecido (ou padrão de chave) do texto
 * antes de ele chegar ao navegador ou aos logs.
 */
export function redactSecrets(input: string): string {
  let output = input;

  for (const name of SECRET_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.length >= 8) {
      output = output.split(value).join("[redigido]");
    }
  }

  // Padrões genéricos de chave (Brevo, Google, JWT longo, bearer).
  output = output
    .replace(/xkeysib-[A-Za-z0-9._-]+/g, "[redigido]")
    .replace(/AIza[0-9A-Za-z._-]{10,}/g, "[redigido]")
    .replace(/AQ\.[0-9A-Za-z._-]{10,}/g, "[redigido]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[redigido]")
    .replace(/(api-?key|authorization|bearer)\s*[:=]\s*\S+/gi, "$1: [redigido]");

  return output;
}

/**
 * Converte um erro de integração em uma mensagem útil e segura em português.
 */
export function toSafeIntegrationError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const safe = redactSecrets(raw).trim();
  if (!safe) return fallback;
  return safe.length > 300 ? `${safe.slice(0, 300)}…` : safe;
}

export function describeHttpFailure(service: string, status: number): string {
  if (status === 401 || status === 403) {
    return `${service} recusou a chave configurada (${status}). Gere uma nova chave e atualize o segredo.`;
  }
  if (status === 400) {
    return `${service} recusou a requisição de teste (400). Verifique o remetente ou o modelo configurado.`;
  }
  if (status === 404) {
    return `${service} não encontrou o recurso solicitado (404). Verifique o modelo configurado.`;
  }
  if (status === 429) {
    return `${service} aplicou limite de uso (429). Tente novamente em alguns minutos.`;
  }
  if (status >= 500) {
    return `${service} está indisponível no momento (${status}). Tente novamente mais tarde.`;
  }
  return `${service} retornou um erro inesperado (${status}).`;
}
