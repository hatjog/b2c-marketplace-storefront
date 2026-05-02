import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { getVoucherByCode } from '@/lib/data/voucher';
import { claimVoucher } from '@/actions/voucher-claim';
import { OfflineBanner } from '@/components/voucher/OfflineBanner';

// Adapter so <form action={...}> matches Next.js Server Action signature
// (void return). claimVoucher's structured result is consumed via
// revalidatePath on the server side.
async function claimVoucherFormAction(formData: FormData): Promise<void> {
  'use server';
  await claimVoucher(formData);
}

/**
 * Story v160-6-1: Recipient claim page `/voucher/[code]` — multi-vendor
 * extension preserves GDPR + privacy boundary (FR6 + FR7 + FR27).
 *
 * Visual rebrand: FLEEK-spirit (typography Inter, primary/gold tokens, 8pt
 * grid via existing storefront theme). State machine: 4 states preserved
 * 1:1 from v1.5.0 baseline (idle → consent-pending → claimed → withdrawn).
 *
 * Privacy posture (AR45):
 *   - Server Component server-side projection in `getVoucherByCode()`
 *     strips buyer-side PII (allowlist).
 *   - generateMetadata uses generic locale-aware title (NOT seller-specific
 *     to avoid og:title PII leak vector).
 *   - `robots: noindex/nofollow` + `Referrer-Policy: no-referrer` per v1.5.0
 *     consent route security baseline.
 *   - Gold-dot hooks (data-event="...") prepared for Story 6.3 timeline
 *     wiring.
 *
 * Coexistence: this NEW route does NOT replace `voucher/consent/[token]`;
 * the v1.5.0 consent route remains as-is for backward compat. Story 6.4
 * may consolidate later.
 */

export const dynamic = 'force-dynamic';

interface ClaimPageProps {
  params: Promise<{ locale: string; code: string }>;
}

export async function generateMetadata({ params }: ClaimPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.claim' });
  return {
    title: t('meta_default_title'),
    description: t('meta_default_description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: {
      'Referrer-Policy': 'no-referrer'
    }
  };
}

function formatValue(minor: number, currency: string, locale: string): string {
  const value = minor / 100;
  try {
    return value.toLocaleString(locale === 'en' ? 'en-US' : 'pl-PL', {
      style: 'currency',
      currency: currency || 'PLN'
    });
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default async function VoucherClaimPage({
  params
}: ClaimPageProps) {
  const { locale, code } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.claim' });

  const voucher = await getVoucherByCode(code);
  if (!voucher) {
    notFound();
  }

  const formattedValue = formatValue(voucher.value_minor, voucher.currency_code, locale);

  return (
    <main
      data-testid="voucher-claim-page"
      data-code={voucher.code}
      data-status={voucher.status}
      className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10"
    >
      <OfflineBanner />
      <header className="flex flex-col gap-2">
        <span
          className="bb-pill"
          data-event="claim_page_view"
          aria-hidden="true"
        >
          BonBeauty
        </span>
        <h1 className="heading-lg">{t('title')}</h1>
        <p className="text-secondary">{t('subtitle')}</p>
      </header>

      <section
        data-testid="voucher-card"
        className="bb-section-shell bb-section-shell-strong flex flex-col gap-4 rounded-sm border border-tertiary p-6"
      >
        <div className="flex flex-col gap-1">
          <span className="label-md text-secondary">{t('seller_label')}</span>
          <Link
            href={`/${locale}/sellers/${voucher.seller_handle}`}
            className="heading-sm text-action underline-offset-4 hover:underline"
            data-testid="voucher-seller-link"
          >
            {voucher.seller_name}
          </Link>
          <span className="label-sm text-secondary">@{voucher.seller_handle}</span>
        </div>

        {voucher.product_title && (
          <div className="flex flex-col gap-1">
            <span className="label-md text-secondary">{t('service_label')}</span>
            <span className="heading-sm" data-testid="voucher-product-title">
              {voucher.product_title}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="label-md text-secondary">{t('value_label')}</span>
          <span className="heading-md" data-testid="voucher-value">
            {formattedValue}
          </span>
        </div>

        {voucher.expires_at && (
          <div className="flex flex-col gap-1">
            <span className="label-md text-secondary">{t('expires_at_label')}</span>
            <time dateTime={voucher.expires_at} className="text-primary">
              {new Date(voucher.expires_at).toLocaleDateString(
                locale === 'en' ? 'en-US' : 'pl-PL'
              )}
            </time>
          </div>
        )}
      </section>

      {voucher.status === 'idle' && (
        <form
          action={claimVoucherFormAction}
          method="POST"
          className="flex flex-col gap-3"
          data-testid="claim-cta-form"
        >
          <input type="hidden" name="code" value={voucher.code} />
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            data-testid="claim-cta-button"
            data-event="claim_cta_click"
            className="min-h-12 min-w-12 rounded-sm bg-action px-6 py-3 text-action-on-primary"
          >
            {t('claim_cta')}
          </button>
        </form>
      )}

      {voucher.status === 'consent_pending' && (
        <section
          data-testid="voucher-consent-pending"
          data-event="consent_pending_view"
          className="rounded-sm border border-tertiary p-4 text-secondary"
        >
          <p>{t('consent_pending_message')}</p>
        </section>
      )}

      {voucher.status === 'claimed' && (
        <section
          data-testid="voucher-claimed"
          data-event="voucher_claimed"
          className="flex flex-col gap-3 rounded-sm border border-positive bg-positive-subtle p-4"
        >
          <span className="heading-sm text-positive">{t('claimed_status')}</span>
          <Link
            href={`/${locale}/sellers/${voucher.seller_handle}?from=claim`}
            data-testid="post-claim-link"
            className="text-action underline-offset-4 hover:underline"
          >
            {t('post_claim_link')}
          </Link>
        </section>
      )}

      {voucher.status === 'withdrawn' && (
        <section
          data-testid="voucher-withdrawn"
          data-event="voucher_withdrawn"
          className="rounded-sm border border-tertiary bg-tertiary-subtle p-4 text-secondary"
        >
          <span className="heading-sm">{t('withdrawn_status')}</span>
        </section>
      )}
    </main>
  );
}
