/**
 * Magic-link voucher recovery landing route — Story 2.6 (v1.7.0).
 *
 * Route: /[locale]/(main)/user/recover/[token]
 * Placed in (main) route group (same layout as /user/orders) so it benefits
 * from the Header/Footer/market-config context already present in (main)/layout.
 *
 * Security baseline (mirrors voucher/consent/[token]/page.tsx):
 *   - robots: noindex/nofollow — no search-engine indexing of recovery links.
 *   - referrer: no-referrer — token must not appear in Referer header on
 *     outbound navigation (NFR16).
 *   - Generic metadata title/description — no PII, no voucher status, no
 *     session state in og:title / og:description.
 *   - dynamic = 'force-dynamic' — no CDN caching of recovery pages.
 *
 * Anti-enumeration (NFR16): token is read server-side only; on any failure
 * (expired, already-used, malformed) the same neutral state renders — the
 * caller cannot distinguish between "never existed", "expired" or "used".
 *
 * Token logging: token is NEVER passed to console.log / console.error /
 * analytics — it stays in the server-side exchangeRecoveryToken call only.
 *
 * URL grammar: /[locale]/user/recover/<base64url-opaque-32B>
 *   The token segment is an opaque server-generated value; it contains no
 *   email, customer_id, order_id, voucher.code, voucher.status, nor any
 *   reusable identifier readable without backend exchange.
 *
 * Story 4.4 carry-over: if the backend provisions a dedicated
 * /store/auth/customer/token-exchange endpoint (TF-208 / TF-209) for voucher
 * consent / auth alignment, the exchangeRecoveryToken action in
 * src/actions/voucher-recovery.ts should be updated to call that endpoint.
 * This page does NOT need to change — it only calls the action and renders
 * success/failure states.
 *
 * ARCH-007: BonBeauty DS boundary — customer-facing storefront only.
 */

import React from 'react';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { MagicLinkRecoveryState } from '@/components/molecules/MagicLinkRecoveryState/MagicLinkRecoveryState';
import { exchangeRecoveryToken } from '@/actions/voucher-recovery';

export const dynamic = 'force-dynamic';

interface RecoverPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: RecoverPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.recovery' });
  return {
    // Generic title — no PII, no voucher status, no session state (NFR16).
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: {
      'Referrer-Policy': 'no-referrer'
    }
  };
}

/**
 * Server Component entry point.
 *
 * On load: attempts to exchange the opaque token for a customer session.
 *   Success → redirect to /[locale]/user/vouchers (voucher history view).
 *   Failure → render MagicLinkRecoveryState (neutral anti-enumeration error).
 *
 * The token is read from params and passed to the server action — it is
 * NEVER rendered into the DOM, NEVER passed to client components, NEVER
 * logged. The MagicLinkRecoveryState component receives only `locale`.
 */
export default async function RecoverPage({
  params
}: RecoverPageProps): Promise<React.ReactElement> {
  const { locale, token } = await params;

  // Exchange token server-side. On success: sets auth cookie + redirects.
  // On failure: result.ok === false, render neutral recovery state.
  const result = await exchangeRecoveryToken(token);

  if (result.ok) {
    // Session established — redirect to voucher history.
    // redirect() throws internally in Next.js; no return needed.
    redirect(`/${locale}/user/vouchers`);
  }

  return (
    <main
      className="container flex min-h-[60vh] items-center justify-center px-4 py-10"
      data-testid="recover-page"
      aria-label="voucher-recovery"
    >
      <div className="w-full max-w-lg">
        <MagicLinkRecoveryState locale={locale} />
      </div>
    </main>
  );
}
