import { nearbySearch, type PlaceResult } from "@/lib/maps.functions";
import { calculateDistanceKm } from "./distanceService";

/**
 * Dynamic facility discovery.
 *
 * Facilities are NOT hardcoded lists any more — they are searched live around
 * the caller's resolved coordinates through the configured Places provider
 * (Google Places API New, via the Lovable connector gateway). The provider sits
 * behind this abstraction so it can be swapped later.
 */

export type PlaceCategory =
  | "toilet"
  | "medical"
  | "hospital"
  | "pharmacy"
  | "water"
  | "food"
  | "rest"
  | "police"
  | "charging"
  | "parking"
  | "shop"
  | "help";

interface CategoryDef {
  /** Google Place types used for the structured nearby search. */
  types: string[];
  /** Text-search fallback query. */
  query: string;
  english: string;
  marathi: string;
  /** Spoken words (Marathi / Hindi / Hinglish / English) that map here. */
  aliases: string[];
}

export const CATEGORY_DEFS: Record<PlaceCategory, CategoryDef> = {
  toilet: {
    // Every Gram Panchayat maintains toilets, so the nearest Gram Panchayat
    // office is a dependable toilet answer when no public bathroom is mapped.
    types: ["public_bathroom", "local_government_office"],
    query: "public toilet gram panchayat office",
    english: "Toilet (public / Gram Panchayat)",
    marathi: "शौचालय (सार्वजनिक / ग्रामपंचायत)",
    aliases: [
      "शौचालय",
      "टॉयलेट",
      "संडास",
      "बाथरूम",
      "washroom",
      "toilet",
      "restroom",
      "sulabh",
      "शौच",
    ],
  },
  medical: {
    types: ["hospital", "doctor", "medical_lab"],
    query: "medical camp or clinic",
    english: "Nearby medical facility",
    marathi: "वैद्यकीय सुविधा",
    aliases: ["दवाखाना", "डॉक्टर", "वैद्यकीय", "मेडिकल कॅम्प", "clinic", "doctor", "medical camp", "इलाज"],
  },
  hospital: {
    types: ["hospital"],
    query: "hospital",
    english: "Nearby hospital",
    marathi: "रुग्णालय",
    aliases: ["हॉस्पिटल", "रुग्णालय", "hospital", "अस्पताल"],
  },
  pharmacy: {
    types: ["pharmacy", "drugstore"],
    query: "pharmacy medical store",
    english: "Pharmacy",
    marathi: "औषधाचे दुकान",
    aliases: ["मेडिकल", "औषध", "औषधी", "फार्मसी", "pharmacy", "medical store", "chemist", "दवा"],
  },
  water: {
    // Along the Wari route, drinking water is most reliably available as
    // packaged water bottles at hotels (restaurants) and medical stores, so
    // "water" searches those first instead of rare mapped water points.
    types: ["restaurant", "pharmacy", "convenience_store", "cafe"],
    query: "water bottle hotel medical store",
    english: "Drinking water (hotel / medical store)",
    marathi: "पिण्याचे पाणी (हॉटेल / मेडिकल स्टोअर)",
    aliases: ["पाणी", "पिण्याचे पाणी", "water", "पानी", "नळ"],
  },
  food: {
    types: ["restaurant", "meal_takeaway", "food_court"],
    query: "food or bhojanalay",
    english: "Food place",
    marathi: "जेवणाची सोय",
    aliases: ["जेवण", "अन्न", "भोजन", "हॉटेल", "खाणे", "food", "restaurant", "annadan", "महाप्रसाद"],
  },
  rest: {
    types: ["lodging", "campground", "park"],
    query: "rest area or dharamshala",
    english: "Rest area",
    marathi: "विश्रांती स्थळ",
    aliases: ["विश्रांती", "मुक्काम", "धर्मशाळा", "rest", "shelter", "lodge", "आराम"],
  },
  police: {
    types: ["police"],
    query: "police station help centre",
    english: "Police / help point",
    marathi: "पोलीस मदत केंद्र",
    aliases: ["पोलीस", "police", "चौकी", "मदत केंद्र", "help centre", "help center"],
  },
  charging: {
    types: ["electric_vehicle_charging_station"],
    query: "mobile charging point",
    english: "Charging point",
    marathi: "चार्जिंग पॉईंट",
    aliases: ["चार्जिंग", "charging", "मोबाईल चार्ज", "charge"],
  },
  parking: {
    types: ["parking"],
    query: "parking",
    english: "Parking",
    marathi: "पार्किंग",
    aliases: ["पार्किंग", "parking", "गाडी उभी"],
  },
  shop: {
    types: ["convenience_store", "grocery_store", "supermarket"],
    query: "general store",
    english: "Essential shop",
    marathi: "किराणा दुकान",
    aliases: ["दुकान", "किराणा", "जनरल स्टोअर", "shop", "store", "grocery"],
  },
  help: {
    types: ["local_government_office", "police"],
    query: "help centre",
    english: "Help centre",
    marathi: "मदत केंद्र",
    aliases: ["मदत", "help", "सहाय्य", "माहिती केंद्र"],
  },
};

