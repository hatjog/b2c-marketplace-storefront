/**
 * Payment Status Page — /[locale]/order/[id]/payment-status
 *
 * v1.7.0 Story 2.4: Cart, Checkout and Payment Status UX.
 *
 * Post-checkout status page. Customer lands here after PSP redirect or when
 * refreshing the status page. Displays the current payment/order state and
 * exactly ONE primary recovery path per shared lifecycle contract.
 *
 * CRITICAL: `dynamic = 'force-dynamic'` — payment/order/voucher state is
 * volatile. No ISR / no shared cache (`revalidate=300` banned per prd.md §Volatile
 * state rendering). Refresh must ALWAYS fetch live status from backend.
 *
 * AC3 compliance:
 *   - Timestamped status (real backend timestamp, never "just now").
 *   - Exactly one primary recovery CTA per status per FR8.
 *   - Ambiguous/unknown state → pending_psp_confirmation (never optimistic paid).
 *   - Refresh is a read; Retry is an explicit mutation (idempotency key per NFR8/NFR9).
 *
 * Idempotency (NFR8 / NFR9):
 *   - Page load / refresh calls status-READ endpoint only.
 *   - Retry CTA triggers payment retry via client action with fresh attempt key.
 *   - No duplicate order/charge from back-button / second tab.
 *
 * Story 2.5 handoff:
 *   - `paid` state → Continue → /order/[id]/confirmed (ConfirmationHandoff owned by 2.5).
 *   - This page does NOT render voucher delivery copy (ANTI-PATTERN per spec).
 *
 * ARCH-007: Customer-facing storefront.
 */

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PaymentStatusPageContent } from '@/components/sections/PaymentStatusPageContent/PaymentStatusPageContent';

// CRITICAL: force-dynamic — payment status is volatile; no shared ISR cache.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payment_status');
  return {
    title: t('page_title'),
    description: t('page_description'),
    // No index — payment status pages should not be indexed by search engines.
    robots: { index: false, follow: false },
  };
}

export default async function PaymentStatusPage(props: Props) {
  const params = await props.params;

  return (
    <main
      id="main-content"
      className="container py-8"
    >
      <PaymentStatusPageContent orderId={params.id} />
    </main>
  );
}
