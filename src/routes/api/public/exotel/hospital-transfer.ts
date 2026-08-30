import { createFileRoute } from "@tanstack/react-router";
import { consumeTransfer, demoTransferNumber, toExotelDialable } from "@/lib/hospital-transfer.server";

/**
 * Exotel Connect applet endpoint.
 *
 * Supports both Exotel Connect modes:
 * - "Dial Whom" URL: returns the number as plain text.
 * - Programmable Connect: returns Exotel's required JSON parameters when the
 *   Exotel-Version request header is present.
 *
 * Configure as: https://<your-domain>/api/public/exotel/hospital-transfer
 */
export const Route = createFileRoute("/api/public/exotel/hospital-transfer")({
  server: {
    handlers: {
      GET: async ({ request }) => respond(request),
      POST: async ({ request }) => respond(request),
    },
  },
});

async function respond(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const q = (k: string) => url.searchParams.get(k);
  let callId =
    q("CallSid") ?? q("call_sid") ?? q("callSid") ?? q("StreamSid") ?? q("stream_sid") ?? "";

  if (!callId && request.method === "POST") {
    try {
      const form = await request.formData();
      callId = String(form.get("CallSid") ?? form.get("call_sid") ?? form.get("stream_sid") ?? "");
    } catch {
      /* body not form-encoded */
    }
  }
  // Exotel sometimes substitutes an unresolved template such as {{CallSid}}.
  if (/[{}]/.test(callId)) callId = "";

  // On the published site the Connect request can land on a different server
  // instance than the call's WebSocket, so the in-memory record may be missing.
  // In demo mode a single verified test line is used, so fall back to it.
  const e164 = consumeTransfer(callId) ?? demoTransferNumber();
  if (!e164) {
    console.log("[transfer] transfer unavailable");
    return isProgrammableConnect(request)
      ? Response.json({ destination: { numbers: [] } }, { status: 200, headers: noStore() })
      : new Response("", { status: 200, headers: text() });
  }
  if (isProgrammableConnect(request)) {
    console.log("[transfer] programmable transfer handoff");
    return Response.json(
      {
        fetch_after_attempt: false,
        destination: { numbers: [e164] },
        max_ringing_duration: 45,
        max_conversation_duration: 900,
        music_on_hold: { type: "operator_tone" },
      },
      { status: 200, headers: noStore() },
    );
  }
  // Default to the national (0-prefixed) form Exotel's Connect applet dials
  // reliably in India; ?format=e164 returns the raw +91 form.
  const number = q("format") === "e164" ? e164 : toExotelDialable(e164);
  console.log("[transfer] transfer handoff");
  return new Response(number, { status: 200, headers: text() });
}

const text = () => ({
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-store",
});

const noStore = () => ({ "Cache-Control": "no-store" });

function isProgrammableConnect(request: Request): boolean {
  return Boolean(request.headers.get("Exotel-Version"));
}
