import { SEED_MISSING, type MissingPerson, type Sighting } from "@/data/mockData";
import { readKey, subscribe, uid, writeKey } from "./storage";
import {
  MISSING_PERSON_ALERT_RADIUS_KM,
  calculateDistanceKm,
  isWithinAlertRadius,
} from "./distanceService";

const KEY = "missing";

export interface EligibleAlert {
  person: MissingPerson;
  distanceKm: number;
}

/** 98******45 — phone numbers are never shown in full in the UI. */
export function maskPhone(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 6) return phone ? "•••••" : "—";
  const last = digits.slice(-2);
  const first = digits.slice(0, 2);
  return `${first}${"*".repeat(Math.max(4, digits.length - 4))}${last}`;
}

export const missingPersonService = {
  key: KEY,
  alertRadiusKm: MISSING_PERSON_ALERT_RADIUS_KM,
  subscribe: (fn: () => void) => subscribe(KEY, fn),

  list(): MissingPerson[] {
    return readKey<MissingPerson[]>(KEY, SEED_MISSING);
  },

  active(): MissingPerson[] {
    return missingPersonService.list().filter((p) => p.status === "SEARCHING");
  },

  get(id: string) {
    return missingPersonService.list().find((p) => p.id === id);
  },

  report(
    data: Omit<MissingPerson, "id" | "status" | "createdAt" | "sightings">,
  ): MissingPerson {
    const person: MissingPerson = {
      alertRadiusKm: MISSING_PERSON_ALERT_RADIUS_KM,
      ...data,
      id: uid(),
      status: "SEARCHING",
      createdAt: new Date().toISOString(),
      sightings: [],
    };
    writeKey(KEY, [person, ...missingPersonService.list()]);
    return person;
  },

  /**
   * Geo-fenced community alerts.
   *
   * Only active reports whose LAST KNOWN location is within the alert radius of
   * the CALLER's location are eligible. Records without coordinates are never
   * broadcast — we cannot prove they are nearby.
   */
  eligibleAlerts(
    callerLatitude: number,
    callerLongitude: number,
    limit = 3,
  ): EligibleAlert[] {
    return missingPersonService
      .active()
      .flatMap((person) => {
        if (person.lastKnownLatitude == null || person.lastKnownLongitude == null) return [];
        const distanceKm = calculateDistanceKm(
          callerLatitude,
          callerLongitude,
          person.lastKnownLatitude,
          person.lastKnownLongitude,
        );
        const radius = person.alertRadiusKm ?? MISSING_PERSON_ALERT_RADIUS_KM;
        return isWithinAlertRadius(distanceKm, radius) ? [{ person, distanceKm }] : [];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
  },

  addSighting(
    personId: string,
    data: Omit<Sighting, "id" | "personId" | "createdAt">,
  ): Sighting {
    const person = missingPersonService.get(personId);
    let distanceFromLastKnownKm: number | undefined;
    if (
      person?.lastKnownLatitude != null &&
      person.lastKnownLongitude != null &&
      data.latitude != null &&
      data.longitude != null
    ) {
      distanceFromLastKnownKm = calculateDistanceKm(
        person.lastKnownLatitude,
        person.lastKnownLongitude,
        data.latitude,
        data.longitude,
      );
    }

    const sighting: Sighting = {
      ...data,
      ...(distanceFromLastKnownKm != null ? { distanceFromLastKnownKm } : {}),
      id: uid(),
      personId,
      createdAt: new Date().toISOString(),
    };

    writeKey(
      KEY,
      missingPersonService.list().map((p) => {
        if (p.id !== personId) return p;
        const updated: MissingPerson = { ...p, sightings: [sighting, ...p.sightings] };
        // A sighting with real coordinates becomes the new last-known location.
        if (data.latitude != null && data.longitude != null) {
          updated.lastKnownLocationText = data.location;
          updated.lastKnownLatitude = data.latitude;
          updated.lastKnownLongitude = data.longitude;
          updated.lastSeen = data.location;
          if (data.locationConfidence) updated.locationConfidence = data.locationConfidence;
          updated.lastLocationUpdatedAt = new Date().toISOString();
        }
        return updated;
      }),
    );
    return sighting;
  },

  markFound(personId: string) {
    writeKey(
      KEY,
      missingPersonService
        .list()
        .map((p) => (p.id === personId ? { ...p, status: "FOUND" as const } : p)),
    );
  },

  allSightings(): (Sighting & { personName: string })[] {
    return missingPersonService
      .list()
      .flatMap((p) => p.sightings.map((s) => ({ ...s, personName: p.name })))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  reset() {
    writeKey(KEY, SEED_MISSING);
  },
};
