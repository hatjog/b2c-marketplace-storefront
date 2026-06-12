'use client';

/**
 * SellerSelector — multi-vendor seller picker for PDP (Story 5.2 baseline + Story 5.3 geolocation extension).
 *
 * Story: v160-5-2-seller-selector-pdp-build (Sprint 3, Epic 5)
 *        v160-5-3-seller-selector-default-sort-geolocation (Sprint 3, Epic 5)
 * Spec: ux-design-specification.md UX-DR19 (SellerSelector spec) + UX-DR21 (geolocation default sort).
 *
 * Atomic level: cell (stateful composition — own selection state +
 * radio list + price/distance text). Composes:
 *  - native `<input type="radio">` for keyboard a11y baseline
 *  - inline "Najniższa cena" / "Najbliższy" badges (no Radix dependency per UX-DR19 MVP)
 *
 * v1.6.0 posture: feature-flag gated at consumer side
 * (NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED). Default OFF.
 * Selector visibility additionally requires `sellers.length > 1`.
 *
 * Default selection precedence (Story 5.3):
 *  1. `defaultSelectedSellerId` prop wins when provided AND seller exists
 *  2. closest-first when `userLat`/`userLng` defined AND any seller has coordinates
 *  3. lowest-price (Story 5.2 baseline; stable: first match in array on tie)
 *
 * Phase B activation (post-v1.6.0): backend vendor_offer aggregation
 * populates per-product offers (incl. seller_lat/seller_lng); flag flip
 * surfaces selector on PDP.
 *
 * Boundaries:
 *  - NIE wires cart context (Story 5.5+ territory)
 *  - NIE invokes navigator.geolocation directly (prop-driven; PDP wrapper
 *    consumes useGeolocation hook and passes resolved coordinates)
 *  - NIE handles error retry / circuit breaker (Story 5.4 territory)
 *  - NIE adds tooltip/popover library (Radix-skip per UX-DR19 MVP)
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { formatDistanceKm, haversineKm } from '@/lib/helpers/distance';
import type { VendorOfferOption } from '@/types/product';

/**
 * Geolocation status passed from parent useGeolocation consumer. Mirrors
 * the hook's state machine — kept as a string union here to avoid forcing
 * server components to import the hook module just for the type.
 */
export type SellerSelectorGeolocationStatus =
  | 'idle'
  | 'pending'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface SellerSelectorProps {
  /** Vendor offer list. Caller is responsible for filtering empty/single via AC4 conditional. */
  sellers: VendorOfferOption[];
  /** Optional seller_id to pre-select; falls back to lowest-price seller when omitted. */
  defaultSelectedSellerId?: string;
  /** Selection callback fires on user change (radio click / keyboard). */
  onSelect?: (sellerId: string) => void;
  /** Optional className passthrough for layout composition. */
  className?: string;
  /** Story 5.3 — buyer latitude (resolved by parent useGeolocation consumer). */
  userLat?: number;
  /** Story 5.3 — buyer longitude (resolved by parent useGeolocation consumer). */
  userLng?: number;
  /** Story 5.3 — geolocation hook status; drives privacy notice + denied messaging. */
  geolocationStatus?: SellerSelectorGeolocationStatus;
}

interface SellerWithDistance extends VendorOfferOption {
  /** Distance computed inline when userLat/userLng + seller coords are present. */
  computed_distance_km?: number;
}

/**
 * Augment each seller with `computed_distance_km` when buyer coordinates
 * AND seller coordinates are both finite. Falls back to the prop-passed
 * `distance_km` (Story 5.2 fixture data) otherwise. The display layer
 * uses `computed_distance_km ?? distance_km` so callers passing static
 * values keep working with no migration.
 */
function deriveSellersWithDistance(
  sellers: VendorOfferOption[],
  userLat: number | undefined,
  userLng: number | undefined,
): SellerWithDistance[] {
  const hasUserCoords =
    typeof userLat === 'number' &&
    typeof userLng === 'number' &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng);

  return sellers.map((seller) => {
    if (
      hasUserCoords &&
      typeof seller.seller_lat === 'number' &&
      typeof seller.seller_lng === 'number'
    ) {
      const km = haversineKm(
        userLat as number,
        userLng as number,
        seller.seller_lat,
        seller.seller_lng,
      );
      if (Number.isFinite(km)) {
        return { ...seller, computed_distance_km: km };
      }
    }
    return { ...seller };
  });
}

/**
 * Resolves which seller starts selected. Precedence:
 *  1. caller-provided override when valid
 *  2. closest seller when geolocation distance is available on at least one row
 *  3. lowest-price seller (Story 5.2 baseline)
 *
 * Stable on ties — returns the first matching seller_id in array order.
 */
function resolveInitialSellerId(
  sellers: SellerWithDistance[],
  override: string | undefined,
): string | null {
  if (sellers.length === 0) {
    return null;
  }

  if (override && sellers.some((s) => s.seller_id === override)) {
    return override;
  }

  const closestId = findClosestSellerId(sellers);
  if (closestId) {
    return closestId;
  }

  return findLowestPriceSellerId(sellers);
}

/**
 * Returns the seller_id of the lowest-priced offer (stable: first match on tie).
 * Used to mark the "Najniższa cena" badge regardless of current selection.
 */
function findLowestPriceSellerId(sellers: VendorOfferOption[]): string | null {
  if (sellers.length === 0) {
    return null;
  }
  let lowest = sellers[0];
  for (const offer of sellers) {
    if (offer.price_pln < lowest.price_pln) {
      lowest = offer;
    }
  }
  return lowest.seller_id;
}

/**
 * Returns the seller_id of the closest offer when at least one row has a
 * finite computed distance. Returns `null` when no row has distance — caller
 * then falls back to lowest-price.
 */
