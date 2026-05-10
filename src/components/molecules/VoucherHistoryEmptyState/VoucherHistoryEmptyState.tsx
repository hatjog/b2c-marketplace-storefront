'use client';

/**
 * VoucherHistoryEmptyState — Story 2.6 (v1.7.0).
 *
 * BonBeauty-aligned empty state for the voucher history view.
 * Rendered ONLY when listCustomerVouchers() returns [] AND the request
 * succeeded with an authenticated session (no error, no access-denied).
 *
 * UX state contract (Story 0.9 / bonbeauty-critical-paths.ux-state.json):
 *   state_id: 'empty'
 *   may_mask_failures: false
 *   — This component MUST NOT be used for access-denied, unavailable,
 *     failed or stale states. Those render their own distinct state via
 *     the NamedState component (see vouchers/page.tsx).
 *
 * WCAG 2.1 AA (Story 2.1 AC3 / NFR28):
 *   - Descriptive heading (h2) + body text.
 *   - role="region" + aria-labelledby for landmark navigation.
 *   - Focus visible on primary CTA.
 *   - Status communicated by text + icon, NOT color alone.
 *
 * DS boundary (ARCH-007): customer-facing storefront only.
 * Reuses StateCard (Story 2.1) + BonBeauty surface tokens.
 *
 * Recommendation slot: reserved for Story 2.2 component injection.
 * When Story 2.2 recommendation surface lands, pass `recommendationSlot`
 * with the appropriate component; it renders below the primary CTA.
 */
import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { StateCard } from '@/components/molecules/StateCard/StateCard';

interface VoucherHistoryEmptyStateProps {
  locale: string;
  /** Optional recommendation slot — reserved for Story 2.2 injection. */
  recommendationSlot?: React.ReactNode;
  'data-testid'?: string;
}

export function VoucherHistoryEmptyState({
  locale,
  recommendationSlot,
  'data-testid': dataTestId = 'voucher-history-empty-state',
}: VoucherHistoryEmptyStateProps) {
  const t = useTranslations('account.vouchers.empty');

  const ctaHref = `/${locale}`;

  const action = (
    <Link
      href={ctaHref}
      className="inline-block min-h-12 min-w-12 rounded-sm bg-action px-6 py-3 text-action-on-primary font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action"
      data-testid="voucher-empty-cta"
    >
      {t('cta')}
    </Link>
  );

  return (
    <div
      role="region"
      aria-labelledby="voucher-empty-heading"
      data-testid={dataTestId}
    >
      <StateCard
        variant="empty"
        title={t('heading')}
        titleAs="h2"
        titleId="voucher-empty-heading"
        description={t('body')}
        action={action}
        data-testid="voucher-empty-state-card"
      />

      {/* Story 2.2 recommendation slot — reserved; renders below CTA when provided. */}
      {recommendationSlot && (
        <div
          className="mt-6"
          data-testid="voucher-empty-recommendation-slot"
        >
          {recommendationSlot}
        </div>
      )}
    </div>
  );
}
