import { cn } from "@/lib/utils";

const ASSIST = [
  "WARKARI",
  "VOICE CALL / VOICE INTERFACE",
  "AI UNDERSTANDS REQUEST",
  "LOCATION FROM LANDMARK / VILLAGE / DINDI / CHECKPOINT",
  "WARI FACILITY DATABASE",
  "ANSWER",
];

const MISSING = [
  "WARKARI REPORT",
  "MISSING PERSON DATABASE",
  "COMMUNITY ALERT",
  "ANOTHER WARKARI",
  "SIGHTING REPORT",
  "VOLUNTEER COMMAND CENTRE",
];

export function ArchitectureFlow({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-6 lg:grid-cols-2", className)}>
      <Flow title="Assistance flow" steps={ASSIST} accent="saffron" />
      <Flow title="Missing Warkari flow" steps={MISSING} accent="navy" />
    </div>
  );
}

function Flow({
  title,
  steps,
  accent,
}: {
  title: string;
  steps: string[];
  accent: "saffron" | "navy";
}) {
  return (
    <div className="surface-panel p-6">
      <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase">{title}</h3>
      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => (
          <li key={s}>
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm font-bold tracking-wide",
                accent === "saffron"
                  ? "border-saffron/40 bg-saffron/10 text-navy"
                  : "border-navy/20 bg-navy/5 text-navy",
              )}
            >
              {s}
            </div>
            {i < steps.length - 1 && (
              <div className="flex justify-center py-1 text-lg leading-none text-saffron-deep">
                ↓
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
