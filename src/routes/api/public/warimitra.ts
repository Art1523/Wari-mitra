import { createFileRoute } from "@tanstack/react-router";
import { handleTurn, greeting, toLang } from "@/lib/warimitra-core.server";

/**
 * WariMitra text brain over HTTP.
 *
 * POST /api/public/warimitra
 *   { "message": "माझ्या जवळ मेडिकल कुठे आहे?", "language": "mr",
 *     "sessionId": "test-1", "location": { "latitude": 0, "longitude": 0 } }
 * → { "answer": "…", "intent": "…", "location": {…}, "place": {…} }
 *
 * GET /api/public/warimitra?message=...&sessionId=... does the same, for a
 * quick browser test.
 *
 * Public on purpose: Exotel and your own tests must reach it without a login.
 * It exposes no private data — only the same public place search the browser
 * agent already performs.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

async function run(input: {
  message?: unknown;
  language?: unknown;
  sessionId?: unknown;
  location?: unknown;
}) {
  const message = typeof input.message === "string" ? input.message.slice(0, 1000) : "";
  const sessionId =
    typeof input.sessionId === "string" && input.sessionId.trim()
      ? input.sessionId.trim().slice(0, 80)
      : `anon-${Date.now()}`;
  const language = typeof input.language === "string" ? input.language : "mr";

  if (!message.trim()) {
    return json({ answer: greeting(toLang(language)), intent: "greeting", sessionId });
  }

  const loc = input.location as { latitude?: unknown; longitude?: unknown } | undefined;
  const location =
    loc && typeof loc.latitude === "number" && typeof loc.longitude === "number" &&
    (loc.latitude !== 0 || loc.longitude !== 0)
      ? { latitude: loc.latitude, longitude: loc.longitude }
      : undefined;

  const out = await handleTurn({ sessionId, message, language, location });
  return json({ sessionId, ...out });
}

export const Route = createFileRoute("/api/public/warimitra")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return run({
          message: url.searchParams.get("message") ?? "",
          language: url.searchParams.get("language") ?? "mr",
          sessionId: url.searchParams.get("sessionId") ?? "",
        });
      },
      POST: async ({ request }) => {
        let body: Record<string, unknown> = {};
        try {
          body = (await request.json()) as Record<string, unknown>;
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }
        return run(body);
      },
    },
  },
});
