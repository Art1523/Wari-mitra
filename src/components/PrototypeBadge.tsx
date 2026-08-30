import { cn } from "@/lib/utils";

export function PrototypeBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-gold/60 bg-gold/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-navy uppercase",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-saffron" />
      Prototype • Wari 2026
    </span>
  );
}

export function DemoDataTag({
  className,
  label = "Demo Data",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}

export function HonestyNote({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      This is a prototype using demo data and a simulated call. Production deployment can integrate
      telephony, official Wari data, GPS-enabled smartphones and government emergency services.
    </p>
  );
}
