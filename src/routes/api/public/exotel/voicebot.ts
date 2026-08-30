import { createFileRoute } from "@tanstack/react-router";
import {
  base64ToBytes,
  bytesToBase64,
  PHONE_SAMPLE_RATE,
  rms,
  synthesize,
  transcribe,
} from "@/lib/exotel-audio.server";
import { endSession, greeting, handleTurn } from "@/lib/warimitra-core.server";
import { linkTransferAliases } from "@/lib/hospital-transfer.server";

/**
 * Exotel Voicebot Applet WebSocket endpoint.
 *
 * Exotel connects here for the whole duration of a phone call and streams the
 * caller's audio as base64 8 kHz 16-bit mono PCM. We buffer speech, detect the
 * end of an utterance by silence, transcribe it, run the SAME WariMitra brain
 * as the browser agent, synthesise Marathi speech and stream it back.
 *
 * Give Exotel:  wss://<your-domain>/api/public/exotel/voicebot
 */

const SILENCE_MS_TO_END_TURN = 800;
const MIN_SPEECH_MS = 240;
const SPEECH_START_CONFIRM_MS = 60;
const PRE_ROLL_MS = 200;
const MAX_UTTERANCE_MS = 8000;
const MAX_QUEUED_TURNS = 1;
const BYTES_PER_MS = (PHONE_SAMPLE_RATE * 2) / 1000;
const CHUNK_BYTES = 3200; // 200 ms per outbound media frame

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const Route = createFileRoute("/api/public/exotel/voicebot")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
          return new Response(
            "WariMitra Exotel voicebot endpoint. Configure this URL as the Exotel Voicebot Applet WebSocket (wss://…/api/public/exotel/voicebot).",
            { status: 426, headers: { "Content-Type": "text/plain; charset=utf-8" } },
          );
        }

        const Pair = (globalThis as { WebSocketPair?: new () => Record<string, WebSocket> })
          .WebSocketPair;
        if (!Pair) return new Response("WebSockets unavailable in this runtime", { status: 500 });

        const pair = new Pair();
        const client = pair[0];
        const server = pair[1] as (WebSocket & { accept: () => void }) | undefined;
        if (!client || !server) return new Response("Could not create WebSocket pair", { status: 500 });
        server.accept();
        runCall(server);

        return new Response(null, { status: 101, webSocket: client } as ResponseInit & {
          webSocket: WebSocket;
        });
      },
    },
  },
});

/** Concise lifecycle diagnostics. Never logs audio, transcripts, keys or numbers. */
const DIAG = true;
/** Echo-test mode is OFF: normal interactive WariMitra conversation. */
const TEST_ECHO = false;
function log(...args: unknown[]) {
  if (DIAG) console.log("[voicebot]", ...args);
}

