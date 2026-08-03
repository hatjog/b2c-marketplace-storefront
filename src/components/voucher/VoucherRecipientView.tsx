import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';
import Link from 'next/link';

import type { VoucherRecipientPolicyView, VoucherRecipientView as VoucherRecipientModel } from '@/lib/data/voucher';
import { toIntlLocale } from '@/lib/helpers/hreflang';
import { buildGoogleMapsDeeplink, buildSearchFallbackDeeplink } from '@/lib/helpers/maps-deeplink';
import { formatVoucherPrice } from '@/lib/voucher/voucher-copy';

import { VoucherCodeCopyButton } from './VoucherCodeCopyButton';
import { SymmetricPossessionSection } from '../voucher-possession/SymmetricPossessionSection';

type VoucherRecipientViewProps = {
  locale: string;
  requestedCode: string;
  voucher: VoucherRecipientModel | null;
};

function formatDate(iso: string | null | undefined, locale: string): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(toIntlLocale(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Warsaw',
  });
}

function getGoogleMapsHref(voucher: VoucherRecipientModel): string | null {
  if (typeof voucher.seller_lat === 'number' && typeof voucher.seller_lng === 'number') {
    return buildGoogleMapsDeeplink({
      lat: voucher.seller_lat,
      lng: voucher.seller_lng,
      name: voucher.seller_name,
    });
  }

  if (voucher.seller_address) {
    return buildSearchFallbackDeeplink({
      provider: 'google',
      name: voucher.seller_name,
      address: voucher.seller_address,
    });
  }

  return null;
}

function renderPolicyLine(
  policy: VoucherRecipientPolicyView | null | undefined,
  t: Awaited<ReturnType<typeof getTranslations<'voucher.recipient'>>>,
) {
  const extension = policy?.extension;
  if (!extension) {
    return t('rules.extension_fallback');
  }

  if (!extension.allowed) {
    return t('rules.extension_unavailable');
  }

  if (!extension.paid) {
    return t('rules.extension_free', {
      months: extension.max_extension_months ?? 0,
    });
  }

  return t('rules.extension_paid', {
    months: extension.max_extension_months ?? 0,
    feePct: extension.fee_pct ?? 0,
  });
}

function renderCancellationLine(
  policy: VoucherRecipientPolicyView | null | undefined,
  t: Awaited<ReturnType<typeof getTranslations<'voucher.recipient'>>>,
) {
  const cancellation = policy?.cancellation;
  if (!cancellation || cancellation.cutoff_hours === null) {
    return t('rules.cancellation_fallback');
  }

  if (cancellation.fee_pct === null) {
    return t('rules.cancellation_only_cutoff', {
      hours: cancellation.cutoff_hours,
    });
  }

  return t('rules.cancellation', {
    hours: cancellation.cutoff_hours,
    feePct: cancellation.fee_pct,
  });
}

function renderRefundLine(
  policy: VoucherRecipientPolicyView | null | undefined,
  t: Awaited<ReturnType<typeof getTranslations<'voucher.recipient'>>>,
) {
  // v1.9.1 Wave G3 / CC-2 #5 — canonicalise to backend SSOT 3-value
  // REFUND_CHANNELS (`original_payment | store_credit | vendor_wallet`).
  // `bank_transfer` removed — it was never in the backend boundary and
  // caused recipient-side blank refund lines for `vendor_wallet` policies.
  switch (policy?.refund_channel) {
    case 'original_payment':
    case 'store_credit':
    case 'vendor_wallet':
      return t(`rules.refund_channel_values.${policy.refund_channel}`);
    default:
      return t('rules.refund_fallback');
  }
}

function renderNoShowLine(
  policy: VoucherRecipientPolicyView | null | undefined,
  t: Awaited<ReturnType<typeof getTranslations<'voucher.recipient'>>>,
) {
  // v1.9.1 Wave G3 / CC-2 #6 — canonicalise to backend SSOT 5-value
  // NO_SHOW_POLICIES (adds `vendor_decision`). Previously `vendor_decision`
  // policies rendered blank no-show lines on recipient page (Trust Invariant
  // UX-DR16 violation — invisible policy ≡ "no policy applies").
  switch (policy?.no_show_policy) {
    case 'charge_full':
    case 'charge_partial':
    case 'no_charge':
    case 'forfeit_voucher':
    case 'vendor_decision':
      return t(`rules.no_show_values.${policy.no_show_policy}`);
    default:
      return t('rules.no_show_fallback');
  }
}

