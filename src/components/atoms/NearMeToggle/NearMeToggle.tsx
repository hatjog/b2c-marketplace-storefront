'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

import { useGeolocation } from '@/hooks/useGeolocation';

/**
 * Story v160-4-3 — list-side "Blisko mnie" toggle (UX-DR15, FR21).
 *
 * Behavior:
 *  - OFF (default): clicking fires `requestLocation()` (REUSE Story 5.3 hook).
 *    On `granted` → router.push(`?nearMe=1&radius=10&lat=...&lng=...`) preserving
 *    other URL params (q, city, sort, view, limit, offset).
 *  - ON: clicking removes nearMe/radius/lat/lng from URL → returns to baseline list.
 *  - Pending: button disabled + spinner inline (status='pending').
 *  - Denied/unsupported: inline `geolocation_denied` notice; URL untouched.
 *
 * Privacy axiom: explicit user gesture per click — no auto-prompt on page load.
 *
 * URL state ownership: parent <SellersSearchForm> reads `nearMe` from URL
 * via searchParams; this atom is only the input surface.
 */
export interface NearMeToggleProps {
  /** Default radius (km) when toggle flips ON; falls back to 10. */
  defaultRadiusKm?: number;
}

export function NearMeToggle({ defaultRadiusKm = 10 }: NearMeToggleProps) {
  const t = useTranslations('seller.list');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status, lat, lng, requestLocation } = useGeolocation();

  const pendingPushRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isActive = searchParams.get('nearMe') === '1';

  /**
   * Push the URL with merged params. `mutator` receives a mutable
   * URLSearchParams and either sets (turn ON) or deletes (turn OFF) the
   * geolocation keys. All other parameters are preserved verbatim.
   */
  const pushWith = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutator(next);
      // Reset offset when filter changes — pagination may overflow post-filter.
      next.delete('offset');
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  // Once the hook resolves to 'granted', sync the new lat/lng into the URL.
  // We use a ref flag so we only push once per click cycle (idempotent on
  // re-render and unmount-safe per Story 5.3 hook contract).
  useEffect(() => {
    if (!pendingPushRef.current) return;
    if (status !== 'granted' || lat == null || lng == null) return;
    if (!isMountedRef.current) return;

    pendingPushRef.current = false;
    pushWith((params) => {
      params.set('nearMe', '1');
      params.set('radius', String(defaultRadiusKm));
      params.set('lat', lat.toFixed(6));
      params.set('lng', lng.toFixed(6));
    });
  }, [status, lat, lng, defaultRadiusKm, pushWith]);

  const handleClick = useCallback(() => {
    if (isActive) {
      pendingPushRef.current = false;
      pushWith((params) => {
        params.delete('nearMe');
        params.delete('radius');
        params.delete('lat');
        params.delete('lng');
      });
      return;
    }

    // Turning ON: trigger geolocation request; useEffect above will push
    // once status flips to 'granted'.
    pendingPushRef.current = true;
    requestLocation();
  }, [isActive, pushWith, requestLocation]);

  const isPending = status === 'pending' && pendingPushRef.current;
  const isDenied = status === 'denied' && pendingPushRef.current === false && !isActive
    ? false
    : status === 'denied';
  const isUnsupported = status === 'unsupported';

  const label = isActive ? t('near_me_toggle_active') : t('near_me_toggle');
  const ariaLabel = isActive ? t('near_me_toggle_active') : t('near_me_toggle');

  const baseClass =
    'inline-flex items-center justify-center gap-2 rounded-sm border px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';
  const activeClass = 'border-primary bg-primary text-white hover:bg-primary/90';
  const inactiveClass = 'border-stone-300 bg-white text-stone-700 hover:bg-stone-100';

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        aria-pressed={isActive}
        aria-label={ariaLabel}
        className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}
        data-testid="sellers-near-me-toggle"
      >
        {isPending && (
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {label}
      </button>
      {isPending && (
        <span className="text-xs text-stone-500" data-testid="sellers-near-me-pending">
          {t('geolocation_pending')}
        </span>
      )}
      {(isDenied || isUnsupported) && (
        <span
          role="status"
          className="text-xs text-stone-600"
          data-testid="sellers-near-me-denied"
        >
          {t('geolocation_denied')}
        </span>
      )}
      {!isActive && status === 'idle' && (
        <span className="text-xs text-stone-400" data-testid="sellers-near-me-privacy">
          {t('privacy_notice_inline')}
        </span>
      )}
    </div>
  );
}

export default NearMeToggle;
