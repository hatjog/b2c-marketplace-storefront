'use client';

/**
 * LowestPriceBadge — multi-vendor "od X zł" prefix badge for PLP ProductCard.
 *
 * Story: v160-5-1-lowest-price-badge-plp (Sprint 3, Epic 5).
 * Spec: ux-design-specification.md lines 1098-1104 (LowestPriceBadge anatomy).
 *
 * Atomic level: pure presentation, no state, no effect.
 * Renders nothing when vendorCount < 2 (single-vendor fallthrough → null).
 *
 * v1.6.0 posture: feature-flag gated at consumer side
 * (NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED). Default OFF — placeholder for
 * Phase B activation. Backend vendor_offer aggregation = Phase B territory.
 *
 * Tooltip: native `title` attribute (MVP per Story 5.1 boundary — no Radix).
 * Browser-native a11y (keyboard focus + screen reader announce).
 * Mobile: silent (acceptable per UX spec line 1102 "tooltip on hover desktop").
 *
 * Color: uses existing `text-secondary` Tailwind token (resolves to
 * `--content-secondary` per design tokens v1.5.0). UX spec calls out
 * `--ink-3` token; that family is not yet wired in v1.6.0 design-tokens
 * sweep — `text-secondary` is the closest semantic match (muted body text).
 * TODO: migrate to `--ink-3` once Tier 2 visual sweep lands.
 */

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export interface LowestPriceBadgeProps {
  /** Number of vendors offering the same product. Badge renders only when >= 2. */
  vendorCount: number;
  /** Optional className passthrough for layout integration in ProductCard price area. */
  className?: string;
}

export const LowestPriceBadge = ({ vendorCount, className }: LowestPriceBadgeProps) => {
  const t = useTranslations('seller.lowest_price');

  // Single-vendor (or invalid) → no prefix per UX spec line 1104.
  if (!Number.isFinite(vendorCount) || vendorCount < 2) {
    return null;
  }

  return (
    <span
      className={cn('text-xs text-secondary', className)}
      title={t('tooltip', { count: vendorCount })}
      data-testid="lowest-price-badge"
    >
      {t('prefix')}
    </span>
  );
};
