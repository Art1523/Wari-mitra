import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";
import { missingPersonService } from "@/services/missingPersonService";
import { useStore } from "@/hooks/useStore";
import { timeAgo } from "@/services/storage";
import { LOCATIONS } from "@/data/mockData";

export const Route = createFileRoute("/missing")({
  head: () => ({
    meta: [
      { title: "Report a Missing Warkari — WariMitra AI" },
      {
        name: "description",
        content:
          "Register a missing Warkari so a community voice alert can reach other callers along the Wari route.",
      },
      { property: "og:title", content: "Report a Missing Warkari — WariMitra AI" },
      {
        property: "og:description",
        content: "Missing-person reporting flow for the Pandharpur Wari prototype.",
      },
    ],
  }),
  component: MissingPage,
});

const EMPTY = {
  name: "",
  age: "",
  gender: "Male",
  clothing: "",
  height: "",
  lastSeen: "Jejuri",
  dindi: "",
  contact: "",
  description: "",
};

function MissingPage() {
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const read = useCallback(() => missingPersonService.list(), []);
  const [people] = useStore(missingPersonService.key, read);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Please enter the person's name.");
      return;
    }
    const person = missingPersonService.report({
      name: form.name.trim(),
      age: Number(form.age) || 0,
      gender: form.gender,
      clothing: form.clothing,
      height: form.height,
      lastSeen: form.lastSeen,
      dindi: form.dindi,
      contact: form.contact,
      description: form.description,
    });
    setSubmitted(person.name);
    setForm(EMPTY);
    toast.success("Missing Warkari alert activated.", {
      description: "A community voice alert will now play for new callers.",
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">Report a Missing Warkari</h1>
          <p className="mt-1 text-muted-foreground">
            हरवलेल्या वारकऱ्याची नोंद करा — details go into the community alert.
          </p>
        </div>
        <DemoDataTag />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={submit} className="surface-panel space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Vitthal Jadhav"
              />
            </Field>
            <Field label="Age">
              <Input
                value={form.age}
                onChange={(e) => set("age", e.target.value)}
                inputMode="numeric"
                placeholder="67"
              />
            </Field>
            <Field label="Gender">
              <select
                value={form.gender}
                onChange={(e) => set("gender", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </Field>
            <Field label="Height">
              <Input
                value={form.height}
                onChange={(e) => set("height", e.target.value)}
                placeholder="5 ft 4 in"
              />
            </Field>
            <Field label="Clothing" className="sm:col-span-2">
              <Input
                value={form.clothing}
                onChange={(e) => set("clothing", e.target.value)}
                placeholder="White kurta, white Gandhi cap, walking stick"
              />
            </Field>
            <Field label="Last Seen Location">
              <select
                value={form.lastSeen}
                onChange={(e) => set("lastSeen", e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                {LOCATIONS.map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Dindi Number">
              <Input
                value={form.dindi}
                onChange={(e) => set("dindi", e.target.value)}
                placeholder="128"
              />
            </Field>
            <Field label="Contact Number" className="sm:col-span-2">
              <Input
                value={form.contact}
                onChange={(e) => set("contact", e.target.value)}
                placeholder="+91 ..."
              />
            </Field>
            <Field label="Additional Description" className="sm:col-span-2">
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                placeholder="Speaks Marathi, hard of hearing, walking with Dindi 128."
              />
            </Field>
          </div>

          <Button type="submit" size="lg" className="w-full rounded-full">
            <Siren className="size-5" /> Submit Missing Person Alert
          </Button>
          <HonestyNote />
        </form>

        <div className="space-y-4">
          {submitted && (
            <div className="rise-in surface-panel border-success/40 bg-success/10 p-5">
              <p className="flex items-center gap-2 text-lg font-bold text-navy">
                <CheckCircle2 className="size-5 text-success" /> Missing Warkari alert activated.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {submitted} has been added to the community alert queue. New callers will hear the
                voice broadcast.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-full">
                  <Link to="/community">View Community Alert</Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to="/voice">Hear the voice broadcast</Link>
                </Button>
              </div>
            </div>
          )}

          <section className="surface-panel p-5">
            <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
              Registered reports
            </h3>
            <div className="mt-3 space-y-3">
              {people.map((p) => (
                <div key={p.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-navy">
                      {p.name}{" "}
                      <span className="text-sm font-medium text-muted-foreground">
                        · Age {p.age}
                      </span>
                    </p>
                    <span
                      className={
                        p.status === "SEARCHING"
                          ? "rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-bold text-destructive"
                          : "rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success"
                      }
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Last seen {p.lastSeen} · Dindi {p.dindi || "—"} · reported{" "}
                    {timeAgo(p.createdAt)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{p.clothing}</p>
                  <p className="mt-2 text-xs font-semibold text-saffron-deep">
                    {p.sightings.length} sighting{p.sightings.length === 1 ? "" : "s"} reported
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
