/**
 * Geolocation denial sessionStorage cache helpers (cleanup-12c AC5).
 *
 * Extracted to a non-'use client' module so:
 *  - Unit tests can import without React client boundary issues
 *  - Logic is reusable outside SellerSelectorWithGeolocation if needed
 *  - SSR-safe: all storage access guarded by `typeof window !== 'undefined'`
 *
 * Story: v160-cleanup-12c — PDP SellerSelector data wire-up (AC5)
 * Spec: Epic-5 completeness audit F10 — SSR re-prompt loop closed.
 */

/**
 * sessionStorage key for geolocation denial cache.
 * Value = ISO timestamp of the denial; compared against GEO_DENIAL_TTL_MS.
 */
export const GEO_DENIAL_KEY = 'gp_geo_denial_ts';

/**
 * TTL for the denial cache entry (ms). Matches circuit breaker default
 * cooldown (10 s) so both re-enable at the same time.
 */
export const GEO_DENIAL_TTL_MS = 10_000;

/**
 * Returns true when a cached denial exists in sessionStorage and has not expired.
 * SSR-safe (returns false on server).
 */
export function isGeolocationDeniedCached(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(GEO_DENIAL_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < GEO_DENIAL_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Persists a geolocation denial timestamp to sessionStorage.
 * No-op on server or when sessionStorage is unavailable (private mode).
 */
export function cacheGeolocationDenial(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(GEO_DENIAL_KEY, String(Date.now()));
  } catch {
    // Quota or private-mode; silently swallow.
  }
}