function FooterLinks({
  locale,
  t,
}: {
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<'voucher.recipient'>>>;
}) {
  return (
    <footer className="pt-10 text-center text-sm text-[var(--text-secondary)]">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Link href={`/${locale}/zasady`} className="underline underline-offset-4">
          {t('footer.rules')}
        </Link>
        <Link href={`/${locale}/polityka-prywatnosci`} className="underline underline-offset-4">
          {t('footer.privacy')}
        </Link>
        <Link href={`/${locale}/pomoc`} className="underline underline-offset-4">
          {t('footer.support')}
        </Link>
      </div>
    </footer>
  );
}

export async function VoucherRecipientView({
  locale,
  requestedCode,
  voucher,
}: VoucherRecipientViewProps) {
  const t = await getTranslations({ locale, namespace: 'voucher.recipient' });
  const reqHeaders = await headers();
  const requestUserAgent = reqHeaders.get('user-agent') ?? '';

  const expiryDate = formatDate(voucher?.expires_at, locale);
  const redeemedDate = formatDate(voucher?.redeemed_at, locale);
  const visibleCode = voucher?.is_public_entry_confirmed ? voucher.code : null;
  const sellerHref =
    voucher?.seller_handle && voucher.seller_handle.length > 0
      ? `/${locale}/sellers/${voucher.seller_handle}`
      : null;
  const mapsHref = voucher ? getGoogleMapsHref(voucher) : null;

  if (!voucher || voucher.state === 'expired') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <span className="inline-flex rounded-full border border-[var(--bb-border-soft)] bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">
            {t('expired.badge')}
          </span>
          <h1 className="heading-lg max-w-2xl text-[var(--text-primary)]">{t('expired.heading')}</h1>
          <p className="max-w-xl text-base leading-7 text-[var(--text-secondary)]">
            {expiryDate
              ? t('expired.body_with_date', { date: expiryDate })
              : t('expired.body_fallback')}
          </p>
        </section>

        <section className="mx-auto grid w-full max-w-3xl gap-4 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-white/80 p-6 shadow-[0_24px_60px_var(--bb-shadow-soft)] md:grid-cols-2">
          <div className="space-y-3">
            <h2 className="heading-sm text-[var(--text-primary)]">{t('expired.contact_heading')}</h2>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{t('expired.contact_body')}</p>
            {voucher?.seller_phone && (
              <a href={`tel:${voucher.seller_phone}`} className="block text-sm font-medium text-[var(--bg-action)] underline underline-offset-4">
                {voucher.seller_phone}
              </a>
            )}
            <Link href={`/${locale}/pomoc`} className="inline-flex min-h-12 items-center rounded-full bg-[var(--bg-action)] px-5 py-3 text-sm font-medium text-[var(--bb-surface)]">
              {t('expired.support_cta')}
            </Link>
          </div>
          <div className="space-y-3 rounded-[var(--bb-radius-panel)] border border-dashed border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-5">
            <h2 className="heading-sm text-[var(--text-primary)]">{t('expired.privacy_heading')}</h2>
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              {visibleCode
                ? t('expired.privacy_known_code')
                : t('expired.privacy_unknown_code')}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">{t('expired.support_hint')}</p>
          </div>
        </section>

        <FooterLinks locale={locale} t={t} />
      </div>
    );
  }

  if (voucher.state === 'already_redeemed') {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <span className="inline-flex rounded-full border border-[var(--color-success-500)] bg-[var(--color-success-50)] px-4 py-2 text-xs uppercase tracking-[0.24em] text-[var(--color-success-700)]">
            {t('redeemed.badge')}
          </span>
          <h1 className="heading-lg max-w-2xl text-[var(--text-primary)]">{t('redeemed.heading')}</h1>
          <p className="max-w-xl text-base leading-7 text-[var(--text-secondary)]">
            {t('redeemed.body', {
              seller: voucher.seller_name,
              date: redeemedDate ?? t('redeemed.timestamp_fallback'),
            })}
          </p>
        </section>

        <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-[var(--bb-radius-panel)] border border-[var(--color-success-500)] bg-white/85 p-6 shadow-[0_24px_60px_var(--bb-shadow-soft)]">
          <div className="space-y-2">
            <h2 className="heading-sm text-[var(--text-primary)]">{t('redeemed.contact_heading')}</h2>
            <p className="text-sm text-[var(--text-secondary)]">{voucher.seller_name}</p>
            {voucher.seller_address && <p className="text-sm text-[var(--text-secondary)]">{voucher.seller_address}</p>}
            {voucher.seller_phone && (
              <a href={`tel:${voucher.seller_phone}`} className="text-sm font-medium text-[var(--bg-action)] underline underline-offset-4">
                {voucher.seller_phone}
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/sellers`} className="inline-flex min-h-12 items-center rounded-full bg-[var(--bg-action)] px-5 py-3 text-sm font-medium text-[var(--bb-surface)]">
              {t('redeemed.cta_explore')}
            </Link>
            <Link href={`/${locale}/pomoc`} className="inline-flex min-h-12 items-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-sm font-medium text-[var(--bg-action)]">
              {t('redeemed.cta_support')}
            </Link>
          </div>
        </section>

        <FooterLinks locale={locale} t={t} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <span className="inline-flex rounded-full bg-[var(--bb-surface-strong)] px-4 py-2 text-xs uppercase tracking-[0.28em] text-[var(--cta-hover)]">
          {voucher.sender_disclosure_allowed && voucher.sender_name
            ? t('active.hero_sender_disclosed', { sender: voucher.sender_name })
            : t('active.hero_sender_fallback')}
        </span>
        <h1 className="heading-lg max-w-3xl text-[var(--text-primary)]">
          {voucher.sender_message || t('active.heading')}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-[var(--text-secondary)]">
          {t('active.subheading')}
        </p>
      </section>

      <section className="mx-auto flex w-full max-w-[480px] flex-col gap-5 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white/90 p-6 shadow-[0_24px_60px_var(--bb-shadow-soft)]">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">
            {voucher.seller_city
              ? t('active.card_eyebrow_with_city', { seller: voucher.seller_name, city: voucher.seller_city })
              : voucher.seller_name}
          </p>
          <h2 className="heading-sm text-[var(--text-primary)]">{voucher.product_title || t('active.service_fallback')}</h2>
        </div>

        <div className="text-4xl font-medium tracking-[-0.02em] text-[var(--text-primary)]">
          {formatVoucherPrice(voucher.value_minor, voucher.currency_code, locale)}
        </div>

        <div className="space-y-2 rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">{t('active.code_label')}</p>
            <p className="mt-2 break-all font-mono text-lg text-[var(--text-primary)]">{voucher.code}</p>
          </div>
          <VoucherCodeCopyButton
            code={voucher.code}
            buttonLabel={t('active.copy_cta')}
            buttonAriaLabel={t('active.copy_aria')}
            copiedLabel={t('active.copy_feedback')}
            unavailableLabel={t('active.copy_unavailable')}
          />
        </div>

        <div className="text-sm text-[var(--text-secondary)]">
          {expiryDate
            ? t('active.validity', { date: expiryDate })
            : t('active.validity_fallback')}
        </div>

        <SymmetricPossessionSection
          voucherCode={voucher.code}
          locale={locale === 'en' || locale === 'de' || locale === 'ua' ? locale : 'pl'}
          pdfHref={voucher.pdf_url ?? `/api/voucher/${voucher.code}/pdf`}
          userAgent={requestUserAgent}
        />
      </section>

      <section className="mx-auto w-full max-w-5xl rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white/70 p-6 md:p-8">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">{t('steps.eyebrow')}</p>
          <h2 className="heading-md mt-2 text-[var(--text-primary)]">{t('steps.heading')}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {['show_code', 'book_visit', 'enjoy_service'].map((stepKey, index) => (
            <article key={stepKey} className="rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-5">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bb-surface-strong)] text-sm font-semibold text-[var(--cta-hover)]">
                {index + 1}
              </div>
              <h3 className="mb-2 text-base font-medium text-[var(--text-primary)]">{t(`steps.${stepKey}.title`)}</h3>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">{t(`steps.${stepKey}.body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <article className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white/80 p-6 md:p-8">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">{t('salon.eyebrow')}</p>
            {sellerHref ? (
              <Link href={sellerHref} className="heading-sm mt-2 inline-block text-[var(--text-primary)] underline underline-offset-4">
                {voucher.seller_name}
              </Link>
            ) : (
              <h2 className="heading-sm mt-2 text-[var(--text-primary)]">{voucher.seller_name}</h2>
            )}
          </div>

          <div className="space-y-3 text-sm leading-6 text-[var(--text-secondary)]">
            {voucher.seller_address && <p>{voucher.seller_address}</p>}
            {voucher.seller_phone && (
              <p>
                <span className="font-medium text-[var(--text-primary)]">{t('salon.phone_label')} </span>
                <a href={`tel:${voucher.seller_phone}`} className="underline underline-offset-4">
                  {voucher.seller_phone}
                </a>
              </p>
            )}
            {voucher.seller_hours && (
              <p>
                <span className="font-medium text-[var(--text-primary)]">{t('salon.hours_label')} </span>
                {voucher.seller_hours}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {sellerHref && (
              <Link href={sellerHref} className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-sm font-medium text-[var(--bg-action)]">
                {t('salon.seller_cta')}
              </Link>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--bb-border-soft)] bg-white px-5 py-3 text-sm font-medium text-[var(--bg-action)]"
              >
                {t('salon.maps_cta')}
              </a>
            )}
          </div>
        </article>

        <aside className="rounded-[var(--bb-radius-card)] border border-dashed border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-6">
          <div className="flex h-full min-h-56 flex-col justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">{t('map_placeholder.eyebrow')}</p>
              <h2 className="heading-sm mt-2 text-[var(--text-primary)]">{t('map_placeholder.heading')}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{t('map_placeholder.body')}</p>
            </div>
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--bg-action)] px-5 py-3 text-sm font-medium text-[var(--bb-surface)]"
              >
                {t('map_placeholder.primary_cta')}
              </a>
            )}
          </div>
        </aside>
      </section>

      <section className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white/80 p-6 md:p-8">
        <h2 className="heading-sm text-[var(--text-primary)]">{t('handoff.heading')}</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{t('handoff.body')}</p>
      </section>

      <details className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white/80 p-6 md:p-8">
        <summary className="cursor-pointer list-none text-left">
          <span className="heading-sm text-[var(--text-primary)]">{t('rules.summary')}</span>
        </summary>
        <div className="mt-5 grid gap-4 text-sm leading-7 text-[var(--text-secondary)]">
          <p>
            <span className="font-medium text-[var(--text-primary)]">{t('rules.validity_label')} </span>
            {expiryDate ? t('rules.validity_value', { date: expiryDate }) : t('rules.validity_fallback')}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">{t('rules.extension_label')} </span>
            {renderPolicyLine(voucher.policy_snapshot, t)}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">{t('rules.cancellation_label')} </span>
            {renderCancellationLine(voucher.policy_snapshot, t)}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">{t('rules.refund_label')} </span>
            {renderRefundLine(voucher.policy_snapshot, t)}
          </p>
          <p>
            <span className="font-medium text-[var(--text-primary)]">{t('rules.no_show_label')} </span>
            {renderNoShowLine(voucher.policy_snapshot, t)}
          </p>
        </div>
      </details>

      <FooterLinks locale={locale} t={t} />
      <div className="sr-only">{requestedCode}</div>
    </div>
  );
}

export default VoucherRecipientView;
