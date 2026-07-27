/**
 * Generic Recipient Claim Landing — /[locale]/claim
 *
 * v1.9.1 Wave H2C: thin sentinel landing for the P4 recipient claim flow
 * (J5 persona contract). Per-code claim deep-link lives at
 * `/[locale]/voucher/[code]` (existing); this generic route handles:
 *   - J5a: magic-link refresh surface (`?status=expired`) — resend CTA
 *   - J5b: minor consent / KYC notice (`?kyc=minor`) — guardian copy
 *   - J5c: brand intro block — header banner
 *   - J5d: locale auto-detect / cross-market fallback — locale switcher
 *
 * Sentinel surface contract (E2E-C / J5):
 *   - SSR-rendered, 200 across pl/en/ua/de
 *   - Always renders brand intro (header h1) + locale switcher (chrome)
 *   - Conditionally surfaces resend CTA + KYC notice based on query
 *
 * Does NOT redeem the voucher (that lives on /voucher/[code]).
 */
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'voucher.recipient.meta' });
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

function pickQuery(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export default async function GenericClaimLandingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'voucher.recipient.landing' });
  const sp = await searchParams;
  const status = pickQuery(sp.status);
  const kyc = pickQuery(sp.kyc);

  const isExpired = status === 'expired';
  const isMinorKyc = kyc === 'minor' || kyc === 'guardian';

  return (
    <main
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="generic-claim-landing"
      data-section="brand-intro"
    >
      <header data-testid="brand-intro" className="mb-8">
        <h1 className="heading-lg mb-2 text-primary" data-testid="claim-landing-heading">
          {t('heading')}
        </h1>
        <p className="text-sm text-tertiary">{t('brand_tagline')}</p>
      </header>

      <p className="mb-6 max-w-prose text-base text-secondary">{t('body')}</p>

      {isExpired && (
        <form action="/api/voucher/resend" method="POST" className="mb-6">
          <button
            type="submit"
            data-testid="magic-link-refresh"
            className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-on-action hover:opacity-90"
          >
            {t('resend_cta')}
          </button>
        </form>
      )}

      {isMinorKyc && (
        <aside
          role="note"
          data-testid="minor-consent-kyc-notice"
          className="rounded-md border border-tertiary/20 bg-tertiary/5 px-4 py-3 text-sm text-secondary"
        >
          {t('kyc_notice')}
        </aside>
      )}
    </main>
  );
}
