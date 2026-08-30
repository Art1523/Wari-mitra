import { createServerFn } from "@tanstack/react-start";
import { geocodeDirect, nearbySearchDirect, placeLookupDirect } from "./maps.server";
import type { GeoResult, NearbySearchInput, PlaceResult } from "./maps.shared";

export type { GeoResult, PlaceResult } from "./maps.shared";

/**
 * Google Maps Platform access (geocoding + Places API New) through the Lovable
 * connector gateway. Keys stay server-side; the browser only ever sees results.
 *
 * NOTHING here invents data: if Google returns no result, the caller gets an
 * empty list and the voice agent says so honestly.
 */

/** Geocode a free-text place description (village, temple, toll plaza, road…). */
export const geocodeQuery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { query?: string };
    const query = (d?.query ?? "").trim();
    if (!query) throw new Error("query required");
    return { query: query.slice(0, 200) };
  })
  .handler(async ({ data }): Promise<{ results: GeoResult[] }> => geocodeDirect(data.query));

/**
 * Precise landmark lookup via Places API (New) text search.
 *
 * Geocoding often snaps a temple or chowk to the village centroid
 * (APPROXIMATE). Places searchText returns POI-level coordinates for named
 * landmarks like "Khandoba Mandir Nighoj", so callers' positions are far more
 * precise. Biased hard to the Maharashtra Wari corridor.
 */
export const placeLookup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as { query?: string };
    const query = (d?.query ?? "").trim();
    if (!query) throw new Error("query required");
    return { query: query.slice(0, 160) };
  })
  .handler(async ({ data }): Promise<{ results: GeoResult[] }> => placeLookupDirect(data.query));

/** Nearby places search (Places API New) around real coordinates. */
export const nearbySearch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => {
    const d = data as {
      latitude?: number;
      longitude?: number;
      includedTypes?: string[];
      textQuery?: string;
      radiusM?: number;
    };
    if (typeof d?.latitude !== "number" || typeof d?.longitude !== "number") {
      throw new Error("latitude and longitude required");
    }
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      includedTypes: Array.isArray(d.includedTypes) ? d.includedTypes.slice(0, 5) : [],
      textQuery: (d.textQuery ?? "").slice(0, 120),
      radiusM: Math.min(Math.max(d.radiusM ?? 8000, 500), 50000),
    };
  })
  .handler(async ({ data }): Promise<{ places: PlaceResult[] }> => nearbySearchDirect(data as NearbySearchInput));
