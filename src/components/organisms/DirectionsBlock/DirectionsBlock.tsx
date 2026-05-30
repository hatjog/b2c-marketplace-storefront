'use client';

import { useTranslations } from 'next-intl';

import { SellerMap } from '@/components/cells/SellerMap';
import {
  buildAppleMapsDeeplink,
  buildGoogleMapsDeeplink,
  buildSearchFallbackDeeplink
} from '@/lib/helpers/maps-deeplink';
import { cn } from '@/lib/utils';

/**
 * Story v160-4-5 — DirectionsBlock organism (UX-DR18; Persona Dorota).
 *
 * Embedded section na seller detail page (between description + products
 * tabs) z mini-mapką + 2 deeplink buttons (Google Maps + Apple Maps) +
 * privacy notice.
 *
 * Decision (T4 — re-use vs variant): RE-USE `SellerMap` cell z `sellers={[seller]}`
 * array-of-1 + `className="h-64 w-full"` mini sizing. Rationale:
 * - DRY — leverages tested AC1-AC3 z Story 4.2.
 * - SellerMap defensive filter handles 0-1 markers gracefully (FitBoundsToMarkers
 *   skips fitBounds when points.length < 2, falls back to PL_DEFAULT_ZOOM 6).
 *   Trade-off: zoom-out na PL bbox dla single marker = sub-optimal mini-map UX.
 *   Acceptable dla MVP; future polish defer Story 4.5.1 (extend SellerMap z
 *   optional `centerOverride` + `zoomOverride` props dla mini-mode).
 *
 * Defensive fallback (AC4): jeśli ani lat/lng ANI address → return null
 * (graceful skip; no empty placeholder section in detail page).
 *
 * Privacy: ZERO `navigator.geolocation` calls. Deeplink buttons = user-gesture;
 * external maps app handles "from current location" prompt (per scope spec
 * "NIE auto-prompt geolocation").
 */

export interface DirectionsBlockProps {
  seller: {
    name: string;
    handle: string;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
  };
  locale: string;
  className?: string;
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function DirectionsBlock({ seller, locale, className }: DirectionsBlockProps) {
  const t = useTranslations('seller.detail');

  const hasCoords = isFiniteCoord(seller.lat) && isFiniteCoord(seller.lng);
  const hasAddress = typeof seller.address === 'string' && seller.address.trim().length > 0;

  if (!hasCoords && !hasAddress) {
    return null;
  }

  const googleHref = hasCoords
    ? buildGoogleMapsDeeplink({
        lat: seller.lat as number,
        lng: seller.lng as number,
        name: seller.name
      })
    : buildSearchFallbackDeeplink({
        provider: 'google',
        name: seller.name,
        address: seller.address as string
      });

  const appleHref = hasCoords
    ? buildAppleMapsDeeplink({
        lat: seller.lat as number,
        lng: seller.lng as number,
        name: seller.name
      })
    : buildSearchFallbackDeeplink({
        provider: 'apple',
        name: seller.name,
        address: seller.address as string
      });

  const headingId = `directions-${seller.handle}`;

  return (
    <section
      className={cn('directions-block flex flex-col gap-3', className)}
      aria-labelledby={headingId}
      data-testid="directions-block"
    >
      <h2 id={headingId} className="heading-md">
        {t('directions_title')}
      </h2>

      {hasAddress && (
        <address className="not-italic text-base">{seller.address}</address>
      )}

      {hasCoords ? (
        <SellerMap
          sellers={[
            {
              handle: seller.handle,
              name: seller.name,
              photo_url: null,
              city: null,
              product_count: 0,
              lat: seller.lat as number,
              lng: seller.lng as number,
              address: seller.address ?? null
            }
          ]}
          locale={locale}
          mode="detail"
          className="h-64 w-full"
        />
      ) : (
        <p className="text-sm text-stone-600" data-testid="directions-no-coords">
          {t('directions_no_coords')}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={googleHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="directions-google"
        >
          {t('directions_open_google')}
        </a>
        <a
          href={appleHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-sm border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="directions-apple"
        >
          {t('directions_open_apple')}
        </a>
      </div>

      <p className="text-xs text-stone-500">{t('directions_external_notice')}</p>
    </section>
  );
}

export default DirectionsBlock;
