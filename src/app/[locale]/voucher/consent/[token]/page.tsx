import React from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ConsentMomentInline } from '@/components/molecules/ConsentMomentInline';
import { RecipientPausePathToggle } from '@/components/molecules/RecipientPausePathToggle';

import {
  grantConsent,
  withdrawConsent
} from '@/actions/voucher-consent';

/**
 * Voucher PII consent moment route — STORY-2-1.
 *
 * Hybrid pattern (per Method #36 Devil's Advocate elicitation):
 *   route + native <dialog> on mount = both deep-link semantics AND
 *   Art. 7 modal cognitive cue.
 *
 * No-JS path: the same page renders a native <form action> with the same
 * Server Action `grantConsent` so JS-disabled clients can complete consent.
 * AC-VPII-2.1-02 / AC-CONSENT-NO-JS-01 verified by Playwright with
 * `javaScriptEnabled: false`.
 *
 * Security headers (NFR-SEC-5 / NFR-SEC-6 / Risk #5):
 *   `frame-ancestors 'none'` is enforced project-wide via `src/lib/security/csp.ts`.
 *   `Referrer-Policy: no-referrer` is set per-route below.
 */

export const dynamic = 'force-dynamic';

interface ConsentPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: ConsentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.consent' });
  return {
    title: t('heading'),
    description: t('purpose'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: {
      'Referrer-Policy': 'no-referrer'
    }
  };
}

export default async function VoucherConsentPage({
  params
}: ConsentPageProps): Promise<React.ReactElement> {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.consent' });
  const privacyPolicyHref = `/${locale}/polityka-prywatnosci`;

  return (
    <main
      data-testid="voucher-consent-page"
      data-token={token}
      className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10"
    >
      <h1 className="heading-lg">{t('heading')}</h1>

      {/* No-JS fallback: server-rendered <form> identical to JS path. */}
      <noscript>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <form
          action={grantConsent as any}
          method="POST"
          className="flex flex-col gap-4 rounded-sm border border-tertiary p-4"
        >
          <input
            type="hidden"
            name="token"
            value={token}
          />
          <input
            type="hidden"
            name="locale"
            value={locale}
          />
          <input
            type="hidden"
            name="surface"
            value="no-js"
          />
          <p>{t('purpose')}</p>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="consent"
              value="on"
              required
              aria-label={t('checkbox_aria')}
            />
            <span>{t('checkbox_label')}</span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <a
              href={`/${locale}/voucher/consent/${token}/skipped`}
              className="min-h-12 min-w-12 rounded-sm border border-tertiary px-6 py-3"
            >
              {t('skip_cta')}
            </a>
            <button
              type="submit"
              className="min-h-12 min-w-12 rounded-sm bg-action px-6 py-3 text-action-on-primary"
            >
              {t('grant_cta')}
            </button>
          </div>
        </form>
      </noscript>

      {/* JS path — native <dialog> opens on mount via showModal(). */}
      <ConsentMomentInline
        token={token}
        locale={locale}
        privacyPolicyHref={privacyPolicyHref}
      />

      <RecipientPausePathToggle
        token={token}
        locale={locale}
      />

      {/* Withdrawal symmetry — per UX-DR30. Always-visible withdraw form. */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form
        action={withdrawConsent as any}
        method="POST"
        className="rounded-sm border border-tertiary p-4"
      >
        <input
          type="hidden"
          name="token"
          value={token}
        />
        <input
          type="hidden"
          name="locale"
          value={locale}
        />
        <input
          type="hidden"
          name="compensates_audit_id"
          value=""
        />
        <input
          type="hidden"
          name="surface"
          value="no-js"
        />
        <p className="mb-3 text-sm">{t('withdraw_explainer')}</p>
        <button
          type="submit"
          data-testid="consent-withdraw-cta"
          className="min-h-12 min-w-12 rounded-sm border border-action px-6 py-3 text-action"
        >
          {t('withdraw_cta')}
        </button>
      </form>
    </main>
  );
}
