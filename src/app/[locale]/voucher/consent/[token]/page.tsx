import type React from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { submitVoucherConsent } from '@/actions/voucher-kyc-consent';
import { initialVoucherConsentActionState } from '@/actions/voucher-kyc-consent-state';
import { StorefrontRouteStateSignal } from '@/components/atoms';
import { getVoucherConsentContext } from '@/lib/data/voucher-consent';

import { ConsentForm } from './ConsentForm';

export const dynamic = 'force-dynamic';

async function submitVoucherConsentNoScript(formData: FormData): Promise<void> {
  'use server';
  await submitVoucherConsent(initialVoucherConsentActionState, formData);
}

interface ConsentPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: ConsentPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher-consent' });
  return {
    title: t('title'),
    description: t('subtitle'),
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
  const t = await getTranslations({ locale, namespace: 'voucher-consent' });
  const context = await getVoucherConsentContext(token);
  const captchaSiteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY?.trim() || null;

  return (
    <main
      data-testid="voucher-consent-page"
      data-token={token}
      className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col justify-center gap-6 px-4 py-10"
    >
      <StorefrontRouteStateSignal
        route="voucher-consent"
        surface="voucher-consent"
      />
      <header className="text-center">
        <h1 className="heading-lg text-primary">{t('title')}</h1>
        <p className="mt-3 text-secondary">{t('subtitle')}</p>
      </header>

      {!context.ok && (
        <section
          role="alert"
          className="rounded-sm border border-negative bg-negative-secondary px-4 py-3 text-sm text-negative"
          data-testid="voucher-consent-error-state"
        >
          {t(`error_${context.error}`)}
        </section>
      )}

      {context.ok && context.state === 'blocked' && (
        <section
          role="status"
          className="rounded-sm border border-warning bg-warning-secondary px-4 py-3 text-sm text-primary"
          data-testid="voucher-consent-blocked-state"
        >
          {t('blocked_minor_message')}
        </section>
      )}

      {context.ok && (
        <>
          <noscript>
            <form
              action={submitVoucherConsentNoScript}
              className="flex w-full flex-col gap-4 rounded-sm border border-tertiary p-4"
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
                name="age_check_required"
                value={context.age_check_required ? 'true' : 'false'}
              />
              {context.age_check_required && (
                <>
                  <label className="flex flex-col gap-2">
                    <span>{t('label_guardian_email')}</span>
                    <input
                      type="email"
                      name="guardian_email"
                      required
                      className="min-h-12 rounded-sm border border-primary bg-primary px-4 py-3"
                    />
                  </label>
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      name="guardian_is_parent"
                      required
                    />
                    <span>{t('label_guardian_is_parent')}</span>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span>{t('captcha_label')}</span>
                    <input
                      type="text"
                      name="captcha_token"
                      required
                      className="min-h-12 rounded-sm border border-primary bg-primary px-4 py-3"
                    />
                  </label>
                  <p className="text-sm text-secondary">{t('privacy_guardian_email_notice')}</p>
                </>
              )}
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="consent_rodo"
                  required
                />
                <span>{t('label_rodo')}</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="consent_service_execution"
                  required
                />
                <span>{t('label_service_execution')}</span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  name="consent_marketing"
                />
                <span>{t('label_marketing')}</span>
              </label>
              <button
                type="submit"
                className="min-h-12 rounded-sm bg-action px-6 py-3 text-action-on-primary"
              >
                {t('cta_submit')}
              </button>
            </form>
          </noscript>
          <ConsentForm
            token={token}
            locale={locale}
            ageCheckRequired={context.age_check_required}
            captchaSiteKey={captchaSiteKey}
          />
        </>
      )}
    </main>
  );
}
