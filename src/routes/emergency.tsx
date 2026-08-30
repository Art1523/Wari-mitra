import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Ambulance, MapPin, PhoneCall, Share2, ShieldAlert, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency Response — WariMitra AI" },
      {
        name: "description",
        content:
          "Simulated emergency triage: nearest medical camp, volunteer and ambulance for a Warkari in distress.",
      },
      { property: "og:title", content: "Emergency Response — WariMitra AI" },
      { property: "og:description", content: "Prototype emergency flow for the Pandharpur Wari." },
    ],
  }),
  component: EmergencyPage,
});

const RESOURCES = [
  {
    icon: Stethoscope,
    title: "Nearest Medical Camp",
    value: "450 m",
    detail: "Primary Medical Camp, Jejuri · OPEN",
  },
  {
    icon: ShieldAlert,
    title: "Nearest Volunteer",
    value: "300 m",
    detail: "Seva volunteer, Dindi 128 corridor",
  },
  {
    icon: Ambulance,
    title: "Ambulance",
    value: "1.2 km",
    detail: "Wari medical convoy, Jejuri checkpoint",
  },
];

function EmergencyPage() {
  const [log, setLog] = useState<string[]>([]);

  const simulate = (action: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()} — ${action} (simulated)`, ...l]);
    toast("Prototype Simulation", { description: `${action} — no real service was contacted.` });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">Emergency Response</h1>
          <p className="mt-1 text-muted-foreground">
            Triggered when the assistant detects distress in the caller's words.
          </p>
        </div>
        <DemoDataTag label="Prototype Simulation" />
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border-2 border-destructive/40">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-destructive px-6 py-3 text-destructive-foreground">
          <p className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
            <ShieldAlert className="size-4" /> Emergency detected
          </p>
          <span className="rounded-full bg-destructive-foreground/20 px-3 py-1 text-xs font-bold">
            Prototype Simulation
          </span>
        </div>

        <div className="grid gap-6 bg-card p-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              Caller said
            </p>
            <p className="mt-2 rounded-2xl rounded-br-sm bg-saffron px-4 py-3 text-lg font-semibold text-saffron-foreground">
              एका व्यक्तीला चक्कर आली आहे.
            </p>
            <p className="mt-3 text-[11px] font-bold tracking-widest text-muted-foreground uppercase">
              WariMitra classified
            </p>
            <p className="mt-2 rounded-2xl bg-destructive/10 px-4 py-3 text-lg font-bold text-destructive">
              EMERGENCY · Medical
            </p>
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="size-4 text-saffron-deep" />
              Location identified from landmark — Jejuri, Dindi 128.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {RESOURCES.map((r) => (
              <div key={r.title} className="rounded-2xl border border-border bg-background p-4">
                <r.icon className="size-5 text-saffron-deep" />
                <p className="mt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {r.title}
                </p>
                <p className="mt-1 text-2xl font-bold text-navy">{r.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border bg-surface px-6 py-4">
          <Button className="rounded-full" onClick={() => simulate("Call Volunteer")}>
            <PhoneCall className="size-4" /> Call Volunteer
          </Button>
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/facilities">
              <Stethoscope className="size-4" /> View Medical Camp
            </Link>
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => simulate("Share Location")}
          >
            <Share2 className="size-4" /> Share Location
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-panel p-5">
          <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
            Simulated action log
          </h3>
          {log.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No actions yet. The buttons above record simulated dispatch events only.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {log.map((l) => (
                <li key={l} className="rounded-xl bg-muted px-3 py-2 text-muted-foreground">
                  {l}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-panel border-gold/50 bg-gold/10 p-5">
          <h3 className="text-sm font-bold tracking-wide text-navy uppercase">Honesty note</h3>
          <HonestyNote className="mt-2 text-sm" />
          <p className="mt-2 text-xs text-muted-foreground">
            No ambulance, helpline or government emergency service is contacted by this prototype.
          </p>
        </section>
      </div>
    </div>
  );
}
