'use client';

/**
 * SellerSelectorCartBridge — thin client wrapper bridging selector
 * `onSelect(seller_id)` callback do CartContext `setSelectedSeller`
 * shared state. Lift to common ancestor (CartProvider) zamiast new
 * provider — selected seller is semantically "what to attach when
 * next addToCart fires", więc CartContext jest closest semantic owner.
 *
 * Story: v160-5-5-vendor-context-preservation-cart
 *
 * Why a bridge (NIE inline w ProductDetails):
 *  - ProductDetails to async Server Component → nie może używać hooków
 *    bezpośrednio (useCartContext jest client-only)
 *  - Bridge zachowuje SellerSelectorWithGeolocation jako agnostic do cart
 *    (presentational + geolocation only) — separation of concerns
 *  - Resolver name z VendorOfferOption[] (denormalized w wire-up) eliminuje
 *    need extra fetch w cart UI render (AR45 perf gate)
 *
 * Boundaries:
 *  - NIE owns the feature flag (parent ProductDetails enforces it)
 *  - NIE persists to localStorage (helper writeSelectedSellerLocal jest
 *    triggered post-addToCart success w extension story jeśli backend
 *    metadata path falters; v1.6.0 baseline relies on Option A)
 */

import { useCallback } from 'react';

import { useCartContext } from '@/components/providers';
import type { VendorOfferOption } from '@/types/product';

import { SellerSelectorWithGeolocation } from './SellerSelectorWithGeolocation';

export interface SellerSelectorCartBridgeProps {
  sellers: VendorOfferOption[];
  defaultSelectedSellerId?: string;
  className?: string;
}

export const SellerSelectorCartBridge = ({
  sellers,
  defaultSelectedSellerId,
  className,
}: SellerSelectorCartBridgeProps) => {
  const { setSelectedSeller } = useCartContext();

  const handleSelect = useCallback(
    (sellerId: string) => {
      const match = sellers.find((s) => s.seller_id === sellerId);
      if (match) {
        // cleanup-12d AC1 / TF-72: propagate handle for "visit seller" link in CartGroupBySeller.
        setSelectedSeller({
          id: match.seller_id,
          name: match.seller_name,
          handle: match.seller_handle ?? null,
        });
      } else {
        setSelectedSeller(null);
      }
    },
    [sellers, setSelectedSeller]
  );

  return (
    <SellerSelectorWithGeolocation
      sellers={sellers}
      defaultSelectedSellerId={defaultSelectedSellerId}
      onSelect={handleSelect}
      className={className}
    />
  );
};