function runCall(ws: WebSocket & { accept?: () => void }) {
  let streamSid = "";
  let sessionId = `exotel-${Date.now()}`;
  let buffer: Uint8Array[] = [];
  let bufferedBytes = 0;
  let voicedMs = 0;
  let silentMs = 0;
  let speaking = false;
  let speechCandidateMs = 0;
  let noiseFloor = 40;
  let preRoll: Uint8Array[] = [];
  let preRollBytes = 0;
  const turnQueue: { pcm: Uint8Array; durationMs: number }[] = [];
  let processingTurn = false;
  let outboundSpeech = Promise.resolve();
  let botSpeaking = false;
  let closed = false;
  let mediaCount = 0;
  let greetingSent = false;

  const send = (obj: unknown) => {
    if (!closed) {
      try {
        ws.send(JSON.stringify(obj));
      } catch {
        /* socket already gone */
      }
    }
  };

  const speakNow = async (text: string, tag = "") => {
    if (!text.trim()) return;
    const t0 = Date.now();
    botSpeaking = true;
    // Exotel's inbound stream can contain the audio currently being played to
    // the caller. Clear any partial turn before playback so the bot never
    // transcribes its own reply and blocks the caller behind an echo turn.
    resetDetector();
    try {
      const pcm = await synthesize(text);
      for (let i = 0; i < pcm.length; i += CHUNK_BYTES) {
        send({
          event: "media",
          stream_sid: streamSid,
          media: { payload: bytesToBase64(pcm.subarray(i, i + CHUNK_BYTES)) },
        });
      }
      send({ event: "mark", stream_sid: streamSid, mark: { name: "end-of-reply" } });
      log("response sent", {
        sessionId,
        tag: tag || "reply",
        frames: Math.ceil(pcm.length / CHUNK_BYTES),
        ms: Date.now() - t0,
      });
      // Frames are queued much faster than real-time. Keep VAD paused until
      // Exotel has had enough time to play the queued PCM to the caller.
      const playbackMs = pcm.length / BYTES_PER_MS;
      await new Promise((resolve) => setTimeout(resolve, playbackMs));
    } catch (err) {
      console.error(`[voicebot] ${tag || "TTS"} failed`, sessionId, String(err));
    } finally {
      // We keep receiving media while playback is active, but intentionally do
      // not feed it to VAD. Start each caller turn from a clean detector state.
      botSpeaking = false;
      resetDetector();
    }
  };

  const speak = (text: string, tag = "") => {
    const task = outboundSpeech.then(() => speakNow(text, tag));
    outboundSpeech = task.catch(() => undefined);
    return task;
  };

  /**
   * A hung upstream request must never freeze the call: without a deadline the
   * turn loop stays "busy" forever and the caller hears silence.
   */
  const withDeadline = <T,>(work: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      work,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
      ),
    ]);

  const processTurns = async () => {
    if (processingTurn) return;
    processingTurn = true;
    try {
      while (!closed && turnQueue.length) {
        const turn = turnQueue.shift();
        if (!turn) continue;
        try {
          const tStt = Date.now();
          const text = await withDeadline(transcribe(turn.pcm), 15000, "STT");
          log("STT success", { sessionId, ms: Date.now() - tStt, chars: text.length });
          if (TEST_ECHO) {
            await speak(text ? `तुम्ही म्हणालात: ${text}` : "मला ऐकू आले नाही. कृपया पुन्हा सांगा.");
            continue;
          }
          if (!text) {
            await speak("मला ऐकू आले नाही. कृपया पुन्हा सांगा.");
          } else {
            const out = await withDeadline(
              handleTurn({ sessionId, message: text, language: "mr" }),
              20000,
              "brain",
            );
            log("core reply", { sessionId, intent: out.intent, chars: out.answer.length });
            await speak(out.answer);
            if (out.transfer) {
              // The "connecting" audio has fully played. Hand control back to
              // the Exotel flow the way the applet expects: emit `stop`, give
              // Exotel a moment to act on it, then close cleanly (code 1000).
              // An abrupt close without `stop` is read as an aborted call, so
              // Exotel hangs up instead of running the Connect applet.
              log("transfer handoff", { sessionId });
              send({ event: "stop", stream_sid: streamSid });
              await new Promise((resolve) => setTimeout(resolve, 700));
              closed = true;
              try {
                ws.close(1000, "transfer");
              } catch {
                /* already gone */
              }
              return;
            }
            if (out.endCall) send({ event: "stop", stream_sid: streamSid });
          }
        } catch (err) {
          console.error("[voicebot] STT/turn failure", sessionId, String(err));
          await speak("क्षमस्व, पुन्हा एकदा सांगा.");
        }
      }
    } finally {
      processingTurn = false;
      if (!closed && turnQueue.length) void processTurns();
    }
  };

  const resetDetector = () => {
    buffer = [];
    bufferedBytes = 0;
    voicedMs = 0;
    silentMs = 0;
    speaking = false;
    speechCandidateMs = 0;
  };

  const finalizeTurn = (reason: "silence" | "maximum") => {
    const durationMs = bufferedBytes / BYTES_PER_MS;

    if (voicedMs < MIN_SPEECH_MS || bufferedBytes === 0) {
      resetDetector();
      return;
    }

    const pcm = new Uint8Array(bufferedBytes);
    let offset = 0;
    for (const chunk of buffer) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    resetDetector();
    log("turn finalized", { sessionId, reason, ms: Math.round(durationMs) });
    // A phone caller can generate several VAD fragments while one slow STT
    // request is running. Keep only the newest pending turn instead of making
    // the live conversation wait behind stale fragments.
    while (turnQueue.length >= MAX_QUEUED_TURNS) turnQueue.shift();
    turnQueue.push({ pcm, durationMs });
    void processTurns();
  };

  ws.addEventListener("message", (event: MessageEvent) => {
    let msg: {
      event?: string;
      stream_sid?: string;
      start?: { stream_sid?: string; call_sid?: string };
      media?: { payload?: string };
    };
    try {
      msg = JSON.parse(typeof event.data === "string" ? event.data : "{}");
    } catch {
      return;
    }

    if (msg.event === "connected") {
      log("connected");
      return;
    }

    if (msg.event === "start") {
      log("start received", { keys: Object.keys(msg) });
      streamSid = msg.start?.stream_sid ?? msg.stream_sid ?? "";
      sessionId = msg.start?.call_sid ?? (streamSid || sessionId);
      // Exotel's Connect applet may quote either identifier, so accept both.
      linkTransferAliases(sessionId, [msg.start?.call_sid, streamSid, msg.stream_sid]);
      greetingSent = true;
      log("stream_sid received", { sessionId, hasStreamSid: Boolean(streamSid) });
      log("greeting start", { sessionId });
      void speak(greeting("mr-IN"), "greeting");
      return;
    }

    if (msg.event === "media" && msg.media?.payload) {
      mediaCount++;
      if (!greetingSent) {
        // Fallback: some Exotel streams begin with media before a start event.
        greetingSent = true;
        streamSid = streamSid || msg.stream_sid || "";
        linkTransferAliases(sessionId, [streamSid]);
        log("stream_sid received", { sessionId, hasStreamSid: Boolean(streamSid), viaMedia: true });
        log("greeting start", { sessionId });
        void speak(greeting("mr-IN"), "greeting");
      }
      const pcm = base64ToBytes(msg.media.payload);

      // Exotel is full duplex and may stream our synthesized greeting/reply
      // back on the inbound leg. Receiving must continue, but processing that
      // playback as caller speech creates an echo loop and a large STT queue.
      if (botSpeaking) {
        resetDetector();
        if (mediaCount % 100 === 0) {
          log("media received", { sessionId, mediaCount, speaking: false, queuedTurns: turnQueue.length });
        }
        return;
      }

      const level = rms(pcm);
      const ms = pcm.length / BYTES_PER_MS;
      const speechStartThreshold = clamp(noiseFloor * 2 + 20, 90, 450);
      const speechContinueThreshold = clamp(noiseFloor * 1.3 + 10, 55, 280);

      if (!speaking) {
        preRoll.push(pcm);
        preRollBytes += pcm.length;
        while (preRollBytes / BYTES_PER_MS > PRE_ROLL_MS && preRoll.length > 1) {
          const old = preRoll.shift();
          if (old) preRollBytes -= old.length;
        }

        if (level >= speechStartThreshold) {
          speechCandidateMs += ms;
        } else {
          speechCandidateMs = 0;
          // Do not adapt the noise floor to our own playback echo, otherwise the
          // start threshold drifts up and caller speech is never detected.
          if (!botSpeaking) noiseFloor = clamp(noiseFloor * 0.92 + level * 0.08, 15, 400);
        }

        if (speechCandidateMs >= SPEECH_START_CONFIRM_MS) {
          speaking = true;
          voicedMs = speechCandidateMs;
          silentMs = 0;
          buffer = preRoll;
          bufferedBytes = preRollBytes;
          preRoll = [];
          preRollBytes = 0;
        }
      } else {
        buffer.push(pcm);
        bufferedBytes += pcm.length;
        if (level >= speechContinueThreshold) {
          voicedMs += ms;
          silentMs = 0;
        } else {
          silentMs += ms;
        }
      }

      if (mediaCount % 100 === 0) {
        log("media received", { sessionId, mediaCount, speaking, queuedTurns: turnQueue.length });
      }

      const bufferedMs = bufferedBytes / BYTES_PER_MS;
      if (speaking && silentMs >= SILENCE_MS_TO_END_TURN) finalizeTurn("silence");
      else if (speaking && bufferedMs >= MAX_UTTERANCE_MS) finalizeTurn("maximum");
      return;
    }

    if (msg.event === "stop") {
      log("stop event", { sessionId, mediaCount });
      closed = true;
      endSession(sessionId);
      try {
        ws.close();
      } catch {
        /* noop */
      }
    }
  });

  ws.addEventListener("close", () => {
    log("socket closed", { sessionId, mediaCount });
    closed = true;
    endSession(sessionId);
  });
  ws.addEventListener("error", () => {
    closed = true;
  });
}
