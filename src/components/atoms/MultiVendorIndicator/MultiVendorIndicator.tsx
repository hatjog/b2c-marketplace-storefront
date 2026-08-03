'use client';

/**
 * MultiVendorIndicator — PLP indicator atom showing how many salons offer the product.
 *
 * Story: v160-cleanup-12b (Epic 9, cleanup wave).
 * Spec: ux-design-specification.md (Marta-self pillar — multi-vendor transparency).
 *
 * Atomic level: pure presentation, no state, no effect.
 * Renders nothing when vendorCount < 2 (single-vendor or missing → null).
 *
 * Purpose: surfaces multi-vendor context on PLP ProductCard — complements
 * `LowestPriceBadge` (lowest price) with "X salonów oferuje" (vendor count).
 *
 * E2E gate: `[data-testid="multi-vendor-indicator"]` must be visible for
 * Story 8.8 AC6 Step 1 to PASS when flag ON + multi-vendor seed active.
 *
 * v1.6.0 posture: gated at consumer side (isMultiVendorEnabled in ProductCard).
 * Atom itself is pure — no flag check inside; consumer decides gating so the
 * atom remains testable in isolation with any vendorCount.
 */

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface MultiVendorIndicatorProps {
  /** Number of vendors offering the same product. Indicator renders only when >= 2. */
  vendorCount: number;
  /** Optional className passthrough for layout integration. */
  className?: string;
}

export const MultiVendorIndicator = ({ vendorCount, className }: MultiVendorIndicatorProps) => {
  const t = useTranslations('seller.multi_vendor');

  // Single-vendor (or invalid) → no indicator per UX spec (transparency only when choice exists).
  if (!Number.isFinite(vendorCount) || vendorCount < 2) {
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-[var(--bb-muted-72)] px-2 py-0.5 text-xs text-secondary',
        className
      )}
      title={t('indicator_tooltip', { count: vendorCount })}
      data-testid="multi-vendor-indicator"
    >
      {t('indicator_label', { count: vendorCount })}
    </span>
  );
};
