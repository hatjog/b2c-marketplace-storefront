/**
 * Magic-link voucher recovery landing route — Story 2.6 (v1.7.0).
 *
 * Route: /[locale]/(main)/user/recover/[token]
 * Placed in (main) route group (same layout as /user/orders) so it benefits
 * from the Header/Footer/market-config context already present in (main)/layout.
 *
 * Click-to-continue pattern (review fix HIGH-3):
 *   The token exchange runs ONLY after an explicit user gesture (POST via
 *   <form action={exchangeRecoveryTokenForm}>). This prevents email-security
 *   scanners (Microsoft Defender SafeLinks, Google Gmail link-prefetch,
 *   corporate proxies) from prematurely consuming the single-use token via
 *   GET prefetch. Compare to the v1.5.0 voucher/consent/[token]/page.tsx
 *   pattern which similarly gates state-changing actions behind explicit
 *   user gestures (Server Action triggered by user click).
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
 * This page does NOT need to change — it only triggers the action via a
 * user-initiated form submission and renders success/failure states.
 *
 * ARCH-007: BonBeauty DS boundary — customer-facing storefront only.
 */

import React from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { exchangeRecoveryTokenForm } from '@/actions/voucher-recovery';

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
 * Default GET render: shows a "Continue" button that, when clicked, posts
 *   to the Server Action `exchangeRecoveryTokenForm` (which performs the
 *   single-use exchange and redirects).
 *
 * After failed exchange (`?attempted=1`): renders the neutral
 *   MagicLinkRecoveryState — anti-enumeration: same copy regardless of
 *   actual backend error code.
 *
 * The token is read from params and only forwarded to the form as a hidden
 * input value. It is NEVER rendered into visible DOM, NEVER logged, NEVER
 * passed to client components beyond the hidden input on the form.
 */
export default async function RecoverPage({
  params
}: RecoverPageProps): Promise<React.ReactElement> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.recovery' });

  // Render the click-to-continue form. Token is in a hidden input
  // (form will POST to the Server Action only on user click — preventing
  // email-scanner / link-prefetch single-use consumption).
  //
  // Failure path (re-review M-token-persist): the form action redirects to
  // /[locale]/user/recover (token-less route) on failure so the consumed
  // token does not persist in URL / browser history / synced history.
  // The aria-label='voucher-recovery' slug was removed (re-review INFO);
  // the <main> landmark alone is sufficient and screen readers no longer
  // announce a non-localized slug.
  return (
    <main
      className="container flex min-h-[60vh] items-center justify-center px-4 py-10"
      data-testid="recover-page"
    >
      <div className="w-full max-w-lg flex flex-col items-center gap-6 text-center">
        <h1 className="heading-md text-primary">{t('title')}</h1>
        <p className="text-secondary">{t('body')}</p>
        <form
          action={exchangeRecoveryTokenForm}
          method="POST"
          className="flex w-full max-w-sm flex-col gap-3"
          data-testid="recover-continue-form"
        >
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            className="min-h-12 rounded-sm bg-action px-6 py-3 text-action-on-primary font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-action"
            data-testid="recover-continue-cta"
          >
            {t('continue_cta')}
          </button>
        </form>
      </div>
    </main>
  );
}
