/**
 * Geographic distance utilities.
 *
 * ONE central place for the community-alert radius. Every alert decision —
 * voice call, dashboard, demo test — must go through `isWithinAlertRadius`.
 */

export const MISSING_PERSON_ALERT_RADIUS_KM = 100;

const R = 6371; // Earth radius, km
const rad = (d: number) => (d * Math.PI) / 180;

export function calculateDistanceKm(
  callerLatitude: number,
  callerLongitude: number,
  missingLatitude: number,
  missingLongitude: number,
): number {
  const dLat = rad(missingLatitude - callerLatitude);
  const dLng = rad(missingLongitude - callerLongitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(callerLatitude)) * Math.cos(rad(missingLatitude)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinAlertRadius(
  distanceKm: number,
  radiusKm: number = MISSING_PERSON_ALERT_RADIUS_KM,
): boolean {
  return distanceKm <= radiusKm;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
