'use client';

import { useTranslations } from 'next-intl';

import { SellerMap } from '@/components/SellerMap';
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
 * Decision (R1-HIGH consolidation): RE-USE the mode-prop MapTiler-capable
 * `@/components/SellerMap` (mode="detail") z `sellers={[seller]}` array-of-1 +
 * `className="h-64 w-full"`. Rationale:
 * - Single SellerMap implementation — Epic-4 MapTiler/CSP work (4-1/4-2/4-4)
 *   plus the locally-bundled Leaflet marker assets (TF-65) now actually reach
 *   the seller detail page instead of a divergent legacy CartoDB component.
 * - mode="detail" centers on the single seller (SellerMap MapBehavior uses
 *   `map.setView` to the marker at `maxAutoZoom` for a 1-seller set) — no PL
 *   bbox zoom-out, so single-marker mini-map UX is correct without overrides.
 * - When MapTiler tiles are unavailable the component renders its FallbackPanel
 *   with the user-agent-aware maps deep-link (graceful no-tile fallback).
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
  /**
   * Accepted for caller compatibility. The map deep-links are derived from the
   * user-agent client-side (see SellerMap deepLink builder), so DirectionsBlock
   * no longer threads `locale` into the map; it is retained on the public props
   * so existing callers (seller detail page) keep compiling unchanged.
   */
  locale?: string;
  className?: string;
}

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function DirectionsBlock({ seller, className }: DirectionsBlockProps) {
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
              id: seller.handle,
              name: seller.name,
              lat: seller.lat as number,
              lng: seller.lng as number,
              addressLine: seller.address ?? undefined
            }
          ]}
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
