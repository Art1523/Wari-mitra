import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  MapPin,
  Mic,
  Phone,
  PhoneOff,
  Radio,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";
import { useCallEngine } from "@/hooks/useCallEngine";
import { useSpeechSupport } from "@/hooks/useSpeech";
import { shortLocationLabel } from "@/services/locationService";
import { formatDistance, MISSING_PERSON_ALERT_RADIUS_KM } from "@/services/distanceService";
import type { SpeechLang } from "@/services/geminiService";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/voice")({
  head: () => ({
    meta: [
      { title: "Voice Call — WariMitra AI" },
      {
        name: "description",
        content:
          "Speak to WariMitra in Marathi. A hands-free browser voice call that finds medical camps, toilets, water and missing Warkaris.",
      },
      { property: "og:title", content: "Voice Call — WariMitra AI" },
      {
        property: "og:description",
        content: "A real browser microphone conversation with the WariMitra AI helpline prototype.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VoicePage,
});

const STATUS_TEXT: Record<string, Record<SpeechLang, string>> = {
  LISTENING: {
    "mr-IN": "ऐकत आहे…",
    "hi-IN": "सुन रहा हूँ…",
    "en-IN": "Listening…",
  },
  TRANSCRIBING: {
    "mr-IN": "ऐकत आहे…",
    "hi-IN": "सुन रहा हूँ…",
    "en-IN": "Listening…",
  },
  PROCESSING: {
    "mr-IN": "विचार करत आहे…",
    "hi-IN": "सोच रहा हूँ…",
    "en-IN": "Thinking…",
  },
  SPEAKING: {
    "mr-IN": "वारीमित्र बोलत आहे…",
    "hi-IN": "वारीमित्र बोल रहा है…",
    "en-IN": "WariMitra is speaking…",
  },
};

function VoicePage() {
  const call = useCallEngine();
  const support = useSpeechSupport();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  const active = call.state !== "IDLE" && call.state !== "ENDED";

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((v) => v + 1), 120);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [call.messages, call.partial]);

  const mmss = useMemo(
    () =>
      `${String(Math.floor(call.seconds / 60)).padStart(2, "0")}:${String(call.seconds % 60).padStart(2, "0")}`,
    [call.seconds],
  );

  const statusLine =
    call.state === "CALLING"
      ? "Connecting…"
      : (STATUS_TEXT[call.state]?.[call.lang] ??
        (call.state === "CONNECTED" ? "Connected" : "Call ended"));

  const listening = call.state === "LISTENING" || call.state === "TRANSCRIBING";
  const speaking = call.state === "SPEAKING";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">AI Voice Helpline</h1>
          <p className="mt-1 text-muted-foreground">
            Fully hands-free — press call once, then just speak in Marathi. No buttons, no typing.
          </p>
        </div>
        <DemoDataTag label="Prototype Demo Data" />
      </div>

      {!support.recognition && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>
            <strong>Speech recognition is not supported in this browser.</strong> The WariMitra
            voice call needs the Web Speech API — please use <strong>Google Chrome</strong> or{" "}
            <strong>Microsoft Edge</strong> on desktop or Android.
          </p>
        </div>
      )}
      {!support.synthesis && (
        <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Text-to-speech is unavailable in this browser, so replies will appear as text only.
        </div>
      )}
      {call.error && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <p>{call.error}</p>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* ---------- Phone screen ---------- */}
        <section className="overflow-hidden rounded-3xl border border-border bg-navy-grad text-navy-foreground shadow-elevated">
          <div className="flex items-center justify-between border-b border-navy-foreground/15 px-6 py-4">
            <div>
              <p className="text-lg font-bold">WariMitra AI</p>
              <p className="flex items-center gap-2 text-sm text-navy-foreground/75">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    active ? "bg-success" : "bg-navy-foreground/40",
                  )}
                />
                AI Voice Helpline · {active ? statusLine : "Not connected"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-bold tabular-nums">{mmss}</p>
              <p className="text-[11px] text-navy-foreground/60">Call duration</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-5 px-6 py-8">
            {/* Avatar */}
            <div className="relative grid place-items-center">
              {(listening || speaking) && (
                <>
                  <span className="pulse-ring absolute size-32 rounded-full bg-saffron/40" />
                  <span className="pulse-ring absolute size-32 rounded-full bg-saffron/25 [animation-delay:0.6s]" />
                </>
              )}
              <div
                className={cn(
                  "relative grid size-32 place-items-center rounded-full text-4xl font-extrabold text-navy transition-colors",
                  speaking ? "bg-gold" : listening ? "bg-saffron" : "bg-navy-foreground/85",
                )}
              >
                वारी
              </div>
            </div>

            {/* Waveform */}
            <div className="flex h-14 items-end gap-1">
              {Array.from({ length: 32 }).map((_, i) => {
                const amp = listening ? 34 : speaking ? 26 : 0;
                const h = amp ? 8 + Math.abs(Math.sin((i + tick * 0.6) * 0.6)) * amp : 6;
                return (
                  <span
                    key={i}
                    className={cn(
                      "w-1.5 rounded-full transition-all duration-150",
                      speaking ? "bg-gold" : "bg-saffron",
                      amp ? "" : "opacity-30",
                    )}
                    style={{ height: `${h}px` }}
                  />
                );
              })}
            </div>

            <div className="flex min-h-6 items-center gap-2 text-sm font-semibold text-navy-foreground/85">
              {call.state === "PROCESSING" && <Loader2 className="size-4 animate-spin" />}
              {speaking && <Volume2 className="size-4" />}
              {listening && <Mic className="size-4 text-saffron" />}
              {active ? statusLine : "Press call to start a voice conversation"}
            </div>

            {call.partial && (
              <p className="max-w-md rounded-2xl bg-navy-foreground/10 px-4 py-2 text-center text-sm italic">
                {call.partial}
              </p>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!active ? (
                <Button
                  size="lg"
                  onClick={call.startCall}
                  className="rounded-full bg-success px-8 text-base text-success-foreground hover:bg-success/90"
                >
                  <Phone className="size-5" /> कॉल करा · Call WariMitra
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={call.endCall}
                    className="rounded-full bg-destructive px-7 text-base text-destructive-foreground hover:bg-destructive/90"
                  >
                    <PhoneOff className="size-5" /> End Call
                  </Button>
                </>
              )}
            </div>

            <p className="text-center text-[11px] text-navy-foreground/60">
              Prototype simulation — a browser call, not a real telephone line or emergency dispatch
              service.
            </p>
          </div>
        </section>

        {/* ---------- Transcript + results ---------- */}
        <section className="flex flex-col gap-4">
          <div className="surface-panel flex min-h-[360px] flex-col p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold tracking-wide text-navy uppercase">
                Live conversation
              </h2>
              <DemoDataTag label={call.lang} />
            </div>
            <div ref={scrollRef} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
              {call.messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  The transcript appears here as you speak. WariMitra greets you first, then the
                  microphone opens automatically after every reply.
                </p>
              )}
              {call.messages.map((m) =>
                m.role === "system" ? (
                  <p
                    key={m.id}
                    className="rounded-xl border border-saffron/40 bg-saffron/10 px-3 py-2 text-xs font-bold tracking-wide text-navy uppercase"
                  >
                    {m.text}
                  </p>
                ) : (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                      m.role === "user"
                        ? "ml-auto bg-navy text-navy-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    <p className="mb-0.5 text-[10px] font-bold tracking-wide uppercase opacity-70">
                      {m.role === "user" ? "You" : "WariMitra"}
                    </p>
                    {m.text}
                  </div>
                ),
              )}
              {call.partial && (
                <div className="ml-auto max-w-[85%] rounded-2xl bg-navy/70 px-4 py-2 text-sm text-navy-foreground italic">
                  {call.partial}
                </div>
              )}
            </div>
          </div>

          {call.callerLocation && (
            <div className="surface-panel p-4 text-sm">
              <p className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Current location (from speech, no GPS)
              </p>
              <p className="mt-1 font-semibold text-navy">
                📍 {shortLocationLabel(call.callerLocation)}
              </p>
              <p className="text-xs text-muted-foreground">
                {call.callerLocation.latitude.toFixed(4)},{" "}
                {call.callerLocation.longitude.toFixed(4)} · confidence{" "}
                {call.callerLocation.confidence}
                {call.callerLocation.relative
                  ? ` · estimated from ${call.callerLocation.relative.minutes} min walk`
                  : ""}
              </p>
            </div>
          )}

          {call.alerts.length > 0 && (
            <div className="rounded-2xl border border-saffron/40 bg-saffron/10 p-4 text-sm">
              <p className="font-bold text-navy">Geo-fenced missing Warkari alerts announced</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {call.alerts.map((a) => (
                  <li key={a.name}>
                    {a.name} — {formatDistance(a.distanceKm)} away (within{" "}
                    {MISSING_PERSON_ALERT_RADIUS_KM} km)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {call.revealedContact && (
            <div className="rounded-2xl border border-success/40 bg-success/10 p-4 text-sm">
              <p className="font-bold text-navy">Reporter contact released after your sighting</p>
              <p className="mt-1 font-mono text-lg text-navy">{call.revealedContact}</p>
              <p className="text-xs text-muted-foreground">
                Shared only with callers who report a relevant sighting. Masked everywhere else.
              </p>
            </div>
          )}

          {call.emergency && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-bold text-destructive">Emergency guidance shown</p>
              <p className="mt-1 text-muted-foreground">
                Prototype Simulation — not a real emergency dispatch service. No ambulance or
                government service has been contacted.
              </p>
            </div>
          )}

          {call.nearby.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase">
                <Radio className="size-3.5" /> Live places search results (not official Wari
                facilities)
              </p>
              <div className="space-y-2">
                {call.nearby.map((p) => (
                  <div key={p.id} className="surface-panel flex items-center gap-3 p-3 text-sm">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-saffron/15 text-navy">
                      <MapPin className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-navy">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.address}</p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-navy">
                      {formatDistance(p.distanceKm)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}


          <HonestyNote />
        </section>
      </div>
    </div>
  );
}
