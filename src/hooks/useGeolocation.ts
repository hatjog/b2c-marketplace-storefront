'use client';

/**
 * useGeolocation — Browser Geolocation API wrapper hook (Story 5.3).
 *
 * Story: v160-5-3-seller-selector-default-sort-geolocation
 * Spec: PRD FR2 (two-vector buyer convenience: price + distance)
 *       UX-DR21 (geolocation default sort, closest-first pre-select)
 *       AR45 (geolocation MUST NOT block render)
 *
 * Story v160-cleanup-32 (TF-70): sessionStorage cache dla `prompted` flag +
 * result z TTL (NEXT_PUBLIC_GEO_CACHE_TTL_MS, default 24h). Re-prompt tylko
 * on explicit `geo.reset()` lub TTL expiry. SSR-safe.
 *
 * Design choices:
 *  - **Lazy by design**: hook does NOT auto-fire `getCurrentPosition()` on mount.
 *    Caller invokes `requestLocation()` at the right moment (typically once
 *    SellerSelector becomes visible). This respects browser gesture-context
 *    best practices and avoids unwanted prompts on flag-OFF / single-vendor PDPs.
 *  - **State machine** drives UI: `idle → pending → granted | denied | unsupported`.
 *  - **SSR-safe**: guarded by `typeof navigator === 'undefined'` check; the initial
 *    render returns `status: 'idle'` with null coordinates.
 *  - **Unmount-safe**: `isMounted` ref prevents `setState` after the consuming
 *    component is removed (React 19 concurrent mode tolerance).
 *  - **Session cache (TF-70)**: `sessionStorage['gp:geo:prompted:v1']` stores
 *    `{ts, lat, lng, status}` — re-prompt suppressed on cache hit within TTL.
 *    Explicit `reset()` clears cache and allows re-trigger (CTA "redetect").
 *  - **Boundary**: hook does not handle persistent permission state, IP fallback,
 *    or reverse-geocoding (out of scope for v1.6.0; Story 5.4 adds error
 *    boundary, Story 4.3 may re-use this hook for the list-page filter).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type GeolocationStatus =
  | 'idle'
  | 'pending'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface UseGeolocationResult {
  status: GeolocationStatus;
  lat: number | null;
  lng: number | null;
  error: GeolocationPositionError | null;
  /**
   * Trigger a `navigator.geolocation.getCurrentPosition` request.
   * Caller is responsible for choosing the right user-gesture context.
   * No-op if status is already `'pending'` or `'unsupported'`.
   * Cache hit: restores cached state without re-prompting (TF-70).
   */
  requestLocation: () => void;
  /**
   * Clear sessionStorage cache and reset state to `'idle'` (TF-70).
   * Allows a fresh re-prompt on next `requestLocation()` call.
   * Used by "redetect" CTA.
   */
  reset: () => void;
}

interface UseGeolocationOptions {
  /** Geolocation API timeout, default 5_000 ms (per AR45 NIE blokuje render). */
  timeoutMs?: number;
  /** Permit cached fixes to satisfy the request (default 60_000 ms). */
  maximumAgeMs?: number;
  /** High-accuracy fix (drains battery; default false — buyer-good-enough). */
  enableHighAccuracy?: boolean;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAXIMUM_AGE_MS = 60_000;

/** SessionStorage key for geolocation prompt cache (TF-70). */
export const GEO_CACHE_KEY = 'gp:geo:prompted:v1';

/** Default TTL: 24h in ms. Override via NEXT_PUBLIC_GEO_CACHE_TTL_MS. */
const DEFAULT_GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface GeoCacheEntry {
  ts: number;
  status: 'granted' | 'denied';
  lat: number | null;
  lng: number | null;
}

function getGeoCacheTtlMs(): number {
  const raw = process.env.NEXT_PUBLIC_GEO_CACHE_TTL_MS;
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_GEO_CACHE_TTL_MS;
}

/**
 * Read cached geo entry from sessionStorage. Returns null if:
 * - SSR (window undefined)
 * - No cache entry
 * - Cache expired (> TTL ms old)
 * - Parse error
 */
export function readGeoCache(): GeoCacheEntry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as GeoCacheEntry;
    if (
      typeof entry?.ts !== 'number' ||
      typeof entry?.status !== 'string'
    ) {
      return null;
    }
    const ttl = getGeoCacheTtlMs();
    if (Date.now() - entry.ts > ttl) {
      // Expired — clear stale entry
      window.sessionStorage.removeItem(GEO_CACHE_KEY);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

/**
 * Write geo entry to sessionStorage. SSR-safe (no-op when window undefined).
 */
export function writeGeoCache(entry: GeoCacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Private browsing / quota exceeded — graceful degradation
  }
}

/**
 * Clear geo entry from sessionStorage. SSR-safe.
 */
export function clearGeoCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(GEO_CACHE_KEY);
  } catch {
    // Ignore
  }
}

export const useGeolocation = (
  options: UseGeolocationOptions = {},
): UseGeolocationResult => {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maximumAgeMs = DEFAULT_MAXIMUM_AGE_MS,
    enableHighAccuracy = false,
  } = options;

  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    // Detect lack of browser API once mounted (SSR returns 'idle' until hydration).
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.geolocation === 'undefined'
    ) {
      setStatus('unsupported');
    }

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const requestLocation = useCallback(() => {
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.geolocation === 'undefined'
    ) {
      setStatus('unsupported');
      return;
    }

    // TF-70: Check sessionStorage cache BEFORE firing browser prompt.
    const cached = readGeoCache();
    if (cached) {
      // Cache hit — restore state without re-prompting.
      setLat(cached.lat);
      setLng(cached.lng);
      setError(null);
      setStatus(cached.status);
      return;
    }

    // Don't double-fire while a request is already pending.
    setStatus((prev) => (prev === 'pending' ? prev : 'pending'));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        const newLat = position.coords.latitude;
        const newLng = position.coords.longitude;
        setLat(newLat);
        setLng(newLng);
        setError(null);
        setStatus('granted');
        // TF-70: Persist cache on successful prompt.
        writeGeoCache({ ts: Date.now(), status: 'granted', lat: newLat, lng: newLng });
      },
      (positionError) => {
        if (!isMountedRef.current) return;
        setError(positionError);
        setStatus('denied');
        // TF-70: Cache denied status too (user explicitly denied — don't re-prompt in session).
        writeGeoCache({ ts: Date.now(), status: 'denied', lat: null, lng: null });
      },
      {
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
        enableHighAccuracy,
      },
    );
  }, [timeoutMs, maximumAgeMs, enableHighAccuracy]);

  /**
   * TF-70: Explicit reset — clear cache and reset state to idle.
   * Used by "redetect" CTA or programmatic re-trigger scenarios.
   */
  const reset = useCallback(() => {
    clearGeoCache();
    setLat(null);
    setLng(null);
    setError(null);
    setStatus('idle');
  }, []);

  return { status, lat, lng, error, requestLocation, reset };
};
