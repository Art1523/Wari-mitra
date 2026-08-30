import { CATEGORY_META, type Facility } from "@/data/mockData";
import { CategoryIcon } from "./CategoryIcon";
import { timeAgo } from "@/services/storage";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<Facility["status"], string> = {
  OPEN: "bg-success/12 text-success border-success/30",
  BUSY: "bg-warning/20 text-warning-foreground border-warning/40",
  CLOSED: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusPill({ status }: { status: Facility["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide",
        STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

export function FacilityCard({
  facility,
  active,
  onClick,
  compact,
}: {
  facility: Facility;
  active?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const meta = CATEGORY_META[facility.category];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "surface-panel w-full p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-elevated",
        active && "border-saffron ring-2 ring-saffron/40",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-saffron-deep">
          <CategoryIcon category={facility.category} className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="truncate text-base font-bold text-navy">{facility.name}</h4>
            <StatusPill status={facility.status} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {facility.category} · {meta.marathi} · {facility.landmark}, {facility.location}
          </p>
          {!compact && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="font-semibold text-saffron-deep">≈ {facility.distanceM} m</span>
              <span>{facility.openingHours}</span>
              <span>Updated {timeAgo(facility.updatedAt)}</span>
            </div>
          )}
          {facility.note && (
            <p className="mt-2 text-xs text-muted-foreground italic">{facility.note}</p>
          )}
        </div>
      </div>
    </button>
  );
}
