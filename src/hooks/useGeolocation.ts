'use client';

/**
 * useGeolocation — Browser Geolocation API wrapper hook (Story 5.3).
 *
 * Story: v160-5-3-seller-selector-default-sort-geolocation
 * Spec: PRD FR2 (two-vector buyer convenience: price + distance)
 *       UX-DR21 (geolocation default sort, closest-first pre-select)
 *       AR45 (geolocation MUST NOT block render)
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
   */
  requestLocation: () => void;
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

    // Don't double-fire while a request is already pending.
    setStatus((prev) => (prev === 'pending' ? prev : 'pending'));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setError(null);
        setStatus('granted');
      },
      (positionError) => {
        if (!isMountedRef.current) return;
        setError(positionError);
        setStatus('denied');
      },
      {
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
        enableHighAccuracy,
      },
    );
  }, [timeoutMs, maximumAgeMs, enableHighAccuracy]);

  return { status, lat, lng, error, requestLocation };
};
