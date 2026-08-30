import { MapPin } from "lucide-react";
import { LOCATIONS } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { DemoDataTag } from "./PrototypeBadge";

export type LocationMode = "Current village" | "Landmark" | "Dindi number" | "Checkpoint";

const MODES: LocationMode[] = ["Current village", "Landmark", "Dindi number", "Checkpoint"];

export function LocationPicker({
  location,
  mode,
  onLocationChange,
  onModeChange,
  className,
}: {
  location: string;
  mode: LocationMode;
  onLocationChange: (v: string) => void;
  onModeChange: (m: LocationMode) => void;
  className?: string;
}) {
  return (
    <section className={cn("surface-panel p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold tracking-wide text-navy uppercase">
          Location identification
        </h3>
        <DemoDataTag />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              mode === m
                ? "border-saffron bg-saffron text-saffron-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent",
            )}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {LOCATIONS.map((l) => (
          <button
            key={l.name}
            type="button"
            onClick={() => onLocationChange(l.name)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-all",
              location === l.name
                ? "border-navy bg-navy text-navy-foreground shadow-soft"
                : "border-border bg-background hover:border-saffron/60 hover:bg-accent",
            )}
          >
            <span className="block text-sm font-semibold">{l.name}</span>
            <span
              className={cn(
                "block text-xs",
                location === l.name ? "opacity-80" : "text-muted-foreground",
              )}
            >
              {l.marathi}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="size-4 shrink-0 text-saffron-deep" />
        Location identified from landmark —{" "}
        <span className="font-semibold text-navy">{location}</span> ({mode}). No automatic GPS is
        used in this prototype.
      </p>
    </section>
  );
}