/** Natural spoken language → one of our categories. */
export function normalizeCategory(text: string | null | undefined): PlaceCategory | null {
  if (!text) return null;
  const t = text.toLowerCase().trim();
  if (t in CATEGORY_DEFS) return t as PlaceCategory;
  // Longest alias first so "medical store" wins over "medical".
  const matches: { cat: PlaceCategory; len: number }[] = [];
  for (const [cat, def] of Object.entries(CATEGORY_DEFS) as [PlaceCategory, CategoryDef][]) {
    for (const alias of def.aliases) {
      if (t.includes(alias.toLowerCase())) matches.push({ cat, len: alias.length });
    }
  }
  if (!matches.length) return null;
  matches.sort((a, b) => b.len - a.len);
  return matches[0]!.cat;
}

export interface NearbyFacility extends PlaceResult {
  distanceKm: number;
  distanceM: number;
  category: PlaceCategory;
  categoryLabel: string;
  /** Always "places-api" for now — makes the honesty labelling explicit. */
  source: "places-api";
}

export type NearbyProvider = (data: {
  latitude: number;
  longitude: number;
  includedTypes: string[];
  textQuery: string;
  radiusM: number;
}) => Promise<{ places: PlaceResult[] }>;

/**
 * Never trust a provider's location bias as a distance boundary. Places text
 * search may return a popular result hundreds of kilometres away when nothing
 * matches nearby, so every result is independently measured and hard-filtered.
 */
function withinRequestedRadius(
  latitude: number,
  longitude: number,
  place: PlaceResult,
  radiusM: number,
): NearbyFacility | null {
  const distanceKm = calculateDistanceKm(latitude, longitude, place.latitude, place.longitude);
  if (!Number.isFinite(distanceKm) || distanceKm * 1000 > radiusM) return null;
  return {
    ...place,
    distanceKm,
    distanceM: Math.round(distanceKm * 1000),
    category: "help",
    categoryLabel: "",
    source: "places-api",
  };
}

export async function searchNearbyPlaces(
  latitude: number,
  longitude: number,
  category: PlaceCategory,
  radiusM = 8000,
  provider?: NearbyProvider,
): Promise<NearbyFacility[]> {
  const def = CATEGORY_DEFS[category];
  const data = {
      latitude,
      longitude,
      includedTypes: def.types,
      textQuery: def.query,
      radiusM,
  };
  const out = provider ? await provider(data) : await nearbySearch({ data });
  return out.places
    .map((place) => withinRequestedRadius(latitude, longitude, place, radiusM))
    .filter((place): place is NearbyFacility => place !== null)
    .map((place) => ({ ...place, category, categoryLabel: def.english }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function findNearestFacility(
  latitude: number,
  longitude: number,
  category: PlaceCategory,
  provider?: NearbyProvider,
): Promise<NearbyFacility | null> {
  // Widen locally only. Results outside each circle are discarded even when
  // the provider returns them, so a distant facility can never be announced.
  for (const radius of [3000, 8000, 15000]) {
    const results = await searchNearbyPlaces(latitude, longitude, category, radius, provider);
    const nearest = results[0];
    if (nearest) return nearest;
  }
  return null;
}

export async function searchFacilitiesByCategory(
  latitude: number,
  longitude: number,
  category: PlaceCategory,
  limit = 5,
): Promise<NearbyFacility[]> {
  const results = await searchNearbyPlaces(latitude, longitude, category, 10000);
  return results.slice(0, limit);
}

export const placesService = {
  normalizeCategory,
  searchNearbyPlaces,
  findNearestFacility,
  searchFacilitiesByCategory,
  CATEGORY_DEFS,
};
