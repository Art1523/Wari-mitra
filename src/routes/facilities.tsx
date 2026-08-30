import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { CATEGORY_META, LOCATIONS, type Facility, type FacilityCategory } from "@/data/mockData";
import { facilityService } from "@/services/facilityService";
import { useStore } from "@/hooks/useStore";
import { MapPanel } from "@/components/MapPanel";
import { FacilityCard, StatusPill } from "@/components/FacilityCard";
import { DemoDataTag, HonestyNote } from "@/components/PrototypeBadge";
import { timeAgo } from "@/services/storage";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/facilities")({
  head: () => ({
    meta: [
      { title: "Facility Finder — WariMitra AI" },
      {
        name: "description",
        content:
          "Browse medical camps, water points, toilets, food centres and help points along the Wari route.",
      },
      { property: "og:title", content: "Facility Finder — WariMitra AI" },
      {
        property: "og:description",
        content: "Schematic Wari route map with demo facility data and live status.",
      },
    ],
  }),
  component: FacilitiesPage,
});

const CATEGORIES = Object.keys(CATEGORY_META) as FacilityCategory[];

function FacilitiesPage() {
  const read = useCallback(() => facilityService.list(), []);
  const [all] = useStore(facilityService.key, read);
  const [location, setLocation] = useState("Jejuri");
  const [category, setCategory] = useState<FacilityCategory | "All">("All");
  const [activeId, setActiveId] = useState<string | undefined>();

  const filtered = useMemo(
    () =>
      all
        .filter((f) => f.location === location && (category === "All" || f.category === category))
        .sort((a, b) => a.distanceM - b.distanceM),
    [all, location, category],
  );

  const active: Facility | undefined = filtered.find((f) => f.id === activeId) ?? filtered[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-navy">Facility Finder</h1>
          <p className="mt-1 text-muted-foreground">
            Verified Wari facilities near each village and checkpoint.
          </p>
        </div>
        <DemoDataTag />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {LOCATIONS.map((l) => (
          <button
            key={l.name}
            type="button"
            onClick={() => setLocation(l.name)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              location === l.name
                ? "border-navy bg-navy text-navy-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {l.name} · {l.marathi}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              category === c
                ? "border-saffron bg-saffron text-saffron-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {c === "All" ? "All categories" : c}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <div className="space-y-4">
          <MapPanel
            facilities={filtered}
            activeId={active?.id}
            onSelect={(f) => setActiveId(f.id)}
            focusLocation={location}
          />
          {active && (
            <div className="surface-panel p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xl font-bold text-navy">{active.name}</h3>
                <StatusPill status={active.status} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Detail label="Category" value={active.category} />
                <Detail label="Location" value={active.location} />
                <Detail label="Approx. distance" value={`${active.distanceM} m`} />
                <Detail label="Last updated" value={timeAgo(active.updatedAt)} />
                <Detail label="Latitude" value={active.lat.toFixed(4)} />
                <Detail label="Longitude" value={active.lng.toFixed(4)} />
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">
                Distances are approximate demo values measured from the selected landmark.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            {filtered.length} facilities near {location}
          </p>
          {filtered.map((f) => (
            <FacilityCard
              key={f.id}
              facility={f}
              active={f.id === active?.id}
              onClick={() => setActiveId(f.id)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="surface-panel p-6 text-sm text-muted-foreground">
              No facilities of this category are recorded near {location} in the demo data.
            </p>
          )}
          <HonestyNote className="pt-2" />
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 font-semibold text-navy">{value}</dd>
    </div>
  );
}
