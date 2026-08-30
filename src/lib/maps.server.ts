import type { GeoResult, NearbySearchInput, PlaceResult } from "./maps.shared";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function keys(): Record<string, string> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const maps = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovable || !maps) throw new Error("Google Maps connector is not configured");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": maps };
}

export async function geocodeDirect(query: string): Promise<{ results: GeoResult[] }> {
  const url = `${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(query)}&components=administrative_area:Maharashtra%7Ccountry:IN&bounds=15.60,72.60%7C22.10,80.90&region=in&language=en`;
  const res = await fetch(url, { headers: keys(), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Geocoding failed [${res.status}]`);
  const json = (await res.json()) as {
    status?: string;
    results?: Array<{
      formatted_address?: string;
      types?: string[];
      geometry?: { location?: { lat: number; lng: number }; location_type?: string };
    }>;
  };
  if (json.status !== "OK" || !json.results?.length) return { results: [] };
  return {
    results: json.results.slice(0, 5).map((r) => ({
      text: r.formatted_address ?? query,
      latitude: r.geometry?.location?.lat ?? 0,
      longitude: r.geometry?.location?.lng ?? 0,
      precision: r.geometry?.location_type ?? "APPROXIMATE",
      types: r.types ?? [],
    })),
  };
}

export async function placeLookupDirect(query: string): Promise<{ results: GeoResult[] }> {
  const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    signal: AbortSignal.timeout(10000),
    method: "POST",
    headers: {
      ...keys(),
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types",
    },
    body: JSON.stringify({
      textQuery: /maharashtra|india/i.test(query) ? query : `${query}, Maharashtra`,
      maxResultCount: 3,
      locationBias: {
        rectangle: {
          low: { latitude: 15.6, longitude: 72.6 },
          high: { latitude: 22.1, longitude: 80.9 },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Place lookup failed [${res.status}]`);
  const json = (await res.json()) as {
    places?: Array<{
      displayName?: { text?: string };
      formattedAddress?: string;
      location?: { latitude?: number; longitude?: number };
      primaryType?: string;
      types?: string[];
    }>;
  };
  return {
    results: (json.places ?? [])
      .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
      .map((p) => ({
        text: p.formattedAddress || p.displayName?.text || query,
        latitude: p.location?.latitude ?? 0,
        longitude: p.location?.longitude ?? 0,
        precision: "ROOFTOP",
        types: [p.primaryType, ...(p.types ?? [])].filter(Boolean) as string[],
      })),
  };
}

export async function nearbySearchDirect(
  data: NearbySearchInput,
): Promise<{ places: PlaceResult[] }> {
  const headers = {
    ...keys(),
    "Content-Type": "application/json",
    "X-Goog-FieldMask":
      "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.currentOpeningHours.openNow,places.rating,places.internationalPhoneNumber,places.nationalPhoneNumber",
  };
  const map = (json: unknown): PlaceResult[] => {
    const j = json as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        primaryType?: string;
        currentOpeningHours?: { openNow?: boolean };
        rating?: number;
        internationalPhoneNumber?: string;
        nationalPhoneNumber?: string;
      }>;
    };
    return (j.places ?? [])
      .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
      .map((p) => ({
        id: p.id ?? "",
        name: p.displayName?.text ?? "Unnamed place",
        address: p.formattedAddress ?? "",
        latitude: p.location?.latitude ?? 0,
        longitude: p.location?.longitude ?? 0,
        primaryType: p.primaryType ?? "",
        openNow: p.currentOpeningHours?.openNow ?? null,
        rating: p.rating ?? null,
        phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
      }));
  };
  if (data.includedTypes.length) {
    const res = await fetch(`${GATEWAY}/places/v1/places:searchNearby`, {
      signal: AbortSignal.timeout(10000),
      method: "POST",
      headers,
      body: JSON.stringify({
        includedTypes: data.includedTypes,
        maxResultCount: 10,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: data.latitude, longitude: data.longitude },
            radius: data.radiusM,
          },
        },
      }),
    });
    if (!res.ok) throw new Error(`Places search failed [${res.status}]`);
    const places = map(await res.json());
    if (places.length) return { places };
  }
  if (!data.textQuery) return { places: [] };
  const res = await fetch(`${GATEWAY}/places/v1/places:searchText`, {
    signal: AbortSignal.timeout(10000),
    method: "POST",
    headers,
    body: JSON.stringify({
      textQuery: data.textQuery,
      maxResultCount: 10,
      locationBias: {
        circle: {
          center: { latitude: data.latitude, longitude: data.longitude },
          radius: data.radiusM,
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Places text search failed [${res.status}]`);
  return { places: map(await res.json()) };
}

/**
 * Places Details lookup for a single field set. Nearby/Text search sometimes
 * omits phone numbers even when they are published on the place, so hospital
 * transfer resolves the number through Details before giving up.
 */
export async function placePhoneDirect(placeId: string): Promise<string | null> {
  if (!placeId) return null;
  const id = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  const res = await fetch(`${GATEWAY}/places/v1/${id}`, {
    signal: AbortSignal.timeout(8000),
    headers: {
      ...keys(),
      "X-Goog-FieldMask": "internationalPhoneNumber,nationalPhoneNumber",
    },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    internationalPhoneNumber?: string;
    nationalPhoneNumber?: string;
  };
  return json.internationalPhoneNumber ?? json.nationalPhoneNumber ?? null;
}
