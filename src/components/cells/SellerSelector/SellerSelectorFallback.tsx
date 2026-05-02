'use client';

/**
 * SellerSelectorFallback — graceful single-vendor delegation notice
 * (Story 5.4).
 *
 * Story: v160-5-4-seller-selector-circuit-breaker (Sprint 3, Epic 5)
 * Spec: PRD FR1-FR5 + AR45 (NIE blocks render) + UX-DR19 (fallback notice)
 *
 * Renders only an informational `role="status"` notice — the parent
 * `ProductDetails.tsx` already renders the default Medusa product variant
 * flow when the multi-vendor selector is absent, so this component
 * intentionally does NOT replicate the variant picker. The notice provides
 * transparency to the buyer ("Multi-vendor unavailable; using default
 * seller") so they understand why the multi-vendor experience is missing.
 *
 * Boundaries:
 *  - NIE renders radio list (delegation = parent default flow)
 *  - NIE owns retry CTA (Error Boundary owns retry; circuit breaker auto-
 *    transitions to half-open after cooldown)
 *  - Defensive: zero crash on undefined/empty `vendor_offers` (no data deps)
 */

import { useTranslations } from 'next-intl';

export const SellerSelectorFallback = () => {
  const t = useTranslations('seller.selector');
  return (
    <p
      role="status"
      aria-live="polite"
      data-testid="seller-selector-fallback"
      className="text-xs text-secondary"
    >
      {t('fallback_notice')}
    </p>
  );
};
