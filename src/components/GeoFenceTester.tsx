import { useState } from "react";
import { MapPin, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MISSING_PERSON_ALERT_RADIUS_KM,
  calculateDistanceKm,
  formatDistance,
  isWithinAlertRadius,
} from "@/services/distanceService";
import { missingPersonService } from "@/services/missingPersonService";
import { resolveSpokenLocation, shortLocationLabel } from "@/services/locationService";

interface Row {
  person: string;
  distanceKm: number;
  eligible: boolean;
}

/**
 * 100 km geo-fence test.
 * Uses the SAME distanceService + missingPersonService logic the live voice
 * call uses — nothing here is faked in the UI.
 */
export function GeoFenceTester() {
  const [query, setQuery] = useState("Jejuri");
  const [caller, setCaller] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(place: string) {
    setBusy(true);
    setError(null);
    setRows(null);
    try {
      const loc = await resolveSpokenLocation(place);
      if (!loc) {
        setError(`Could not resolve “${place}” to real coordinates.`);
        return;
      }
      setCaller(`${shortLocationLabel(loc)} (${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)})`);
      const eligibleIds = new Set(
        missingPersonService
          .eligibleAlerts(loc.latitude, loc.longitude, 99)
          .map((e) => e.person.id),
      );
      setRows(
        missingPersonService.active().map((p) => {
          const distanceKm =
            p.lastKnownLatitude != null && p.lastKnownLongitude != null
              ? calculateDistanceKm(
                  loc.latitude,
                  loc.longitude,
                  p.lastKnownLatitude,
                  p.lastKnownLongitude,
                )
              : Number.POSITIVE_INFINITY;
          return {
            person: p.name,
            distanceKm,
            eligible:
              eligibleIds.has(p.id) &&
              isWithinAlertRadius(distanceKm, p.alertRadiusKm ?? MISSING_PERSON_ALERT_RADIUS_KM),
          };
        }),
      );
    } catch {
      setError("Location lookup failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-panel p-5">
      <h3 className="flex items-center gap-2 text-sm font-bold tracking-wide text-navy uppercase">
        <Ruler className="size-4" /> {MISSING_PERSON_ALERT_RADIUS_KM} km alert radius test
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter where a caller is. Real geocoding plus the same Haversine filter the voice call uses
        decides which missing-Warkari alerts that caller would hear.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Caller location, e.g. Jejuri or Nagpur"
          className="max-w-xs"
        />
        <Button disabled={busy || !query.trim()} onClick={() => void run(query)}>
          {busy ? "Checking…" : "Run test"}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => { setQuery("Jejuri"); void run("Jejuri"); }}>
          Case A · Jejuri
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => { setQuery("Nagpur"); void run("Nagpur"); }}>
          Case B · Nagpur
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {caller && rows && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-center gap-2 font-semibold text-navy">
            <MapPin className="size-4" /> Caller at {caller}
          </p>
          {rows.length === 0 && <p className="text-muted-foreground">No active missing reports.</p>}
          {rows.map((r) => (
            <div
              key={r.person}
              className="flex items-center justify-between rounded-xl border border-border p-3"
            >
              <span className="font-semibold text-navy">{r.person}</span>
              <span className="text-muted-foreground">
                {Number.isFinite(r.distanceKm) ? formatDistance(r.distanceKm) : "no coordinates"}
              </span>
              <span
                className={
                  r.eligible
                    ? "rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success"
                    : "rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground"
                }
              >
                {r.eligible ? "ALERT ANNOUNCED" : "NO ALERT"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
