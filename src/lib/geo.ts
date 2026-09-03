export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points (Haversine formula) in kilometers.
 * Pure and dependency-free — safe to run on the client, in Edge, or Node.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}

/** Whether `point` falls within `radiusKm` of `center`. */
export function withinRadiusKm(point: GeoPoint, center: GeoPoint, radiusKm: number): boolean {
  return haversineKm(point, center) <= radiusKm;
}

/**
 * Pick the point in `candidates` closest to `target`. Returns null when the list is empty.
 * Ties are broken toward the first match.
 */
export function nearestPoint<T extends GeoPoint>(
  target: GeoPoint,
  candidates: readonly T[]
): { point: T; distanceKm: number } | null {
  let best: { point: T; distanceKm: number } | null = null;
  for (const point of candidates) {
    const distanceKm = haversineKm(target, point);
    if (!best || distanceKm < best.distanceKm) {
      best = { point, distanceKm };
    }
  }
  return best;
}