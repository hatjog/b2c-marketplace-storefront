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
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
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

const COPY: Record<string, {
  heading: string;
  body: string;
  resendCta: string;
  kycNotice: string;
  brandTagline: string;
}> = {
  pl: {
    heading: 'Twój voucher BonBeauty',
    body: 'Otwórz link z e-maila lub SMS, aby przejść do swojego vouchera. Jeśli link wygasł, możemy wysłać nowy.',
    resendCta: 'Wyślij nowy link',
    kycNotice: 'Voucher dla osoby niepełnoletniej wymaga zgody opiekuna prawnego (KYC).',
    brandTagline: 'BonBeauty — vouchery do najlepszych salonów beauty',
  },
  en: {
    heading: 'Your BonBeauty voucher',
    body: 'Open the link from your email or SMS to access your voucher. If the link expired, we can resend a fresh one.',
    resendCta: 'Send a new link',
    kycNotice: 'Vouchers for minors require guardian consent (KYC).',
    brandTagline: 'BonBeauty — vouchers for the best beauty salons',
  },
  ua: {
    heading: 'Ваш ваучер BonBeauty',
    body: 'Відкрийте посилання з e-mail або SMS, щоб переглянути ваш ваучер. Якщо посилання прострочене, ми можемо надіслати нове.',
    resendCta: 'Надіслати нове посилання',
    kycNotice: "Ваучери для неповнолітніх потребують згоди опікуна (KYC).",
    brandTagline: 'BonBeauty — ваучери до найкращих салонів краси',
  },
  de: {
    heading: 'Dein BonBeauty-Gutschein',
    body: 'Öffne den Link aus deiner E-Mail oder SMS, um deinen Gutschein einzulösen. Wenn der Link abgelaufen ist, können wir einen neuen schicken.',
    resendCta: 'Neuen Link senden',
    kycNotice: 'Gutscheine für Minderjährige erfordern die Zustimmung des Erziehungsberechtigten (KYC).',
    brandTagline: 'BonBeauty — Gutscheine für die besten Beauty-Salons',
  },
};

function getCopy(locale: string) {
  return COPY[locale] ?? COPY.en;
}

export default async function GenericClaimLandingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const status = pickQuery(sp.status);
  const kyc = pickQuery(sp.kyc);
  const copy = getCopy(locale);

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
          {copy.heading}
        </h1>
        <p className="text-sm text-tertiary">{copy.brandTagline}</p>
      </header>

      <p className="mb-6 max-w-prose text-base text-secondary">{copy.body}</p>

      {isExpired && (
        <form action="/api/voucher/resend" method="POST" className="mb-6">
          <button
            type="submit"
            data-testid="magic-link-refresh"
            className="rounded-full bg-action px-6 py-3 text-sm font-semibold text-on-action hover:opacity-90"
          >
            {copy.resendCta}
          </button>
        </form>
      )}

      {isMinorKyc && (
        <aside
          role="note"
          data-testid="minor-consent-kyc-notice"
          className="rounded-md border border-tertiary/20 bg-tertiary/5 px-4 py-3 text-sm text-secondary"
        >
          {copy.kycNotice}
        </aside>
      )}
    </main>
  );
}
