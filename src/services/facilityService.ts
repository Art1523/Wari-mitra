import {
  LANDMARK_ALIASES,
  LOCATION_ALIASES,
  ROUTE_LEG_KM,
  ROUTE_SEQUENCE,
  SEED_FACILITIES,
  WALKING_KMPH,
  type Facility,
  type FacilityCategory,
  type FacilityStatus,
} from "@/data/mockData";
import { readKey, subscribe, uid, writeKey } from "./storage";

const KEY = "facilities";

/** Spoken facility words (English keys used by the AI) → database categories. */
const CATEGORY_FROM_TYPE: Record<string, FacilityCategory> = {
  toilet: "Toilet",
  washroom: "Toilet",
  medical: "Medical",
  hospital: "Medical",
  doctor: "Medical",
  water: "Water",
  food: "Food",
  pharmacy: "Pharmacy",
  medicine: "Pharmacy",
  shop: "Food",
  rest: "Rest",
  shelter: "Rest",
  police: "Police",
  help: "Police",
  charging: "Charging",
};

export function categoryFromType(type?: string | null): FacilityCategory | undefined {
  if (!type) return undefined;
  const t = type.trim().toLowerCase();
  return CATEGORY_FROM_TYPE[t] ?? CATEGORY_FROM_TYPE[t.split(/\s+/)[0] ?? ""];
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Fuzzy-match a spoken phrase ("जेजुरी टोल प्लाझाजवळ", "jejuri toll") to a
 * known landmark and/or route village. Deterministic — the AI never invents these.
 */
export function resolvePlace(spoken?: string | null): {
  landmark?: string | undefined;
  location?: string | undefined;
} {
  if (!spoken) return {};
  const text = norm(spoken);
  if (!text) return {};

  let landmark: string | undefined;
  let best = 0;
  for (const [name, aliases] of Object.entries(LANDMARK_ALIASES)) {
    for (const alias of [name, ...aliases]) {
      const a = norm(alias);
      if (a && text.includes(a) && a.length > best) {
        best = a.length;
        landmark = name;
      }
    }
  }

  let location: string | undefined;
  if (landmark) {
    location = facilityService.list().find((f) => f.landmark === landmark)?.location;
  }
  if (!location) {
    for (const [name, aliases] of Object.entries(LOCATION_ALIASES)) {
      for (const alias of [name, ...aliases]) {
        if (text.includes(norm(alias))) location = name;
      }
    }
  }
  return { landmark, location };
}

/** Mock implementation. Swap the body of each function for a REST call later. */
export const facilityService = {
  key: KEY,
  subscribe: (fn: () => void) => subscribe(KEY, fn),

  list(): Facility[] {
    return readKey<Facility[]>(KEY, SEED_FACILITIES);
  },

  byLocation(location: string): Facility[] {
    return facilityService
      .list()
      .filter((f) => f.location === location)
      .sort((a, b) => a.distanceM - b.distanceM);
  },

  /** All facilities attached to a landmark, nearest first. */
  searchFacilitiesByLandmark(landmark: string): Facility[] {
    const { landmark: resolved, location } = resolvePlace(landmark);
    const list = facilityService.list();
    const exact = list.filter((f) => f.landmark === (resolved ?? landmark));
    if (exact.length) return exact.sort((a, b) => a.distanceM - b.distanceM);
    if (location) return facilityService.byLocation(location);
    return [];
  },

  getFacilityByCategory(category: FacilityCategory): Facility[] {
    return facilityService
      .list()
      .filter((f) => f.category === category)
      .sort((a, b) => a.distanceM - b.distanceM);
  },

  /**
   * Deterministic search: landmark first, then the surrounding village.
   * Closed facilities are pushed to the end but never hidden.
   */
  findNearbyFacilities(place: string, category?: FacilityCategory): Facility[] {
    const { landmark, location } = resolvePlace(place);
    const list = facilityService.list();
    const scoped = landmark
      ? list.filter((f) => f.landmark === landmark || f.location === location)
      : location
        ? list.filter((f) => f.location === location)
        : [];
    return scoped
      .filter((f) => (category ? f.category === category : true))
      .sort((a, b) => {
        const rank = (f: Facility) =>
          (f.landmark === landmark ? 0 : 1) * 10000 +
          (f.status === "CLOSED" ? 5000 : 0) +
          f.distanceM;
        return rank(a) - rank(b);
      });
  },

  findNearestFacility(place: string, category?: FacilityCategory): Facility | undefined {
    return facilityService.findNearbyFacilities(place, category)[0];
  },

  nearest(location: string, category: FacilityCategory): Facility | undefined {
    return facilityService
      .byLocation(location)
      .filter((f) => f.category === category && f.status !== "CLOSED")[0];
  },

  create(data: Omit<Facility, "id" | "updatedAt">): Facility {
    const facility: Facility = { ...data, id: uid(), updatedAt: new Date().toISOString() };
    writeKey(KEY, [facility, ...facilityService.list()]);
    return facility;
  },

  update(id: string, patch: Partial<Facility>): void {
    writeKey(
      KEY,
      facilityService
        .list()
        .map((f) => (f.id === id ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f)),
    );
  },

  setStatus(id: string, status: FacilityStatus) {
    facilityService.update(id, { status });
  },

  remove(id: string): void {
    writeKey(
      KEY,
      facilityService.list().filter((f) => f.id !== id),
    );
  },

  reset(): void {
    writeKey(KEY, SEED_FACILITIES);
  },
};

/* ------------------------------------------------------------------ *
 * Travel-time location estimate
 * A caller with no landmark can say: "we left Jejuri about 30 minutes ago".
 * We map that to a point along the route using an average walking speed.
 * PROTOTYPE ESTIMATE — no GPS is used anywhere in this app.
 * ------------------------------------------------------------------ */

const MINUTE_WORDS: Record<string, number> = {
  "अर्धा तास": 30,
  "पाऊण तास": 45,
  "एक तास": 60,
  "दीड तास": 90,
  "दोन तास": 120,
  "half an hour": 30,
  "one hour": 60,
  "two hours": 120,
  "पाच मिनिट": 5,
  "दहा मिनिट": 10,
  "पंधरा मिनिट": 15,
  "वीस मिनिट": 20,
  "पंचवीस मिनिट": 25,
  "तीस मिनिट": 30,
  "चाळीस मिनिट": 40,
  "पन्नास मिनिट": 50,
};

/** Minutes mentioned in spoken Marathi / Hindi / English, or undefined. */
export function parseElapsedMinutes(spoken?: string | null): number | undefined {
  if (!spoken) return undefined;
  const text = spoken.toLowerCase();
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(तास|घंटे|घंटा|hour|hr)/);
  const mins = text.match(/(\d{1,3})\s*(मिनिट|मिनिटे|मिनट|minute|min)/);
  let total = 0;
  if (hours) total += Number(hours[1]) * 60;
  if (mins) total += Number(mins[1]);
  if (total > 0) return total;
  for (const [phrase, value] of Object.entries(MINUTE_WORDS)) {
    if (text.includes(phrase)) return value;
  }
  return undefined;
}

