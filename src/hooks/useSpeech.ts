import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SpeechLang } from "@/services/geminiService";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface SpeechSupport {
  recognition: boolean;
  synthesis: boolean;
}

function getRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechSupport(): SpeechSupport {
  const [support, setSupport] = useState<SpeechSupport>({ recognition: true, synthesis: true });
  useEffect(() => {
    setSupport({
      recognition: Boolean(getRecognitionCtor()),
      synthesis: typeof window !== "undefined" && "speechSynthesis" in window,
    });
  }, []);
  return support;
}

/** Browser text-to-speech, tuned for Marathi/Hindi/English-India voices. */
export function useSpeaker() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  const pickVoice = useCallback(
    (lang: SpeechLang) => {
      const base = lang.split("-")[0];
      return (
        voices.find((v) => v.lang?.replace("_", "-") === lang) ??
        voices.find((v) => v.lang?.toLowerCase().startsWith(`${base}-`)) ??
        // Marathi voices are rare — a Hindi (Devanagari) voice is the best fallback.
        (base === "mr" ? voices.find((v) => v.lang?.toLowerCase().startsWith("hi")) : undefined) ??
        voices.find((v) => v.lang?.toLowerCase().startsWith("en-in")) ??
        undefined
      );
    },
    [voices],
  );

  const speak = useCallback(
    (text: string, lang: SpeechLang) =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
          resolve();
          return;
        }
        const synth = window.speechSynthesis;
        synth.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang;
        const voice = pickVoice(lang);
        if (voice) utter.voice = voice;
        utter.rate = 0.95;
        utter.pitch = 1;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        utter.onend = finish;
        utter.onerror = finish;
        // Safety net: some browsers never fire onend for long utterances.
        const guard = setTimeout(finish, Math.max(4000, text.length * 120));
        const clear = () => clearTimeout(guard);
        utter.addEventListener("end", clear);
        utter.addEventListener("error", clear);
        synth.speak(utter);
      }),
    [pickVoice],
  );

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const marathiVoiceAvailable = useMemo(
    () => voices.some((v) => v.lang?.toLowerCase().startsWith("mr")),
    [voices],
  );

  return { speak, stop, marathiVoiceAvailable, voices };
}

export interface ListenResult {
  transcript: string;
  error?: "no-speech" | "not-allowed" | "aborted" | "network" | "unsupported" | "other";
}

/**
 * One-shot speech recognition. Resolves when the caller stops speaking,
 * on error, or after a silence timeout — so the call loop never gets stuck.
 */
export function useListener() {
  const activeRef = useRef<any>(null);

  const stop = useCallback(() => {
    try {
      activeRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    activeRef.current = null;
  }, []);

  const listen = useCallback(
    (lang: SpeechLang, onPartial?: (text: string) => void) =>
      new Promise<ListenResult>((resolve) => {
        const Ctor = getRecognitionCtor();
        if (!Ctor) {
          resolve({ transcript: "", error: "unsupported" });
          return;
        }
        const rec = new Ctor();
        activeRef.current = rec;
        rec.lang = lang;
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;

        let finalText = "";
        let settled = false;
        const done = (result: ListenResult) => {
          if (settled) return;
          settled = true;
          clearTimeout(silence);
          activeRef.current = null;
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
          resolve(result);
        };

        const silence = setTimeout(() => done({ transcript: finalText.trim() }), 12000);

        rec.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res.isFinal) finalText += res[0].transcript;
            else interim += res[0].transcript;
          }
          onPartial?.((finalText + interim).trim());
        };
        rec.onerror = (event: any) => {
          const code = String(event?.error ?? "other");
          const known: ListenResult["error"] =
            code === "no-speech"
              ? "no-speech"
              : code === "not-allowed" || code === "service-not-allowed"
                ? "not-allowed"
                : code === "aborted"
                  ? "aborted"
                  : code === "network"
                    ? "network"
                    : "other";
          done({ transcript: finalText.trim(), error: known });
        };
        rec.onend = () => done({ transcript: finalText.trim() });

        try {
          rec.start();
        } catch {
          done({ transcript: "", error: "other" });
        }
      }),
    [],
  );

  useEffect(() => () => stop(), [stop]);

  return { listen, stop };
}
