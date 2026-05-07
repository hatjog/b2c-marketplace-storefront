'use client';

/**
 * SellerSelectorWithGeolocation — client wrapper bridging useGeolocation
 * hook to the (presentational) SellerSelector cell + circuit-breaker
 * resilience (Story 5.3 + Story 5.4 extension).
 *
 * Story: v160-5-3-seller-selector-default-sort-geolocation
 *        v160-5-4-seller-selector-circuit-breaker
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
 * Story 5.4 additions:
 *  - `useCircuitBreaker` consumed locally; per-instance state.
 *  - `<SellerSelectorErrorBoundary>` wraps `<SellerSelector>`; render
 *    errors propagate to `breaker.recordFailure`.
 *  - When `breaker.state === 'open'` → render `<SellerSelectorFallback />`
 *    in place of the selector (single-vendor delegation).
 *  - When `breaker.state === 'half-open'` → selector mounts normally;
 *    the first successful render after the cooldown automatically counts
 *    as a passing test call (mount effect calls `recordSuccess`).
 *
 * Boundaries:
 *  - NIE owns the feature flag (parent ProductDetails enforces it)
 *  - NIE wires cart context (Story 5.5+ territory)
 *  - NIE adds backend retry — frontend-only resilience.
 */

import { useEffect } from 'react';

import { useCircuitBreaker } from '@/hooks/useCircuitBreaker';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  isGeolocationDeniedCached,
  cacheGeolocationDenial,
} from '@/lib/helpers/geo-denial-cache';
import type { VendorOfferOption } from '@/types/product';

import { SellerSelector } from './SellerSelector';
import { SellerSelectorErrorBoundary } from './SellerSelectorErrorBoundary';
import { SellerSelectorFallback } from './SellerSelectorFallback';

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
  const breaker = useCircuitBreaker('sellerSelectorApi');

  // Fire once on mount — but skip when the user already denied in this session
  // (cleanup-12c AC5: sessionStorage denial cache prevents SSR re-prompt loop).
  // Hook's `requestLocation` is stable (useCallback) — dep array intentionally
  // excludes it to avoid ESLint exhaustive-deps false-positive churn.
  useEffect(() => {
    if (status === 'idle' && !isGeolocationDeniedCached()) {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist denial so new mounts in the same session skip re-prompting (AC5).
  useEffect(() => {
    if (status === 'denied') {
      cacheGeolocationDenial();
    }
  }, [status]);

  // Half-open auto-resolve: a successful render of SellerSelector while the
  // breaker is in the test state counts as a passing call. Effect runs
  // after commit so the boundary had a chance to catch render errors.
  useEffect(() => {
    if (breaker.state === 'half-open') {
      breaker.recordSuccess();
    }
  }, [breaker]);

  // Open circuit → delegate to default Medusa product variant flow with
  // a transparent notice. Parent ProductDetails renders the default flow
  // when the wrapper does not render the selector.
  if (breaker.state === 'open') {
    return <SellerSelectorFallback />;
  }

  return (
    <SellerSelectorErrorBoundary
      onError={() => breaker.recordFailure()}
      onReset={() => breaker.reset()}
      fallback={<SellerSelectorFallback />}
    >
      <SellerSelector
        sellers={sellers}
        defaultSelectedSellerId={defaultSelectedSellerId}
        onSelect={onSelect}
        className={className}
        userLat={status === 'granted' && lat !== null ? lat : undefined}
        userLng={status === 'granted' && lng !== null ? lng : undefined}
        geolocationStatus={status}
      />
    </SellerSelectorErrorBoundary>
  );
};
