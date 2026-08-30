import { LOCATIONS, type Facility } from "@/data/mockData";
import { CategoryIcon } from "./CategoryIcon";
import { cn } from "@/lib/utils";
import { DemoDataTag } from "./PrototypeBadge";

/**
 * Schematic route map. Intentionally not a real map SDK — the prototype
 * visualises the Wari corridor and facility markers using mock coordinates.
 */
export function MapPanel({
  facilities,
  activeId,
  onSelect,
  focusLocation,
}: {
  facilities: Facility[];
  activeId?: string | undefined;
  onSelect?: ((f: Facility) => void) | undefined;
  focusLocation?: string | undefined;
}) {
  const anchor = LOCATIONS.find((l) => l.name === focusLocation) ?? LOCATIONS[1]!;

  return (
    <div className="surface-panel relative overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
          Wari Route Map (schematic)
        </h3>
        <DemoDataTag label="Mock Map" />
      </div>

      <div className="relative h-[320px] w-full bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklab,var(--gold)_18%,transparent),transparent_55%),radial-gradient(circle_at_80%_80%,color-mix(in_oklab,var(--saffron)_16%,transparent),transparent_55%)] sm:h-[420px]">
        <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:36px_36px]" />

        <svg
          className="absolute inset-0 size-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <polyline
            points={LOCATIONS.map((l) => `${l.x},${l.y}`).join(" ")}
            fill="none"
            stroke="var(--saffron)"
            strokeWidth="1.1"
            strokeDasharray="3 2"
            strokeLinecap="round"
          />
        </svg>

        {LOCATIONS.map((l) => (
          <div
            key={l.name}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ left: `${l.x}%`, top: `${l.y}%` }}
          >
            <span
              className={cn(
                "mx-auto block size-3 rounded-full ring-4",
                l.name === anchor.name ? "bg-navy ring-navy/20" : "bg-saffron-deep ring-saffron/20",
              )}
            />
            <span className="mt-1 block rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-bold text-navy">
              {l.name}
            </span>
          </div>
        ))}

        {facilities.slice(0, 12).map((f, i) => {
          const angle = (i / Math.max(1, Math.min(facilities.length, 12))) * Math.PI * 2;
          const radius = 8 + (f.distanceM / 1400) * 12;
          const left = Math.min(95, Math.max(5, anchor.x + Math.cos(angle) * radius));
          const top = Math.min(92, Math.max(6, anchor.y + Math.sin(angle) * radius));
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onSelect?.(f)}
              title={`${f.name} · ${f.distanceM} m`}
              className={cn(
                "absolute grid size-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border bg-card text-saffron-deep shadow-soft transition-transform hover:scale-110",
                activeId === f.id ? "border-saffron ring-2 ring-saffron/50" : "border-border",
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <CategoryIcon category={f.category} className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
