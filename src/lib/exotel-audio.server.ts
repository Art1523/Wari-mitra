/**
 * Telephone audio helpers for the Exotel voice channel.
 *
 * Exotel's Voicebot stream carries raw 8 kHz, 16-bit, mono, little-endian PCM
 * as base64. Gemini does speech-to-text from a WAV file and text-to-speech as
 * 24 kHz PCM, so this module converts between the two.
 */

// Use the low-latency Flash Lite model for telephone transcription. The
// previous `gemini-flash-latest` alias was taking 35–60 seconds per short
// utterance in production, so callers hung up before a reply could be played.
const GEMINI_STT_MODEL = "gemini-3.5-flash-lite";
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";

export const PHONE_SAMPLE_RATE = 8000;

function geminiKey(): string {
  const key = process.env["GEMINI_API_KEY"];
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

/**
 * Fallback speech provider (Lovable AI Gateway). Gemini's free tier hits 429
 * quota errors quickly on a live phone call; without a fallback the caller
 * simply hears silence. These keep the call alive.
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
function gatewayKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("LOVABLE_API_KEY is not configured");
  return key;
}

async function gatewayTranscribe(pcm: Uint8Array): Promise<string> {
  const wav = pcmToWav(pcm);
  const form = new FormData();
  form.append("file", new Blob([wav as unknown as BlobPart], { type: "audio/wav" }), "audio.wav");
  form.append("model", "openai/gpt-4o-mini-transcribe");
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${gatewayKey()}` },
    body: form,
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Fallback STT failed [${res.status}]`);
  const json = (await res.json()) as { text?: string };
  return (json.text ?? "").trim();
}

async function gatewaySynthesize(text: string): Promise<Uint8Array> {
  const res = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini-tts",
      voice: "alloy",
      input: text,
      response_format: "pcm",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Fallback TTS failed [${res.status}]`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return resamplePcm16(buf, 24000, PHONE_SAMPLE_RATE);
}


export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Wrap raw 16-bit mono PCM in a WAV container so Gemini can read it. */
export function pcmToWav(pcm: Uint8Array, sampleRate = PHONE_SAMPLE_RATE): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const write = (off: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(off + i, text.charCodeAt(i));
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, pcm.length, true);

  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

/** Simple linear down-sampler (e.g. 24 kHz Gemini TTS → 8 kHz telephony). */
export function resamplePcm16(pcm: Uint8Array, fromRate: number, toRate: number): Uint8Array {
  if (fromRate === toRate) return pcm;
  const src = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const ratio = fromRate / toRate;
  const outLen = Math.floor(src.length / ratio);
  const dst = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) dst[i] = src[Math.floor(i * ratio)] ?? 0;
  return new Uint8Array(dst.buffer);
}

/**
 * RMS loudness for signed 16-bit little-endian PCM.
 * DataView keeps the interpretation explicit and correct even when a chunk has
 * an unaligned byte offset.
 */
export function rms(pcm: Uint8Array): number {
  const sampleCount = Math.floor(pcm.byteLength / 2);
  if (!sampleCount) return 0;
  const view = new DataView(pcm.buffer, pcm.byteOffset, sampleCount * 2);
  let sum = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = view.getInt16(i * 2, true);
    sum += sample * sample;
  }
  return Math.sqrt(sum / sampleCount);
}

/** Speech-to-text through Gemini (Marathi first), with a gateway fallback. */
export async function transcribe(pcm: Uint8Array, lang = "mr-IN"): Promise<string> {
  try {
    return await geminiTranscribe(pcm, lang);
  } catch (err) {
    console.error("[voicebot] STT primary failed, using fallback", String(err));
    return gatewayTranscribe(pcm);
  }
}

async function geminiTranscribe(pcm: Uint8Array, lang: string): Promise<string> {
  const wav = pcmToWav(pcm);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_STT_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Transcribe this Indian phone call audio verbatim. The speaker is a Pandharpur Wari pilgrim speaking Marathi (${lang}); it may also be Hindi or English. The speech often contains a Maharashtra village, town, temple or bus-stand name (for example बेल्हे, जेजुरी, निघोज, सासवड, लोणंद, फलटण, नातेपुते, वेळापूर, पंढरपूर). Spell such place names correctly in Devanagari. Return ONLY the transcript text, nothing else. If there is no intelligible speech, return an empty string.`,
              },
              { inlineData: { mimeType: "audio/wav", data: bytesToBase64(wav) } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 128,
        },
      }),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[voicebot] STT HTTP error", res.status, body.slice(0, 300));
    throw new Error(`STT failed [${res.status}]`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  return (json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "").trim();
}

/** Text-to-speech through Gemini, returned as 8 kHz telephony PCM. */
export async function synthesize(text: string, attempts = 2): Promise<Uint8Array> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await synthesizeOnce(text);
    } catch (err) {
      lastErr = err;
      // 429 here means the Gemini quota is exhausted; retrying only adds a
      // second of dead air before the gateway fallback speaks.
      const retryable = /\[(500|503)\]/.test(String(err));
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  console.error("[voicebot] TTS primary failed, using fallback", String(lastErr));
  return gatewaySynthesize(text);
}


async function synthesizeOnce(text: string): Promise<Uint8Array> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[voicebot] TTS HTTP error", res.status, body.slice(0, 300));
    throw new Error(`TTS failed [${res.status}]`);
  }
  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
  };
  const b64 = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData
    ?.data;
  if (!b64) throw new Error("TTS returned no audio");
  return resamplePcm16(base64ToBytes(b64), 24000, PHONE_SAMPLE_RATE);
}
