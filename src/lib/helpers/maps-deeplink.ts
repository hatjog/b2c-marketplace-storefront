/**
 * Story v160-4-5 — pure deeplink builders dla Google Maps + Apple Maps.
 *
 * Why deeplink (NOT embedded routing engine):
 * - Routing engines (turn-by-turn, traffic, transit) require commercial APIs
 *   ($5/1000 requests typical) — out of v1.6.0 budget.
 * - Deeplinks delegate routing UX do user's preferred maps app (Google ~95%
 *   PL Android default, Apple ~100% iOS default) — full mobile coverage.
 * - Privacy: BonBeauty NIE prompts geolocation; external maps app handles
 *   "from current location" entry-point (user-controlled gesture).
 *
 * URL encoding: defensive `encodeURIComponent()` for ALL injected values
 * (lat/lng numbers nominally don't need encoding, ale name/address can carry
 * spaces, accents, punctuation). Helper enforces uniformly.
 *
 * Contract refs (canonical Apr 2026):
 * - Google Maps URLs:  https://developers.google.com/maps/documentation/urls/get-started
 *   - Directions:       /maps/dir/?api=1&destination=<lat>,<lng>
 *   - Search fallback:  /maps/search/?api=1&query=<text>
 * - Apple Maps URLs:   https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
 *   - Directions:       maps.apple.com/?daddr=<lat>,<lng>
 *   - Search fallback:  maps.apple.com/?q=<text>
 */

export type LatLng = {
  lat: number;
  lng: number;
};

export type DeeplinkProvider = 'google' | 'apple';

/**
 * Build a Google Maps "directions" deeplink with destination = lat,lng.
 * Optional `name` is appended as `&query` for richer destination labelling.
 */
export function buildGoogleMapsDeeplink({
  lat,
  lng,
  name
}: LatLng & { name?: string }): string {
  const base = 'https://www.google.com/maps/dir/?api=1';
  const dest = `&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  const label = name ? `&query=${encodeURIComponent(name)}` : '';
  return `${base}${dest}${label}`;
}

/**
 * Build an Apple Maps directions deeplink with daddr = lat,lng.
 * Optional `name` is appended as `&q` for label parity z Google deeplink.
 */
export function buildAppleMapsDeeplink({
  lat,
  lng,
  name
}: LatLng & { name?: string }): string {
  const base = 'https://maps.apple.com/';
  const dest = `?daddr=${encodeURIComponent(`${lat},${lng}`)}`;
  const label = name ? `&q=${encodeURIComponent(name)}` : '';
  return `${base}${dest}${label}`;
}

/**
 * Defensive fallback dla seller-without-coords case: search query mode.
 *
 * Used by `DirectionsBlock` when `lat`/`lng` are absent ale `address` is
 * defined — we still want a clickable button that opens external maps with
 * a pre-filled search box. User's maps app handles geocoding the address
 * text to coordinates.
 */
export function buildSearchFallbackDeeplink({
  provider,
  name,
  address
}: {
  provider: DeeplinkProvider;
  name: string;
  address: string;
}): string {
  const query = encodeURIComponent(`${address}, ${name}`);
  if (provider === 'google') {
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
  return `https://maps.apple.com/?q=${query}`;
}