function findClosestSellerId(sellers: SellerWithDistance[]): string | null {
  let closest: SellerWithDistance | null = null;
  for (const offer of sellers) {
    if (
      typeof offer.computed_distance_km === 'number' &&
      Number.isFinite(offer.computed_distance_km)
    ) {
      if (
        closest === null ||
        (offer.computed_distance_km as number) < (closest.computed_distance_km as number)
      ) {
        closest = offer;
      }
    }
  }
  return closest ? closest.seller_id : null;
}

export const SellerSelector = ({
  sellers,
  defaultSelectedSellerId,
  onSelect,
  className,
  userLat,
  userLng,
  geolocationStatus,
}: SellerSelectorProps) => {
  const t = useTranslations('seller.selector');
  const groupId = useId();

  const sellersWithDistance = useMemo(
    () => deriveSellersWithDistance(sellers, userLat, userLng),
    [sellers, userLat, userLng],
  );

  const initialSellerId = useMemo(
    () => resolveInitialSellerId(sellersWithDistance, defaultSelectedSellerId),
    [sellersWithDistance, defaultSelectedSellerId],
  );
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(initialSellerId);

  const lowestPriceSellerId = useMemo(
    () => findLowestPriceSellerId(sellers),
    [sellers],
  );

  const closestSellerId = useMemo(
    () => findClosestSellerId(sellersWithDistance),
    [sellersWithDistance],
  );

  useEffect(() => {
    if (selectedSellerId) {
      onSelect?.(selectedSellerId);
    }
  }, [onSelect, selectedSellerId]);

  // Defensive: caller should gate on length > 1, but never crash on empty.
  if (sellers.length === 0) {
    return null;
  }

  const handleChange = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    onSelect?.(sellerId);
  };

  // Privacy notice shows while the buyer prompt is active or unresolved.
  // Hidden once geolocation resolves (granted / denied / unsupported) — at
  // that point the buyer either sees coordinates-driven sort or the
  // lowest-price fallback, both self-explanatory.
  const showPrivacyNotice =
    geolocationStatus === 'idle' || geolocationStatus === 'pending';

  // Denied messaging surfaces only when geolocation explicitly failed and
  // the user has no chosen pre-selected seller via override; this is a
  // soft hint, not an error — selector still renders normally below.
  const showDeniedMessage = geolocationStatus === 'denied';

  return (
    <fieldset
      className={cn('space-y-3 rounded-md border border-tertiary bg-component-secondary p-4', className)}
      data-testid="seller-selector"
    >
      <legend id={`${groupId}-legend`} className="label-md px-1 text-primary">{t('title')}</legend>
      <div
        className="space-y-2"
        role="radiogroup"
        aria-labelledby={`${groupId}-legend`}
      >
        {sellersWithDistance.map((seller) => {
          const isSelected = selectedSellerId === seller.seller_id;
          const isLowestPrice = lowestPriceSellerId === seller.seller_id;
          const isClosest = closestSellerId === seller.seller_id;
          const distanceKm =
            typeof seller.computed_distance_km === 'number'
              ? seller.computed_distance_km
              : seller.distance_km;

          return (
            <label
              key={seller.seller_id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-[var(--bb-radius-card)] border px-3 py-2 transition-colors',
                isSelected
                  ? 'border-action bg-component-secondary-hover'
                  : 'border-tertiary hover:border-secondary',
              )}
              data-testid="seller-option"
              data-seller-id={seller.seller_id}
              data-selected={isSelected || undefined}
            >
              <input
                type="radio"
                name="seller-selector"
                value={seller.seller_id}
                checked={isSelected}
                onChange={() => handleChange(seller.seller_id)}
                className="h-4 w-4 accent-action"
                data-testid={`seller-option-input-${seller.seller_id}`}
              />
              <span className="flex-1">
                <span className="label-md block text-primary">{seller.seller_name}</span>
                {typeof distanceKm === 'number' && (
                  <span
                    className="text-xs text-secondary"
                    data-testid={`seller-option-distance-${seller.seller_id}`}
                  >
                    {t('distance_km', { distance: formatDistanceKm(distanceKm) })}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="label-md text-primary">
                  <span className="text-xs text-secondary">{t('price_from')} </span>
                  {seller.price_pln} zł
                </span>
                {isLowestPrice && (
                  <span
                    className="text-[10px] font-medium uppercase tracking-wide text-action"
                    data-testid={`seller-option-lowest-${seller.seller_id}`}
                  >
                    {t('lowest_price_label')}
                  </span>
                )}
                {isClosest && (
                  <span
                    className="text-[10px] font-medium uppercase tracking-wide text-action"
                    data-testid={`seller-option-closest-${seller.seller_id}`}
                  >
                    {t('closest_label')}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleChange(seller.seller_id)}
                className={cn(
                  'rounded-[var(--bb-radius-card)] border px-3 py-1 text-xs font-medium transition-colors',
                  isSelected
                    ? 'border-action bg-action text-on-action'
                    : 'border-tertiary text-primary hover:border-secondary',
                )}
                data-testid={`seller-option-cta-${seller.seller_id}`}
                aria-pressed={isSelected}
              >
                {t('choose_button')}
              </button>
            </label>
          );
        })}
      </div>
      {showPrivacyNotice && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-secondary"
          data-testid="seller-selector-privacy-notice"
        >
          {geolocationStatus === 'pending' ? t('geolocation_pending') : t('privacy_notice')}
        </p>
      )}
      {showDeniedMessage && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-secondary"
          data-testid="seller-selector-denied-message"
        >
          {t('geolocation_denied')}
        </p>
      )}
    </fieldset>
  );
};
