import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Eye, Megaphone, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";
import { missingPersonService } from "@/services/missingPersonService";
import { useStore } from "@/hooks/useStore";
import { timeAgo } from "@/services/storage";
import { broadcastLine } from "@/services/voiceService";
import { LOCATIONS } from "@/data/mockData";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community Alert — WariMitra AI" },
      {
        name: "description",
        content:
          "Active community alerts for missing Warkaris, with a one-tap “I Saw This Person” sighting report.",
      },
      { property: "og:title", content: "Community Alert — WariMitra AI" },
      {
        property: "og:description",
        content: "Warkaris helping Warkaris: community-powered missing-person search.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const read = useCallback(() => missingPersonService.active(), []);
  const [people] = useStore(missingPersonService.key, read);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ location: "Jejuri", timeSeen: "", info: "" });
  const [done, setDone] = useState(false);

  function submitSighting(personId: string) {
    missingPersonService.addSighting(personId, form);
    setDone(true);
    setOpenId(null);
    setForm({ location: "Jejuri", timeSeen: "", info: "" });
    toast.success("Sighting successfully reported to WariMitra.");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">Active Community Alert</h1>
          <p className="mt-1 text-muted-foreground">
            Every caller becomes a searcher — alerts are broadcast by voice to Warkaris on the same
            route.
          </p>
        </div>
        <DemoDataTag />
      </div>

      {done && (
        <div className="rise-in surface-panel mt-6 border-success/40 bg-success/10 p-4">
          <p className="font-bold text-navy">Sighting successfully reported to WariMitra.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The Volunteer Command Centre has received it.{" "}
            <Link to="/command" className="font-semibold text-saffron-deep hover:underline">
              Open Command Centre →
            </Link>
          </p>
        </div>
      )}

      {people.length === 0 && (
        <div className="surface-panel mt-6 p-8 text-center">
          <p className="text-lg font-bold text-navy">No active alerts right now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Register a report to activate a community alert.
          </p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/missing">Report a Missing Warkari</Link>
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-6">
        {people.map((p) => (
          <article key={p.id} className="surface-panel overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-navy-grad px-6 py-4 text-navy-foreground">
              <p className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                <Megaphone className="size-4 text-gold" /> Active community alert
              </p>
              <span className="rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground">
                STATUS: {p.status}
              </span>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-[220px_1fr]">
              <div>
                <div className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-border bg-muted text-muted-foreground">
                  <div className="text-center">
                    <UserRound className="mx-auto size-16 opacity-40" />
                    <p className="mt-2 text-xs font-semibold">Photo placeholder</p>
                    <p className="text-[10px]">Demo data — no real photo</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-navy">{p.name}</h2>
                <p className="text-lg text-muted-foreground">Age: {p.age}</p>

                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label="Last Seen" value={p.lastSeen} />
                  <Info label="Dindi" value={p.dindi || "—"} />
                  <Info label="Appearance" value={p.clothing || "—"} />
                  <Info label="Height" value={p.height || "—"} />
                </dl>

                {p.description && (
                  <p className="mt-4 text-sm text-muted-foreground">{p.description}</p>
                )}

                <div className="mt-5 rounded-2xl border border-gold/50 bg-gold/12 p-4">
                  <p className="text-[11px] font-bold tracking-widest text-navy uppercase">
                    Voice broadcast played to callers
                  </p>
                  <p className="mt-2 text-sm leading-relaxed font-semibold text-navy">
                    {broadcastLine("mr", p.name, p.age, p.lastSeen)}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    onClick={() => setOpenId(openId === p.id ? null : p.id)}
                  >
                    <Eye className="size-4" /> I Saw This Person
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      missingPersonService.markFound(p.id);
                      toast.success(`${p.name} marked as found.`);
                    }}
                  >
                    Mark as Found
                  </Button>
                </div>

                {openId === p.id && (
                  <div className="rise-in mt-5 rounded-2xl border border-border bg-muted/60 p-5">
                    <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
                      Report a sighting
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">
                          Current Location
                        </Label>
                        <select
                          value={form.location}
                          onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                          className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        >
                          {LOCATIONS.map((l) => (
                            <option key={l.name}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">
                          Time Seen
                        </Label>
                        <Input
                          value={form.timeSeen}
                          onChange={(e) => setForm((f) => ({ ...f, timeSeen: e.target.value }))}
                          placeholder="About 20 minutes ago"
                        />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase">
                          Additional Information
                        </Label>
                        <Textarea
                          value={form.info}
                          onChange={(e) => setForm((f) => ({ ...f, info: e.target.value }))}
                          rows={1}
                          placeholder="Was resting near the water point."
                        />
                      </div>
                    </div>
                    <Button className="mt-4 rounded-full" onClick={() => submitSighting(p.id)}>
                      Report Sighting
                    </Button>
                  </div>
                )}

                {p.sightings.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
                      Sightings ({p.sightings.length})
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {p.sightings.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-xl border border-border bg-background p-3 text-sm"
                        >
                          <p className="font-semibold text-navy">
                            {s.location} · {s.timeSeen || "time not stated"}
                          </p>
                          <p className="text-muted-foreground">{s.info || "No extra details."}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Reported {timeAgo(s.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      <HonestyNote className="mt-8" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-navy">{value}</dd>
    </div>
  );
}
