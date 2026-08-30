import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { useState } from "react";
import { PrototypeBadge } from "./PrototypeBadge";
import { DemoModeToggle } from "./DemoModeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/voice", label: "Voice Assistant" },
  { to: "/facilities", label: "Facilities" },
  { to: "/missing", label: "Missing Warkari" },
  { to: "/community", label: "Community Alert" },
  { to: "/emergency", label: "Emergency" },
  { to: "/camps", label: "Medical Camps" },
  { to: "/command", label: "Command Centre" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-navy-grad text-lg font-bold text-navy-foreground shadow-soft">
            वा
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-navy">WariMitra AI</span>
            <span className="block text-[11px] font-medium text-muted-foreground">
              One Call. Every Warkari.
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-navy data-[status=active]:bg-navy data-[status=active]:text-navy-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <PrototypeBadge className="hidden sm:inline-flex" />
          <DemoModeToggle />
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setOpen((v) => !v)}
            className="grid size-10 place-items-center rounded-xl border border-border lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      <div
        className={cn("border-t border-border bg-background lg:hidden", open ? "block" : "hidden")}
      >
        <nav className="mx-auto grid max-w-7xl gap-1 px-4 py-3">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-2.5 text-base font-medium text-muted-foreground data-[status=active]:bg-navy data-[status=active]:text-navy-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