export interface TravelEstimate {
  fromVillage: string;
  minutes: number;
  walkedKm: number;
  /** Village whose facilities are closest to the estimated position. */
  estimatedLocation: string;
  nextVillage?: string | undefined;
  remainingKm?: number | undefined;
}

/**
 * Estimate the caller's position from "we left <village> <N> minutes ago".
 * Returns undefined when either the village or the elapsed time is missing.
 */
export function estimateLocationFromTravel(spoken?: string | null): TravelEstimate | undefined {
  if (!spoken) return undefined;
  const minutes = parseElapsedMinutes(spoken);
  const { location } = resolvePlace(spoken);
  if (!minutes || !location) return undefined;

  const index = ROUTE_SEQUENCE.indexOf(location);
  if (index === -1) return undefined;

  const legKm = ROUTE_LEG_KM[location] ?? 0;
  const walkedKm = Math.round((minutes / 60) * WALKING_KMPH * 10) / 10;
  const nextVillage = ROUTE_SEQUENCE[index + 1];
  const remainingKm = legKm ? Math.max(0, Math.round((legKm - walkedKm) * 10) / 10) : undefined;

  // Past the halfway point of the leg, the next village is the nearer one.
  const estimatedLocation =
    nextVillage && legKm > 0 && walkedKm > legKm / 2 ? nextVillage : location;

  return { fromVillage: location, minutes, walkedKm, estimatedLocation, nextVillage, remainingKm };
}
