export interface GeoResult {
  text: string;
  latitude: number;
  longitude: number;
  precision: string;
  types: string[];
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  primaryType: string;
  openNow: boolean | null;
  rating: number | null;
  /** Verified phone number from Google Places, when published. */
  phone?: string | null;
}

export interface NearbySearchInput {
  latitude: number;
  longitude: number;
  includedTypes: string[];
  textQuery: string;
  radiusM: number;
}