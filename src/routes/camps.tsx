import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { Download, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import {
  CAMP_TYPE_LABEL,
  campService,
  type CampDraft,
  type CampType,
  type MedicalCamp,
} from "@/services/campService";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";
import { timeAgo } from "@/services/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/camps")({
  head: () => ({
    meta: [
      { title: "Medical Camp Registry — WariMitra AI" },
      {
        name: "description",
        content:
          "Add, edit and manage Wari medical camps, first-aid posts and ambulance points from one simple dashboard.",
      },
      { property: "og:title", content: "Medical Camp Registry — WariMitra AI" },
      {
        property: "og:description",
        content: "Volunteer dashboard for registering medical camps along the Pandharpur Wari route.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampsPage,
});

const EMPTY: CampDraft = {
  name: "",
  type: "medical",
  village: "",
  landmark: "",
  contact: "",
  timings: "6:00 AM – 10:00 PM",
  facilities: "",
  active: true,
};

const TYPES = Object.keys(CAMP_TYPE_LABEL) as CampType[];

function CampsPage() {
  const read = useCallback(() => campService.list(), []);
  const [camps] = useStore(campService.key, read);
  const [draft, setDraft] = useState<CampDraft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return camps;
    return camps.filter((c) =>
      [c.name, c.village, c.landmark, CAMP_TYPE_LABEL[c.type]].join(" ").toLowerCase().includes(q),
    );
  }, [camps, query]);

  const set = <K extends keyof CampDraft>(k: K, v: CampDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.village.trim()) {
      setError("Camp name and village are required.");
      return;
    }
    setError("");
    if (editingId) campService.update(editingId, draft);
    else campService.add(draft);
    setDraft(EMPTY);
    setEditingId(null);
  }

  function startEdit(camp: MedicalCamp) {
    const { id: _id, createdAt: _createdAt, ...rest } = camp;
    setDraft(rest);
    setEditingId(camp.id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportCsv() {
    const blob = new Blob([campService.toCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "warimitra-medical-camps.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-navy sm:text-3xl">Medical Camp Registry</h1>
          <DemoDataTag label="Prototype / Demo Data" />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Add and manage medical camps, first-aid posts and ambulance points along the Wari route.
          Entries are saved in this browser only and do not change the voice assistant or facility
          finder.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <form
          onSubmit={submit}
          className="h-fit rounded-2xl border border-border bg-card p-5 shadow-soft"
        >
          <h2 className="flex items-center gap-2 text-lg font-semibold text-navy">
            <Plus className="size-4" />
            {editingId ? "Edit camp" : "Add a camp"}
          </h2>

          <div className="mt-4 grid gap-3">
            <Field label="Camp name *">
              <input
                className={inputCls}
                value={draft.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Jejuri Wari Medical Camp"
              />
            </Field>

            <Field label="Type">
              <select
                className={inputCls}
                value={draft.type}
                onChange={(e) => set("type", e.target.value as CampType)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CAMP_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Village / town *">
                <input
                  className={inputCls}
                  value={draft.village}
                  onChange={(e) => set("village", e.target.value)}
                  placeholder="Jejuri"
                />
              </Field>
              <Field label="Nearby landmark">
                <input
                  className={inputCls}
                  value={draft.landmark}
                  onChange={(e) => set("landmark", e.target.value)}
                  placeholder="Khandoba Mandir gate"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contact number">
                <input
                  className={inputCls}
                  value={draft.contact}
                  onChange={(e) => set("contact", e.target.value)}
                  placeholder="+91 98xxxxxxxx"
                />
              </Field>
              <Field label="Timings">
                <input
                  className={inputCls}
                  value={draft.timings}
                  onChange={(e) => set("timings", e.target.value)}
                />
              </Field>
            </div>

            <Field label="Facilities available">
              <textarea
                className={cn(inputCls, "min-h-20 resize-y")}
                value={draft.facilities}
                onChange={(e) => set("facilities", e.target.value)}
                placeholder="Doctor, ORS, bandaging, BP check, ambulance on standby"
              />
            </Field>

            <label className="flex items-center gap-2 text-sm font-medium text-navy">
              <input
                type="checkbox"
                className="size-4 accent-[hsl(var(--saffron,24_95%_53%))]"
                checked={draft.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              Currently open
            </label>

            {error && <p className="text-sm font-medium text-destructive">{error}</p>}

            <div className="mt-1 flex gap-2">
              <button
                type="submit"
                className="flex-1 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-navy-foreground transition-opacity hover:opacity-90"
              >
                {editingId ? "Save changes" : "Add camp"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(EMPTY);
                  }}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>
        </form>

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-52">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(inputCls, "pl-9")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search camps, villages, landmarks"
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filtered.length} of {camps.length}
            </span>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!camps.length}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-navy disabled:opacity-50"
            >
              <Download className="size-4" /> CSV
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {camps.length
                ? "No camps match your search."
                : "No camps added yet. Use the form to register the first one."}
            </div>
          ) : (
            <ul className="grid gap-3">
              {filtered.map((camp) => (
                <li
                  key={camp.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-soft"
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-navy">{camp.name}</h3>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            camp.active
                              ? "bg-emerald-500/15 text-emerald-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {camp.active ? "Open" : "Closed"}
                        </span>
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-navy uppercase">
                          {CAMP_TYPE_LABEL[camp.type]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {camp.village}
                        {camp.landmark && ` • ${camp.landmark}`}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {camp.timings}
                        {camp.contact && ` • ${camp.contact}`} • added {timeAgo(camp.createdAt)}
                      </p>
                      {camp.facilities && (
                        <p className="mt-2 text-sm text-foreground/80">{camp.facilities}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={`Edit ${camp.name}`}
                        onClick={() => startEdit(camp)}
                        className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-navy"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${camp.name}`}
                        onClick={() => campService.remove(camp.id)}
                        className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <HonestyNote className="mt-8" />
    </main>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-navy";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
