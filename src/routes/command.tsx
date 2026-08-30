import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Droplets,
  LayoutDashboard,
  Megaphone,
  Plus,
  Siren,
  Stethoscope,
  Toilet,
  Trash2,
  UserSearch,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/FacilityCard";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";
import { facilityService } from "@/services/facilityService";
import { maskPhone, missingPersonService } from "@/services/missingPersonService";
import { GeoFenceTester } from "@/components/GeoFenceTester";
import { MISSING_PERSON_ALERT_RADIUS_KM, formatDistance } from "@/services/distanceService";

import { ANNOUNCEMENT_TYPES, announcementService } from "@/services/announcementService";
import { voiceService } from "@/services/voiceService";
import { demoService } from "@/services/demoService";
import { useStore } from "@/hooks/useStore";
import { timeAgo } from "@/services/storage";
import {
  CATEGORY_META,
  LOCATIONS,
  type AnnouncementType,
  type Facility,
  type FacilityCategory,
  type FacilityStatus,
} from "@/data/mockData";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/command")({
  head: () => ({
    meta: [
      { title: "Volunteer Command Centre — WariMitra AI" },
      {
        name: "description",
        content:
          "Volunteer dashboard for Wari facilities, announcements, missing Warkaris, emergencies and call analytics.",
      },
      { property: "og:title", content: "Volunteer Command Centre — WariMitra AI" },
      {
        property: "og:description",
        content: "Manage facilities and broadcast live announcements to voice callers.",
      },
    ],
  }),
  component: CommandPage,
});

type SectionId =
  | "dashboard"
  | "facilities"
  | "medical"
  | "water"
  | "toilets"
  | "food"
  | "announcements"
  | "missing"
  | "emergency"
  | "analytics";

const NAV: { id: SectionId; label: string; icon: typeof LayoutDashboard; indent?: boolean }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "facilities", label: "Facilities", icon: BarChart3 },
  { id: "medical", label: "Medical Camps", icon: Stethoscope, indent: true },
  { id: "water", label: "Water Points", icon: Droplets, indent: true },
  { id: "toilets", label: "Toilets", icon: Toilet, indent: true },
  { id: "food", label: "Food Centres", icon: Utensils, indent: true },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "missing", label: "Missing Warkaris", icon: UserSearch },
  { id: "emergency", label: "Emergency Alerts", icon: Siren },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

const SECTION_CATEGORY: Partial<Record<SectionId, FacilityCategory>> = {
  medical: "Medical",
  water: "Water",
  toilets: "Toilet",
  food: "Food",
};

