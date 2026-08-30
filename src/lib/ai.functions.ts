import { createServerFn } from "@tanstack/react-start";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiRequest {
  messages: AiMessage[];
  json?: boolean;
}

/**
 * Server-side AI call.
 *
 * The prototype uses Lovable AI (Gemini) so it works with no key setup, and the
 * key never reaches the browser. If you prefer your own Google Gemini key, set
 * VITE_GEMINI_API_KEY and `geminiService` will call Gemini directly from the
 * browser instead (prototype only — see README).
 */
export const aiComplete = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as AiRequest;
    if (!d || !Array.isArray(d.messages)) throw new Error("messages required");
    return d;
  })
  .handler(async ({ data }) => {
    // 1. Preferred: the project's own Google Gemini key (kept server-side only).
    const geminiKey = process.env["GEMINI_API_KEY"];
    if (geminiKey) {
      try {
        return { text: await callGemini(geminiKey, data) };
      } catch (err) {
        console.error("Gemini direct call failed, falling back to Lovable AI:", err);
      }
    }

    // 2. Fallback: Lovable AI gateway.
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: data.messages,
        ...(data.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`AI request failed [${res.status}]: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return { text: json.choices?.[0]?.message?.content ?? "" };
  });

const GEMINI_MODEL = "gemini-flash-latest";

async function callGemini(key: string, data: AiRequest): Promise<string> {
  const system = data.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = data.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      // Google occasionally hangs or returns 503; fail fast so the Lovable AI
      // fallback can answer the caller instead of leaving dead air.
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: data.json ? { responseMimeType: "application/json" } : {},
      }),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}
