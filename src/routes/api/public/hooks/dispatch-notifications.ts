import { createFileRoute } from "@tanstack/react-router";

function unauthorized() {
  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Comparação de tempo constante, sem revelar o tamanho por atalho de saída. */
function safeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function parseLimit(raw: string | null) {
  const value = Number(raw ?? "25");
  if (!Number.isFinite(value) || value < 1) return 25;
  return Math.min(Math.floor(value), 100);
}

async function handle(request: Request) {
  const configured = process.env["LOVABLE_CRON_SECRET"];
  if (!configured) return unauthorized();

  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!provided || !safeEqual(provided, configured)) return unauthorized();

  try {
    const { dispatchDueNotifications } = await import("@/lib/notifications/dispatch.server");
    const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
    const result = await dispatchDueNotifications(limit);

    return new Response(
      JSON.stringify({
        ok: true,
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      }),
      { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const { toSafeIntegrationError } = await import("@/lib/integrations/secret-safe.server");
    const message = toSafeIntegrationError(error, "Não foi possível processar a fila de notificações.");
    console.error("[dispatch-notifications]", message);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/public/hooks/dispatch-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
