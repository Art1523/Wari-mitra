import type { AiRequest } from "./ai.functions";

/**
 * Server-safe AI completion (no request context needed), used by the phone
 * channel and the public API route.
 *
 * The Lovable AI Gateway is tried first because it answers in a couple of
 * seconds; a direct Gemini key is kept as a fallback. On a live voice call a
 * slow model turn is as bad as a failed one, so ordering matters.
 */
async function viaGateway(data: AiRequest): Promise<{ text: string }> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI gateway is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-3.6-flash",
      messages: data.messages,
      ...(data.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`AI request failed [${res.status}]`);
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return { text: json.choices?.[0]?.message?.content ?? "" };
}

async function viaGemini(data: AiRequest): Promise<{ text: string }> {
  const geminiKey = process.env["GEMINI_API_KEY"];
  if (!geminiKey) throw new Error("Gemini is not configured");
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
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: data.json ? { responseMimeType: "application/json" } : {},
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!res.ok) throw new Error(`Gemini request failed [${res.status}]`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return {
    text: json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
  };
}

export async function aiCompleteDirect(data: AiRequest): Promise<{ text: string }> {
  try {
    return await viaGateway(data);
  } catch (err) {
    console.warn("AI gateway call failed, trying Gemini directly", err);
    return viaGemini(data);
  }
}
