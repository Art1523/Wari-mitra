import { geocodeQuery, placeLookup, type GeoResult } from "@/lib/maps.functions";
import { aiComplete } from "@/lib/ai.functions";

/**
 * Last-resort place-name normaliser for noisy phone transcripts.
 * Returns an English place name ("Belhe, Maharashtra") or null.
 */
async function aiPlaceGuess(spoken: string): Promise<string | null> {
  if (spoken.trim().length < 2) return null;
  try {
    const out = await aiComplete({
      data: {
        messages: [
          {
            role: "system",
            content:
              "You convert noisy Marathi/Hindi phone-call speech into a single real place name in Maharashtra, India (village, town, temple, bus stand or highway landmark) along or near the Pandharpur Wari route. Reply with ONLY the place name in English transliteration followed by ', Maharashtra, India'. If no place is mentioned, reply exactly NONE.",
          },
          { role: "user", content: spoken.slice(0, 300) },
        ],
      },
    });
    const text = (out.text ?? "").trim().split("\n")[0]?.trim() ?? "";
    if (!text || /^none$/i.test(text)) return null;
    return text.slice(0, 120);
  } catch (err) {
    console.error("[location] AI place guess failed", String(err));
    return null;
  }
}

/**
 * Natural spoken location → coordinates.
 *
 * The real Warkari may be on a feature phone with no GPS, so location comes
 * from speech only: a village, temple, toll plaza, bus stand, road, junction,
 * Dindi camp or a relative description ("we left Jejuri 30 minutes ago").
 *
 * Coordinates are NEVER invented — they come from Google geocoding through the
 * server function. When nothing resolves we return null and the agent asks a
 * better question.
 */

export type LocationConfidence = "high" | "medium" | "low";

export interface ResolvedLocation {
  /** What the caller effectively described, in a human readable form. */
  text: string;
  /** Exactly what the caller said. */
  spokenText: string;
  latitude: number;
  longitude: number;
  confidence: LocationConfidence;
  /** Set when the position was inferred from "N minutes after <village>". */
  relative?: {
    village: string;
    minutes: number;
    direction: "after" | "before";
    approxKm: number;
  };
  resolvedAt: string;
}

function isMaharashtraResult(result: GeoResult): boolean {
  return /maharashtra|महाराष्ट्र/i.test(result.text);
}

export interface LocationProviders {
  geocode: (query: string) => Promise<{ results: GeoResult[] }>;
  placeLookup: (query: string) => Promise<{ results: GeoResult[] }>;
  normalizePlace: (spoken: string) => Promise<string | null>;
}

/** Typical Warkari walking speed (km/h) used for relative estimates. */
export const WALKING_KMPH = 4;

const DEVANAGARI_DIGITS: Record<string, string> = {
  "०": "0",
  "१": "1",
  "२": "2",
  "३": "3",
  "४": "4",
  "५": "5",
  "६": "6",
  "७": "7",
  "८": "8",
  "९": "9",
};

export function normalizeDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] ?? d);
}

const MINUTE_WORDS: Record<string, number> = {
  "अर्धा तास": 30,
  "अर्धा घंटा": 30,
  "एक तास": 60,
  "एक घंटा": 60,
  "दीड तास": 90,
  "पाच मिनिट": 5,
  "दहा मिनिट": 10,
  "पंधरा मिनिट": 15,
  "वीस मिनिट": 20,
  "पंचवीस मिनिट": 25,
  "तीस मिनिट": 30,
  "चाळीस मिनिट": 40,
  "half an hour": 30,
  "one hour": 60,
};

export function parseElapsedMinutes(text: string): number | null {
  const t = normalizeDigits(text.toLowerCase());
  const hours = t.match(/(\d{1,2})\s*(तास|घंटे|घंटा|hour|hr)/);
  if (hours) return Number(hours[1]) * 60;
  const mins = t.match(/(\d{1,3})\s*(मिनिट|मिनिटे|मिनट|minute|min)/);
  if (mins) return Number(mins[1]);
  for (const [word, m] of Object.entries(MINUTE_WORDS)) {
    if (t.includes(word)) return m;
  }
  return null;
}

/** "…सोडून" / "पुढे" / "नंतर" ⇒ after, "आधी" / "before" ⇒ before. */
function parseDirection(text: string): "after" | "before" {
  const t = text.toLowerCase();
  if (/(आधी|अगोदर|before|पूर्वी)/.test(t)) return "before";
  return "after";
}

/**
 * Pull the most likely place phrase out of a spoken sentence, dropping the
 * common Marathi/Hindi/English filler around it.
 */
