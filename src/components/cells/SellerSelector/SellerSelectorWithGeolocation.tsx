'use client';

/**
 * SellerSelectorWithGeolocation — client wrapper bridging useGeolocation
 * hook to the (presentational) SellerSelector cell (Story 5.3).
 *
 * Story: v160-5-3-seller-selector-default-sort-geolocation
 *
 * Why a wrapper:
 *  - SellerSelector is intentionally prop-driven so it stays unit-testable
 *    without mocking `navigator.geolocation` and Storybook fixtures keep
 *    working with static `userLat`/`userLng` props.
 *  - The PDP entry (`ProductDetails.tsx`) is an async server component;
 *    this client wrapper is the boundary that consumes the hook and feeds
 *    coordinates downstream.
 *  - Auto-requests on mount because the wrapper itself only renders when
 *    `MULTI_VENDOR_PRICING_ENABLED && vendor_offers.length > 1`, i.e. the
 *    SellerSelector is already a user-perceivable affordance — the prompt
 *    is contextual, not surprise.
 *
 * Boundaries:
 *  - NIE owns the feature flag (parent ProductDetails enforces it)
 *  - NIE wires cart context (Story 5.5+ territory)
 *  - NIE handles error retry — Story 5.4 (circuit breaker) wraps this.
 */

import { useEffect } from 'react';

import { useGeolocation } from '@/hooks/useGeolocation';
import type { VendorOfferOption } from '@/types/product';

import { SellerSelector } from './SellerSelector';

export interface SellerSelectorWithGeolocationProps {
  sellers: VendorOfferOption[];
  defaultSelectedSellerId?: string;
  onSelect?: (sellerId: string) => void;
  className?: string;
}

export const SellerSelectorWithGeolocation = ({
  sellers,
  defaultSelectedSellerId,
  onSelect,
  className,
}: SellerSelectorWithGeolocationProps) => {
  const { status, lat, lng, requestLocation } = useGeolocation();

  // Fire once on mount. Hook's `requestLocation` is stable (useCallback) —
  // the dep array intentionally excludes it to avoid ESLint exhaustive-deps
  // false-positive churn (the request is genuinely "once at mount").
  useEffect(() => {
    if (status === 'idle') {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SellerSelector
      sellers={sellers}
      defaultSelectedSellerId={defaultSelectedSellerId}
      onSelect={onSelect}
      className={className}
      userLat={status === 'granted' && lat !== null ? lat : undefined}
      userLng={status === 'granted' && lng !== null ? lng : undefined}
      geolocationStatus={status}
    />
  );
};
