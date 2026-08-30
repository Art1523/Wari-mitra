import { aiComplete, type AiMessage } from "@/lib/ai.functions";

/**
 * WariMitra conversational brain (Gemini).
 *
 * Gemini owns: understanding, intent, Marathi conversation and wording.
 * Gemini NEVER owns: coordinates, facility existence, distances, phone numbers
 * or any stored record — those come from the application services.
 *
 * Two ways to run:
 *  1. Default — a server function proxies Gemini (key stays server-side).
 *  2. Set `VITE_GEMINI_API_KEY` to call Gemini directly from the browser
 *     (prototype demos only).
 */
const BROWSER_KEY = import.meta.env["VITE_GEMINI_API_KEY"] as string | undefined;
const BROWSER_MODEL = "gemini-flash-latest";

export type SpeechLang = "mr-IN" | "hi-IN" | "en-IN";

export type Intent =
  | "provide_location"
  | "location_changed"
  | "find_facility"
  | "emergency"
  | "missing_person"
  | "missing_person_sighting"
  | "general_information"
  | "announcement"
  | "goodbye"
  | "unknown";

export interface NluResult {
  intent: Intent;
  /** Raw spoken facility words, normalised into a category by placesService. */
  facilityType?: string | null;
  locationMentioned?: string | null;
  needsLocation: boolean;
  phoneNumber?: string | null;
  personName?: string | null;
  age?: number | null;
  appearance?: string | null;
  responseLanguage: SpeechLang;
  response: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export const SYSTEM_PROMPT = `You are WariMitra AI, a polite Marathi-speaking voice helpline assistant for Warkaris walking the Pandharpur Wari, and for anyone anywhere in Maharashtra.

This is a telephone-style conversation. Speak naturally, warmly and very briefly — one or two short sentences. No lists, no markdown, no emoji.

Rules you must never break:
- You NEVER invent places, facilities, distances, coordinates, opening status or phone numbers. The application supplies verified search results; you only word them.
- The caller may be on a feature phone with no GPS. Location comes only from what they say: a village, temple, toll plaza, bus stand, railway station, road, junction, Dindi number, or a relative description such as "we left Jejuri 30 minutes ago".
- Once the caller's location is known, NEVER ask for it again in the same call unless the caller says they have moved.
- Understand informal spoken Marathi, Hindi, and Marathi typed in English letters ("majhya javal toilet kuthe ahe").
- Never give a medical diagnosis and never claim an ambulance, police or government service has been dispatched.`;

const JSON_CONTRACT = `Reply with ONLY a JSON object, no markdown fences:
{
  "intent": "provide_location" | "location_changed" | "find_facility" | "emergency" | "missing_person" | "missing_person_sighting" | "general_information" | "announcement" | "goodbye" | "unknown",
  "facilityType": string | null,
  "locationMentioned": string | null,
  "needsLocation": boolean,
  "phoneNumber": string | null,
  "personName": string | null,
  "age": number | null,
  "appearance": string | null,
  "responseLanguage": "mr-IN" | "hi-IN" | "en-IN",
  "response": string
}
Guidance:
- "provide_location": the caller is telling you where they are.
- "location_changed": the caller says they have moved on ("मी आता पुढे आलो आहे").
- "facilityType": the exact words the caller used for what they need (शौचालय, मेडिकल, पाणी, दवाखाना, जेवण...).
- "locationMentioned": only the place words the caller said, nothing else.
- "response": what you would SAY next, in the caller's language.
Never re-ask for information already collected.`;

/**
 * Optional AI transport. The phone (WebSocket) channel has no request context,
 * so it injects a direct server-side caller instead of the server function.
 */
export type AiProvider = (data: {
  messages: AiMessage[];
  json?: boolean;
}) => Promise<{ text: string }>;

async function callModel(
  messages: AiMessage[],
  json: boolean,
  provider?: AiProvider,
): Promise<string> {
  if (provider) return (await provider({ messages, json })).text;
  if (BROWSER_KEY) return callGeminiDirect(messages, json);
  const out = await aiComplete({ data: { messages, json } });
  return out.text;
}

/** Prototype-only direct browser call, used when VITE_GEMINI_API_KEY is set. */
async function callGeminiDirect(messages: AiMessage[], json: boolean): Promise<string> {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${BROWSER_MODEL}:generateContent?key=${BROWSER_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: json ? { responseMimeType: "application/json" } : {},
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini failed [${res.status}]`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}

function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function historyToMessages(history: ChatTurn[]): AiMessage[] {
  return history.slice(-14).map((t) => ({
    role: t.role === "user" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));
}

export interface CallContext {
  callerLocationText?: string | undefined;
  callerLocationConfidence?: string | undefined;
  facilityType?: string | undefined;
  activeFlow?: string | undefined;
}

/** Understand the caller: intent, facility words, location words, details. */
export async function understand(
  history: ChatTurn[],
  lang: SpeechLang,
  ctx: CallContext,
  provider?: AiProvider,
): Promise<NluResult> {
  const context = `Conversation state held by the application (the source of truth):
- caller's current location: ${ctx.callerLocationText ?? "UNKNOWN — must be asked first"}
- location confidence: ${ctx.callerLocationConfidence ?? "n/a"}
- facility already requested: ${ctx.facilityType ?? "none"}
- active workflow: ${ctx.activeFlow ?? "none"}
Caller's language: ${lang}. Reply in that language.`;

  const messages: AiMessage[] = [
    { role: "system", content: `${SYSTEM_PROMPT}\n\n${context}\n\n${JSON_CONTRACT}` },
    ...historyToMessages(history),
  ];

  const raw = await callModel(messages, true, provider);
  const parsed = parseJson(raw);
  if (!parsed) throw new Error("Could not parse AI response");

  const ageRaw = parsed["age"];
  return {
    intent: String(parsed["intent"] ?? "unknown") as Intent,
    facilityType: (parsed["facilityType"] as string | null) ?? null,
    locationMentioned: (parsed["locationMentioned"] as string | null) ?? null,
    needsLocation: Boolean(parsed["needsLocation"]),
    phoneNumber: (parsed["phoneNumber"] as string | null) ?? null,
    personName: (parsed["personName"] as string | null) ?? null,
    age: typeof ageRaw === "number" ? ageRaw : null,
    appearance: (parsed["appearance"] as string | null) ?? null,
    responseLanguage: (parsed["responseLanguage"] as SpeechLang) || lang,
    response: String(parsed["response"] ?? "").trim(),
  };
}

export interface PlaceFact {
  name: string;
  categoryLabel: string;
  address: string;
  distanceM: number;
  openNow: boolean | null;
}

/**
 * Word a REAL Places search result as a short spoken sentence.
 * `place === null` means the search genuinely found nothing.
 */
export async function composePlacesReply(
  history: ChatTurn[],
  lang: SpeechLang,
  callerLocationText: string,
  place: PlaceFact | null,
  extra?: string,
  provider?: AiProvider,
): Promise<string> {
  const factSheet = place
    ? `Verified live search result (the ONLY place you may mention):
name: ${place.name}
type: ${place.categoryLabel} (a nearby public place found by a maps search, NOT an official Wari facility)
address: ${place.address}
straight-line distance from the caller: ${place.distanceM} metres
open now: ${place.openNow === null ? "unknown — do not claim it is open" : place.openNow ? "yes" : "no"}
caller's location: ${callerLocationText}`
    : `The live search found NO matching place near ${callerLocationText}. Say so honestly in one sentence and offer to check another landmark.`;

  const messages: AiMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}

${factSheet}
${extra ? `\nAlso mention briefly: ${extra}` : ""}

Reply with one or two short spoken sentences in ${lang}. Plain text only. Give the distance in metres or kilometres exactly as supplied.`,
    },
    ...historyToMessages(history),
  ];
  const text = await callModel(messages, false, provider);
  return text.replace(/[*_`#]/g, "").trim();
}

export const AI_ERROR_TEXT: Record<SpeechLang, string> = {
  "mr-IN": "क्षमस्व, सध्या सेवा उपलब्ध नाही. कृपया पुन्हा प्रयत्न करा.",
  "hi-IN": "क्षमा करें, सेवा अभी उपलब्ध नहीं है. कृपया फिर से प्रयास करें.",
  "en-IN": "Sorry, the service is unavailable right now. Please try again.",
};