function CommandPage() {
  const [section, setSection] = useState<SectionId>("dashboard");

  const readFacilities = useCallback(() => facilityService.list(), []);
  const [facilities] = useStore(facilityService.key, readFacilities);
  const readMissing = useCallback(() => missingPersonService.list(), []);
  const [missing] = useStore(missingPersonService.key, readMissing);
  const readAnn = useCallback(() => announcementService.list(), []);
  const [announcements] = useStore(announcementService.key, readAnn);
  const readCalls = useCallback(() => voiceService.calls(), []);
  const [calls] = useStore(voiceService.key, readCalls);

  const stats = useMemo(() => {
    const by = (intent: string) => calls.filter((c) => c.intent === intent).length;
    return [
      { label: "Total Calls", value: calls.length, tone: "navy" },
      { label: "Medical Requests", value: by("Medical"), tone: "saffron" },
      { label: "Water Requests", value: by("Water"), tone: "navy" },
      { label: "Toilet Requests", value: by("Toilet"), tone: "navy" },
      { label: "Emergency Calls", value: by("Emergency"), tone: "destructive" },
      {
        label: "Active Missing Alerts",
        value: missing.filter((m) => m.status === "SEARCHING").length,
        tone: "destructive",
      },
    ];
  }, [calls, missing]);

  const intentData = useMemo(() => {
    const map = new Map<string, number>();
    calls.forEach((c) => map.set(c.intent, (map.get(c.intent) ?? 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [calls]);

  const locationData = useMemo(
    () =>
      LOCATIONS.map((l) => ({
        name: l.name,
        calls: calls.filter((c) => c.location === l.name).length,
        facilities: facilities.filter((f) => f.location === l.name).length,
      })),
    [calls, facilities],
  );

  const hourly = useMemo(
    () =>
      ["6h", "5h", "4h", "3h", "2h", "1h", "now"].map((name, i) => ({
        name,
        calls: 4 + Math.round(Math.abs(Math.sin(i * 1.3)) * 12) + (i === 6 ? calls.length % 7 : 0),
      })),
    [calls.length],
  );

  const sightings = missingPersonService.allSightings();

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <div className="rounded-2xl bg-sidebar p-3 text-sidebar-foreground">
          <p className="px-2 py-1 text-[11px] font-bold tracking-widest text-sidebar-foreground/60 uppercase">
            Volunteer Console
          </p>
          <nav className="mt-2 grid gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSection(n.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors",
                  n.indent && "ml-3 text-[13px]",
                  section === n.id
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
                )}
              >
                <n.icon className="size-4 shrink-0" />
                {n.label}
              </button>
            ))}
          </nav>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full rounded-xl border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => {
              demoService.resetAll();
              toast.success("Demo data reset across all screens.");
            }}
          >
            Reset demo data
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">Volunteer Command Centre</h1>
            <p className="mt-1 text-muted-foreground">
              Facilities, announcements and alerts feeding the voice assistant.
            </p>
          </div>
          <DemoDataTag />
        </div>

        {section === "dashboard" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="surface-panel p-5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {s.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-4xl font-bold",
                      s.tone === "destructive"
                        ? "text-destructive"
                        : s.tone === "saffron"
                          ? "text-saffron-deep"
                          : "text-navy",
                    )}
                  >
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard title="Calls by intent">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={intentData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                    >
                      {intentData.map((_, i) => (
                        <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Legend
                  items={intentData.map((d, i) => ({
                    label: `${d.name} (${d.value})`,
                    color: `var(--chart-${(i % 5) + 1})`,
                  }))}
                />
              </ChartCard>

              <ChartCard title="Calls over the last 6 hours">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={hourly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="calls"
                      stroke="var(--saffron-deep)"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="Calls and facilities by location">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={locationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="calls" fill="var(--saffron)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="facilities" fill="var(--navy-soft)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <Legend
                items={[
                  { label: "Calls", color: "var(--saffron)" },
                  { label: "Facilities", color: "var(--navy-soft)" },
                ]}
              />
            </ChartCard>
          </>
        )}

        {(section === "facilities" || SECTION_CATEGORY[section]) && (
          <FacilityManager facilities={facilities} filterCategory={SECTION_CATEGORY[section]} />
        )}

        {section === "announcements" && <AnnouncementManager announcements={announcements} />}

        {section === "missing" && (
          <div className="space-y-4">
            {missing.map((p) => (
              <div key={p.id} className="surface-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-navy">
                    {p.name} · Age {p.age}
                  </h3>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                      p.status === "SEARCHING"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success/15 text-success",
                    )}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Last known location: {p.lastKnownLocationText ?? p.lastSeen}
                  {p.lastKnownLatitude != null &&
                    ` (${p.lastKnownLatitude.toFixed(3)}, ${p.lastKnownLongitude?.toFixed(3)})`}
                  {p.locationConfidence ? ` · confidence ${p.locationConfidence}` : ""}
                </p>
                {p.lastLocationUpdatedAt && (
                  <p className="text-sm font-semibold text-success">
                    Last known location updated {timeAgo(p.lastLocationUpdatedAt)}
                  </p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  Dindi {p.dindi || "—"} · {p.clothing} · alert radius{" "}
                  {p.alertRadiusKm ?? MISSING_PERSON_ALERT_RADIUS_KM} km · reporter{" "}
                  {maskPhone(p.reporterPhoneNumber)}
                </p>
                <p className="mt-2 text-sm font-semibold text-saffron-deep">
                  {p.sightings.length} sighting report{p.sightings.length === 1 ? "" : "s"}
                  {p.sightings[0]?.distanceFromLastKnownKm != null &&
                    ` · latest ${formatDistance(p.sightings[0].distanceFromLastKnownKm)} from previous position`}
                </p>

                {p.status === "SEARCHING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 rounded-full"
                    onClick={() => {
                      missingPersonService.markFound(p.id);
                      toast.success(`${p.name} marked as found.`);
                    }}
                  >
                    Mark as Found
                  </Button>
                )}
              </div>
            ))}

            <section className="surface-panel p-5">
              <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
                Incoming sighting reports
              </h3>
              {sightings.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No sightings reported yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {sightings.map((s) => (
                    <li key={s.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-semibold text-navy">
                        {s.personName} seen at {s.location}
                      </p>
                      <p className="text-muted-foreground">
                        {s.timeSeen || "time not stated"} · {s.info || "no extra details"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Received {timeAgo(s.createdAt)}
                        {s.distanceFromLastKnownKm != null &&
                          ` · ${formatDistance(s.distanceFromLastKnownKm)} from the previous last-known position`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Privacy (prototype): reporter phone numbers are stored with the report and shown
                masked here. The full number is released only to a caller who reports a relevant
                sighting on the voice line.
              </p>
            </section>

            <GeoFenceTester />
          </div>
        )}


        {section === "emergency" && (
          <div className="surface-panel p-5">
            <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
              Emergency call log
            </h3>
            <ul className="mt-3 space-y-2">
              {calls
                .filter((c) => c.intent === "Emergency")
                .map((c) => (
                  <li
                    key={c.id}
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"
                  >
                    <p className="font-bold text-destructive">Medical emergency · {c.location}</p>
                    <p className="text-muted-foreground">
                      Language: {c.language} · received {timeAgo(c.createdAt)}
                    </p>
                  </li>
                ))}
              {calls.filter((c) => c.intent === "Emergency").length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No emergency calls in the current demo data.
                </li>
              )}
            </ul>
            <HonestyNote className="mt-4" />
          </div>
        )}

        {section === "analytics" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Requests by intent">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={intentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--saffron)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Facility status mix">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={(["OPEN", "BUSY", "CLOSED"] as FacilityStatus[]).map((s) => ({
                      name: s,
                      value: facilities.filter((f) => f.status === s).length,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={100}
                  >
                    <Cell fill="var(--success)" />
                    <Cell fill="var(--warning)" />
                    <Cell fill="var(--destructive)" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <Legend
                items={[
                  { label: "Open", color: "var(--success)" },
                  { label: "Busy", color: "var(--warning)" },
                  { label: "Closed", color: "var(--destructive)" },
                ]}
              />
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-panel p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-wide text-navy uppercase">{title}</h3>
        <DemoDataTag />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const EMPTY_FACILITY = {
  name: "",
  category: "Medical" as FacilityCategory,
  location: "Jejuri",
  landmark: "Jejuri Toll Plaza",
  openingHours: "24 hours",
  lat: "18.2769",
  lng: "74.1602",
  distanceM: "450",
  status: "OPEN" as FacilityStatus,
};

function FacilityManager({
  facilities,
  filterCategory,
}: {
  facilities: Facility[];
  filterCategory?: FacilityCategory | undefined;
}) {
  const [form, setForm] = useState(EMPTY_FACILITY);
  const [editingId, setEditingId] = useState<string | null>(null);

  const list = filterCategory
    ? facilities.filter((f) => f.category === filterCategory)
    : facilities;

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Facility name is required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category,
      location: form.location,
      landmark: form.landmark.trim() || form.location,
      openingHours: form.openingHours.trim() || "24 hours",
      lat: Number(form.lat) || 0,
      lng: Number(form.lng) || 0,
      distanceM: Number(form.distanceM) || 0,
      status: form.status,
    };
    if (editingId) {
      facilityService.update(editingId, payload);
      toast.success("Facility updated — voice assistant now serves the new details.");
    } else {
      facilityService.create(payload);
      toast.success("Facility added to the Wari database.");
    }
    setForm(EMPTY_FACILITY);
    setEditingId(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={save} className="surface-panel space-y-3 p-5">
        <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
          {editingId ? "Edit facility" : "Add facility"}
        </h3>
        <Row label="Facility Name">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Primary Medical Camp"
          />
        </Row>
        <Row label="Category">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as FacilityCategory })}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {(Object.keys(CATEGORY_META) as FacilityCategory[]).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Row>
        <Row label="Location">
          <select
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {LOCATIONS.map((l) => (
              <option key={l.name}>{l.name}</option>
            ))}
          </select>
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="Landmark">
            <Input
              value={form.landmark}
              onChange={(e) => setForm({ ...form, landmark: e.target.value })}
              placeholder="Jejuri Toll Plaza"
            />
          </Row>
          <Row label="Opening hours">
            <Input
              value={form.openingHours}
              onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
              placeholder="24 hours"
            />
          </Row>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Row label="Latitude">
            <Input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          </Row>
          <Row label="Longitude">
            <Input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          </Row>
          <Row label="Distance (m)">
            <Input
              value={form.distanceM}
              onChange={(e) => setForm({ ...form, distanceM: e.target.value })}
            />
          </Row>
        </div>
        <Row label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as FacilityStatus })}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option>OPEN</option>
            <option>BUSY</option>
            <option>CLOSED</option>
          </select>
        </Row>
        <div className="flex gap-2">
          <Button type="submit" className="rounded-full">
            <Plus className="size-4" /> {editingId ? "Save changes" : "Add Facility"}
          </Button>
          {editingId && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FACILITY);
              }}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>

      <section className="surface-panel p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
            {filterCategory ? `${filterCategory} facilities` : "All facilities"} ({list.length})
          </h3>
          <DemoDataTag />
        </div>
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
          {list.map((f) => (
            <div key={f.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-navy">{f.name}</p>
                <StatusPill status={f.status} />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {f.location} · {f.distanceM} m · {f.lat.toFixed(4)}, {f.lng.toFixed(4)} · updated{" "}
                {timeAgo(f.updatedAt)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["OPEN", "BUSY", "CLOSED"] as FacilityStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      facilityService.setStatus(f.id, s);
                      toast.success(`${f.name} marked ${s}.`);
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                      f.status === s
                        ? "border-navy bg-navy text-navy-foreground"
                        : "border-border text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(f.id);
                    setForm({
                      name: f.name,
                      category: f.category,
                      location: f.location,
                      landmark: f.landmark,
                      openingHours: f.openingHours,
                      lat: String(f.lat),
                      lng: String(f.lng),
                      distanceM: String(f.distanceM),
                      status: f.status,
                    });
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-[11px] font-bold text-navy hover:bg-accent"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    facilityService.remove(f.id);
                    toast("Facility deleted from the demo database.");
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AnnouncementManager({
  announcements,
}: {
  announcements: ReturnType<typeof announcementService.list>;
}) {
  const [type, setType] = useState<AnnouncementType>("Medical Camp Update");
  const [location, setLocation] = useState("Jejuri");
  const [message, setMessage] = useState("Medical Camp at Jejuri has shifted 300 meters east.");

  return (
    <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="surface-panel space-y-3 p-5">
        <h3 className="text-sm font-bold tracking-wide text-navy uppercase">Create announcement</h3>
        <Row label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AnnouncementType)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {ANNOUNCEMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Row>
        <Row label="Location">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {LOCATIONS.map((l) => (
              <option key={l.name}>{l.name}</option>
            ))}
          </select>
        </Row>
        <Row label="Message">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
        </Row>
        <Button
          className="rounded-full"
          onClick={() => {
            if (!message.trim()) {
              toast.error("Announcement message is required.");
              return;
            }
            announcementService.publish({ type, location, message: message.trim() });
            toast.success("Published — callers now hear this live announcement.");
          }}
        >
          <Megaphone className="size-4" /> Publish announcement
        </Button>
        <p className="text-xs text-muted-foreground">
          Published announcements appear immediately on the Voice Assistant screen as “NEW LIVE
          ANNOUNCEMENT”.
        </p>
      </section>

      <section className="surface-panel p-5">
        <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
          Published announcements
        </h3>
        <ul className="mt-3 space-y-2">
          {announcements.map((a) => (
            <li key={a.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-navy">{a.type}</p>
                <span className="text-xs text-muted-foreground">
                  {a.location} · {timeAgo(a.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.message}</p>
              <button
                type="button"
                onClick={() => announcementService.remove(a.id)}
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-destructive/40 px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3" /> Remove
              </button>
            </li>
          ))}
          {announcements.length === 0 && (
            <li className="text-sm text-muted-foreground">No announcements published.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
