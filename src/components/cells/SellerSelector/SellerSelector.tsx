'use client';

/**
 * SellerSelector — multi-vendor seller picker for PDP (Story 5.2).
 *
 * Story: v160-5-2-seller-selector-pdp-build (Sprint 3, Epic 5).
 * Spec: ux-design-specification.md UX-DR19 (SellerSelector spec).
 *
 * Atomic level: cell (stateful composition — own selection state +
 * radio list + price/distance text). Composes:
 *  - native `<input type="radio">` for keyboard a11y baseline
 *  - inline "Najniższa cena" label (no Radix dependency per UX-DR19 MVP)
 *
 * v1.6.0 posture: feature-flag gated at consumer side
 * (NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED). Default OFF.
 * Selector visibility additionally requires `sellers.length > 1`.
 *
 * Default selection:
 *  - `defaultSelectedSellerId` prop wins when provided
 *  - else lowest-price seller (stable: first match in array on tie)
 *
 * Phase B activation (post-v1.6.0): backend vendor_offer aggregation
 * populates per-product offers; flag flip surfaces selector on PDP.
 *
 * Boundaries:
 *  - NIE wires cart context (Story 5.5+ territory)
 *  - NIE computes geolocation distance (Story 5.3 territory; distance_km
 *    arrives pre-computed from caller when defined)
 *  - NIE adds tooltip/popover library (Radix-skip per UX-DR19 MVP)
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import type { VendorOfferOption } from '@/types/product';

export interface SellerSelectorProps {
  /** Vendor offer list. Caller is responsible for filtering empty/single via AC4 conditional. */
  sellers: VendorOfferOption[];
  /** Optional seller_id to pre-select; falls back to lowest-price seller when omitted. */
  defaultSelectedSellerId?: string;
  /** Selection callback fires on user change (radio click / keyboard). */
  onSelect?: (sellerId: string) => void;
  /** Optional className passthrough for layout composition. */
  className?: string;
}

/**
 * Resolves which seller starts selected. Stable on price ties (returns
 * first matching seller_id in array order).
 */
function resolveInitialSellerId(
  sellers: VendorOfferOption[],
  override: string | undefined,
): string | null {
  if (sellers.length === 0) {
    return null;
  }

  if (override && sellers.some((s) => s.seller_id === override)) {
    return override;
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

export const SellerSelector = ({
  sellers,
  defaultSelectedSellerId,
  onSelect,
  className,
}: SellerSelectorProps) => {
  const t = useTranslations('seller.selector');

  const initialSellerId = useMemo(
    () => resolveInitialSellerId(sellers, defaultSelectedSellerId),
    [sellers, defaultSelectedSellerId],
  );
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(initialSellerId);

  const lowestPriceSellerId = useMemo(() => findLowestPriceSellerId(sellers), [sellers]);

  // Defensive: caller should gate on length > 1, but never crash on empty.
  if (sellers.length === 0) {
    return null;
  }

  const handleChange = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    onSelect?.(sellerId);
  };

  return (
    <fieldset
      className={cn('space-y-3 rounded-md border border-tertiary bg-component-secondary p-4', className)}
      data-testid="seller-selector"
    >
      <legend className="label-md px-1 text-primary">{t('title')}</legend>
      <div
        className="space-y-2"
        role="radiogroup"
        aria-label={t('title')}
      >
        {sellers.map((seller) => {
          const isSelected = selectedSellerId === seller.seller_id;
          const isLowestPrice = lowestPriceSellerId === seller.seller_id;

          return (
            <label
              key={seller.seller_id}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 transition-colors',
                isSelected
                  ? 'border-action bg-component-secondary-hover'
                  : 'border-tertiary hover:border-secondary',
              )}
              data-testid={`seller-option-${seller.seller_id}`}
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
                {seller.distance_km !== undefined && (
                  <span
                    className="text-xs text-secondary"
                    data-testid={`seller-option-distance-${seller.seller_id}`}
                  >
                    {t('distance_km', { distance: seller.distance_km })}
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
              </span>
              <button
                type="button"
                onClick={() => handleChange(seller.seller_id)}
                className={cn(
                  'rounded-sm border px-3 py-1 text-xs font-medium transition-colors',
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
    </fieldset>
  );
};
