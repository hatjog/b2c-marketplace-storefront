/**
 * Magic-link voucher recovery — token-less neutral landing route.
 *
 * Story 2.6 (v1.7.0) — re-review fix MEDIUM (M-token-persist).
 *
 * Route: /[locale]/(main)/user/recover
 *
 * After a failed exchange (`?attempted=1`) OR after a successful
 * request-new-link submission (`?sent=1`), the recovery flow redirects HERE
 * — a TOKEN-LESS URL — so the consumed/expired token does NOT persist in
 * the user's browser history, synced history or share-sheet surface.
 *
 * Anti-enumeration (NFR16): identical neutral copy regardless of why the
 * user landed here. The page does NOT reveal whether the original token
 * existed, expired, was used, or never matched.
 *
 * Security headers mirror the [token] sibling route: noindex/nofollow,
 * Referrer-Policy: no-referrer, generic metadata, force-dynamic.
 *
 * ARCH-007: BonBeauty DS boundary — customer-facing storefront only.
 */

import React from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { MagicLinkRecoveryState } from '@/components/molecules/MagicLinkRecoveryState/MagicLinkRecoveryState';

export const dynamic = 'force-dynamic';

interface RecoverIndexPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: RecoverIndexPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.recovery' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: {
      'Referrer-Policy': 'no-referrer'
    }
  };
}

export default async function RecoverIndexPage({
  params
}: RecoverIndexPageProps): Promise<React.ReactElement> {
  const { locale } = await params;

  return (
    <main
      className="container flex min-h-[60vh] items-center justify-center px-4 py-10"
      data-testid="recover-index-page"
    >
      <StorefrontRouteStateSignal
        route="voucher-recovery"
        surface="voucher-recovery"
        stateInput={{ is_pending: true }}
      />
      <div className="w-full max-w-lg">
        <MagicLinkRecoveryState locale={locale} />
      </div>
    </main>
  );
}
