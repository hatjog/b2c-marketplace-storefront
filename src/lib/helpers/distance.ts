/**
 * Geographic distance helpers (Story 5.3).
 *
 * Story: v160-5-3-seller-selector-default-sort-geolocation
 * Spec: AC2 (Haversine pre-select), AC4 (formatted display).
 *
 * Pure SSR-safe utilities — zero side effects, zero browser API calls.
 */

const EARTH_RADIUS_KM = 6371;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Compute the great-circle distance between two lat/lng pairs in kilometres
 * using the Haversine formula. Mean Earth radius 6371 km — precision ±0.5%
 * (acceptable for buyer-facing approximation; the UI prefixes "ok./approx.").
 *
 * Returns `Number.NaN` when any coordinate is non-finite — caller is expected
 * to guard before sorting (the SellerSelector treats `NaN` as "no distance",
 * skipping the row from closest-first ordering).
 */
export const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return Number.NaN;
  }

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

/**
 * Format a distance (km) for buyer-facing display. Rounds to 1 decimal,
 * collapses very-small to `<0.1` and very-large to `999+`. The locale
 * prefix (`ok./approx.`) is supplied by the i18n key — this helper only
 * returns the numeric token (e.g. `"2.3"`, `"<0.1"`, `"999+"`).
 */
export const formatDistanceKm = (km: number): string => {
  if (!Number.isFinite(km) || km < 0) {
    return '';
  }
  if (km < 0.1) {
    return '<0.1';
  }
  if (km > 999) {
    return '999+';
  }
  return (Math.round(km * 10) / 10).toString();
};