export function extractPlacePhrase(spoken: string): string {
  let t = normalizeDigits(spoken);
  t = t
    .replace(
      /(मी|आम्ही|आहे|आहोत|जवळ|जवळच|इथे|येथे|आता|सध्या|कुठे|मला|माझ्या|आम्हाला|हो|नाही|सोडून|झाली|झाले|आहेत|गावाजवळ|गावात|गावी|गावाच्या|गाव|तालुका|जिल्हा|थांबलो|पोहोचलो|नाव|आमचं|माझं|च्या|ला|वर|मध्ये)/g,
      " ",
    )
    .replace(/\b(i|am|we|are|near|at|the|is|here|now|main|hoon|hun|ke|paas|village|town)\b/gi, " ")
    .replace(/\d{1,3}\s*(मिनिट|मिनिटे|मिनट|तास|घंटा|minutes?|hours?)/gi, " ")
    .replace(/[.,!?।]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

function gradeConfidence(r: GeoResult): LocationConfidence {
  if (r.precision === "ROOFTOP" || r.precision === "RANGE_INTERPOLATED") return "high";
  if (
    r.types.some((t) =>
      ["premise", "point_of_interest", "establishment", "transit_station", "route"].includes(t),
    )
  ) {
    return "high";
  }
  if (r.types.includes("locality") || r.types.includes("sublocality")) return "medium";
  return "low";
}

const LANDMARK_WORDS =
  /(मंदिर|देवस्थान|टोल|नाक[ाे]|बस\s*स्टँड|स्थानक|चौक|रस्ता|रोड|हायवे|पूल|घाट|दर्गा|मशीद|चर्च|शाळा|कॉलेज|हॉस्पिटल|दवाखाना|hotel|temple|mandir|toll|bus\s*stand|station|junction|chowk|road|highway|bridge|ghat|school|college|hospital)/i;

const LOCALITY_TYPES = [
  "locality",
  "sublocality",
  "sublocality_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
];

function isLocality(result: GeoResult): boolean {
  return result.types.some((type) => LOCALITY_TYPES.includes(type));
}

function isUsefulLandmark(result: GeoResult): boolean {
  return result.types.some((type) =>
    [
      "hindu_temple",
      "place_of_worship",
      "tourist_attraction",
      "transit_station",
      "bus_station",
      "train_station",
      "premise",
    ].includes(type),
  );
}

async function geocode(query: string, providers?: LocationProviders): Promise<GeoResult | null> {
  const q = query.trim();
  if (q.length < 3) return null;

  // Plain village/town names must go through geocoding first. Places text
  // search can rank a similarly named shop hundreds of kilometres away above
  // the actual village. Named landmarks use Places first for POI precision.
  const landmarkQuery = LANDMARK_WORDS.test(q);
  if (landmarkQuery) {
    try {
      const places = providers
        ? await providers.placeLookup(q)
        : await placeLookup({ data: { query: q } });
      const landmark = places.results.find(isUsefulLandmark);
      if (landmark) return landmark;
    } catch (err) {
      console.error("Place lookup error", err);
    }
  }

  try {
    const fullQuery = /maharashtra|india/i.test(q) ? q : `${q}, Maharashtra, India`;
    const out = providers
      ? await providers.geocode(fullQuery)
      : await geocodeQuery({ data: { query: fullQuery } });
    const stateResults = out.results.filter(isMaharashtraResult);
    const locality = stateResults.find(isLocality);
    if (locality) return locality;
    const first = stateResults[0];
    if (first) return first;
  } catch (err) {
    console.error("Geocoding error", err);
  }

  // Last resort for unusual landmarks that Geocoding does not index. Never
  // accept an arbitrary establishment for a plain village-name query.
  if (!landmarkQuery) return null;
  try {
    const places = providers
      ? await providers.placeLookup(q)
      : await placeLookup({ data: { query: q } });
    return places.results.find(isUsefulLandmark) ?? null;
  } catch (err) {
    console.error("Place lookup fallback error", err);
    return null;
  }
}

/**
 * Resolve whatever the caller said into a location.
 * Returns null when nothing usable could be geocoded.
 */
export async function resolveSpokenLocation(
  spoken: string,
  providers?: LocationProviders,
): Promise<ResolvedLocation | null> {
  const phrase = extractPlacePhrase(spoken);
  const cleanedSpoken = normalizeDigits(spoken)
    .replace(/[.,!?।]/g, " ")
    .trim();
  const minutes = parseElapsedMinutes(spoken);

  // Never geocode isolated words from a sentence. Generic words such as
  // "जवळ", "गाव" or a person's name can independently resolve to a real but
  // unrelated Maharashtra settlement. Keep the caller's complete place phrase
  // intact and use AI normalization only as a final spelling/transliteration
  // aid; Google remains the source of coordinates.
  const candidates = [phrase, cleanedSpoken]
    .map((c) => c.trim())
    .filter((c, i, arr) => c.length >= 3 && arr.indexOf(c) === i)
    .slice(0, 2);

  let hit: GeoResult | null = null;
  for (const candidate of candidates) {
    hit = await geocode(candidate, providers);
    if (hit && (hit.latitude || hit.longitude)) break;
    hit = null;
  }

  // Phone-line speech is noisy, so the transcript often spells a village in a
  // way Google cannot match. Ask the model to normalise it to an English
  // village/town name in Maharashtra and geocode that instead.
  if (!hit) {
    const guess = providers
      ? await providers.normalizePlace(cleanedSpoken)
      : await aiPlaceGuess(cleanedSpoken);
    if (guess) hit = await geocode(guess, providers);
  }

  if (!hit) {
    console.warn("[location] could not resolve spoken location", { attempts: candidates.length });
    return null;
  }

  const base: ResolvedLocation = {
    text: hit.text,
    spokenText: spoken.trim(),
    latitude: hit.latitude,
    longitude: hit.longitude,
    confidence: gradeConfidence(hit),
    resolvedAt: new Date().toISOString(),
  };

  if (minutes) {
    // Relative description: we know the anchor village but not the exact spot.
    const approxKm = Number(((minutes / 60) * WALKING_KMPH).toFixed(1));
    return {
      ...base,
      confidence: approxKm > 3 ? "low" : "medium",
      relative: {
        village: hit.text,
        minutes,
        direction: parseDirection(spoken),
        approxKm,
      },
    };
  }

  return base;
}

/** A short human label for panels and the dashboard. */
export function shortLocationLabel(loc: ResolvedLocation): string {
  const first = loc.text.split(",").slice(0, 2).join(",").trim();
  if (!loc.relative) return first;
  return `${loc.relative.approxKm} km ${loc.relative.direction} ${first}`;
}

export const locationService = {
  resolveSpokenLocation,
  parseElapsedMinutes,
  extractPlacePhrase,
  shortLocationLabel,
};
