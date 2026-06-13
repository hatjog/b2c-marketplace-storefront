/**
 * Customer voucher history view — Story 2.6 (v1.7.0).
 *
 * Route: /[locale]/(main)/user/vouchers
 * Server Component — no client-side state needed for the list.
 *
 * UX state contract (Story 0.9 / bonbeauty-critical-paths.ux-state.json):
 *   Each branch maps to a DISTINCT named state — may_mask_failures: false.
 *   - 'ok' + empty list → 'empty' state (VoucherHistoryEmptyState).
 *   - 'ok' + items     → rendered voucher rows.
 *   - 'access_denied'  → 'access_denied' state (login CTA).
 *   - 'unavailable'    → 'unavailable' state (support/back CTA).
 *   - 'failed'         → 'failed' state (retry CTA).
 *   Empty MUST NOT mask access_denied / unavailable / failed (Anti-pattern).
 *
 * PII minimization (NFR17 + FR62):
 *   - seller_id is NOT rendered (routing-only per VoucherListItem allowlist).
 *   - Salon-user fields (employee id, station id, honoured_by, exception_note
 *     author) are stripped server-side in listCustomerVouchers() before render.
 *   - Customer PII (email, address, phone) is not present in VoucherListItem.
 *
 * DS boundary (ARCH-007): customer-facing storefront only.
 * Reuses Badge + Card from atoms (Story 2.1 primitives).
 * Voucher status badges use BonBeauty token-bound variants (bb-* tokens).
 *
 * Cross-links:
 *   - Each voucher row links to /[locale]/voucher/[code] (voucher detail).
 *   - Payment recovery links to /[locale]/(main)/user/orders (Story 2.4).
 */

import React from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { StateCard } from '@/components/molecules/StateCard/StateCard';
import { AccountLayoutWithChrome } from '@/components/templates/AccountLayoutWithChrome';
import { convertToLocale } from '@/lib/helpers/money';
import { toDisplayName } from '@/lib/account/read-heavy';
import { retrieveCustomer } from '@/lib/data/customer';
import { listCustomerVouchers, type VoucherListItem, type VoucherStatus } from '@/lib/data/voucher';

export const dynamic = 'force-dynamic';

interface VouchersPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: VouchersPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.vouchers' });
  return {
    title: t('title')
  };
}

// ---------------------------------------------------------------------------
// Locale-aware date formatter
// ---------------------------------------------------------------------------

/**
 * Format a voucher-expiry ISO timestamp for display.
 *
 * Story 2.6 re-review LOW (L-tz/date-locale):
 *   - Locale-specific formatting honors the actual user locale (pl/en/ua/de)
 *     rather than collapsing all non-EN locales into `pl-PL`.
 *   - timeZone is pinned to `Europe/Warsaw` so server-side rendering does
 *     NOT depend on the Node.js process timezone (a UTC server and a CET
 *     server would otherwise render different calendar dates near midnight).
 *
 * Returns the localized date string; on parse failure returns an empty
 * string so the calling row renders an empty expiry slot rather than NaN.
 */
function formatExpiresDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const bcp47: Record<string, string> = {
    pl: 'pl-PL',
    en: 'en-GB',
    ua: 'uk-UA',
    de: 'de-DE'
  };
  const tag = bcp47[locale] ?? 'pl-PL';
  return date.toLocaleDateString(tag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Europe/Warsaw'
  });
}

function formatVoucherValue(value: number | null, currencyCode: string, locale: string): string | null {
  if (typeof value !== 'number') {
    return null;
  }

  const bcp47: Record<string, string> = {
    pl: 'pl-PL',
    en: 'en-GB',
    ua: 'uk-UA',
    de: 'de-DE'
  };

  return convertToLocale({
    amount: value,
    currency_code: (currencyCode || 'PLN').toUpperCase(),
    locale: bcp47[locale] ?? 'pl-PL',
    isMinorUnit: true,
  });
}

function maskVoucherCode(code: string): string {
  const normalized = code.trim();
  if (normalized.length <= 4) return normalized;
  return `**** ${normalized.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

/** Maps VoucherStatus to BonBeauty token-bound badge classes.
 * Color channel always supplemented by text label — NOT color-only (WCAG 2.1 AA). */
function voucherStatusBadgeClass(status: VoucherStatus): string {
  switch (status) {
    case 'idle':
      return 'bg-secondary text-primary border border-primary';
    case 'consent_pending':
      return 'bg-warning-secondary text-warning-on-primary border border-warning';
    case 'claimed':
      return 'bg-positive-secondary text-positive-on-primary border border-positive';
    case 'withdrawn':
      return 'bg-negative-secondary text-negative border border-negative';
    default:
      return 'bg-secondary text-primary border border-primary';
  }
}

interface VoucherStatusBadgeProps {
  status: VoucherStatus;
  label: string;
}

function VoucherStatusBadge({ status, label }: VoucherStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${voucherStatusBadgeClass(status)}`}
      data-testid={`voucher-status-badge-${status}`}
      aria-label={label}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Voucher row
// ---------------------------------------------------------------------------

interface VoucherRowProps {
  voucher: VoucherListItem;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations<'account.vouchers'>>>;
}

function VoucherRow({ voucher, locale, t }: VoucherRowProps) {
  // Note: avoid `as keyof typeof t` here — `t` is the call signature; its
  // `keyof` resolves to function-property names, not translation keys.
  const statusLabel = t(`status.${voucher.status}`);

  const value = formatVoucherValue(voucher.value_minor, voucher.currency_code, locale);

  return (
    <article
      className="bb-card flex h-full flex-col gap-4"
      style={{
        background: 'var(--journal-card-bg, var(--bb-surface))',
        borderColor: 'var(--journal-card-border)',
        borderRadius: 'var(--journal-card-radius, 16px)',
        boxShadow: 'var(--journal-card-shadow)'
      }}
      data-testid="voucher-row"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
            {maskVoucherCode(voucher.code)}
          </p>
          <h2 className="text-base font-semibold text-primary">{voucher.product_title || voucher.seller_name}</h2>
          <p className="text-sm text-secondary">{voucher.seller_name}</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <VoucherStatusBadge
            status={voucher.status}
            label={String(statusLabel ?? voucher.status)}
          />
          {value && <span className="text-sm font-medium text-primary">{value}</span>}
        </div>
      </div>
      {voucher.expires_at && (
        <p className="text-xs text-secondary">
          {t('expires_label', {
            date: formatExpiresDate(voucher.expires_at, locale)
          } as Parameters<typeof t>[1])}
        </p>
      )}
      <div className="mt-auto flex shrink-0 items-center gap-2">
        <Link
          href={`/${locale}/voucher/${encodeURIComponent(voucher.code)}`}
          className="inline-flex min-h-12 items-center rounded-sm border border-action px-4 py-2 text-sm font-medium text-action focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2"
          data-testid="voucher-open-link"
        >
          {t('row_cta_open')}
        </Link>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Named failure state — maps each UX state contract id to its own StateCard.
// (Anti-pattern: Empty-as-failure mask — NEVER render empty for these states)
// ---------------------------------------------------------------------------

interface NamedStateProps {
  variant: 'access_denied' | 'unavailable' | 'failed';
  locale: string;
}

async function NamedState({ variant, locale }: NamedStateProps) {
  const t = await getTranslations({ locale, namespace: 'account.vouchers.error' });

  // Casts removed (review LOW): `keyof typeof t` resolves to function-property
  // names, not translation keys — it was hiding typos rather than catching them.
  const config = {
    access_denied: {
      title: t('access_denied_heading'),
      description: t('access_denied'),
      stateVariant: 'error' as const,
      action: (
        <Link
          href={`/${locale}/login`}
          className="inline-flex min-h-12 items-center rounded-sm bg-action px-6 py-3 font-medium text-action-on-primary focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2"
          data-testid="access-denied-login-cta"
        >
          {t('access_denied_cta')}
        </Link>
      )
    },
    unavailable: {
      title: t('unavailable_heading'),
      description: t('unavailable'),
      stateVariant: 'unavailable' as const,
      action: (
        <Link
          href={`/${locale}`}
          className="inline-flex min-h-12 items-center rounded-sm border border-primary px-6 py-3 font-medium text-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          data-testid="unavailable-back-cta"
        >
          {t('unavailable_cta')}
        </Link>
      )
    },
    failed: {
      title: t('failed_heading'),
      description: t('failed'),
      stateVariant: 'error' as const,
      action: (
        <Link
          href={`/${locale}/user/vouchers`}
          className="inline-flex min-h-12 items-center rounded-sm bg-action px-6 py-3 font-medium text-action-on-primary focus:outline-none focus:ring-2 focus:ring-action focus:ring-offset-2"
          data-testid="failed-retry-cta"
        >
          {t('failed_cta')}
        </Link>
      )
    }
  };

  const c = config[variant];

  return (
    <StateCard
      variant={c.stateVariant}
      title={c.title}
      description={c.description}
      action={c.action}
      data-testid={`vouchers-${variant}-state`}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VouchersPage({
  params
}: VouchersPageProps): Promise<React.ReactElement> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.vouchers' });
  const customer = await retrieveCustomer();

  if (!customer) {
    redirect(`/${locale}/login`);
  }

  const result = await listCustomerVouchers();
  const routeStateInput =
    result.state === 'access_denied'
      ? { is_access_denied: true }
      : result.state === 'unavailable'
        ? { is_unavailable: true }
        : result.state === 'failed'
          ? { has_failed: true }
          : result.vouchers.length === 0
            ? { is_genuinely_empty: true }
            : { is_recovered: true };

  return (
    <AccountLayoutWithChrome
      locale={locale}
      activeSurface="W2-02"
      user={{
        id: customer.id,
        displayName: toDisplayName(customer) ?? customer.email,
        email: customer.email
      }}
      snapshotSections={[
        { id: 'vouchers', label: t('title'), value: String(result.vouchers.length) },
        { id: 'email', label: t('snapshot_email'), value: customer.email }
      ]}
      mainContent={
        <div className="space-y-6" data-testid="vouchers-page">
          <StorefrontRouteStateSignal
            route="user-vouchers"
            surface="user-vouchers"
            stateInput={routeStateInput}
          />
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="heading-md text-primary">{t('title')}</h1>
              <p className="text-sm text-secondary">{t('page_intro')}</p>
            </div>
            <Link
              href={`/${locale}/user/orders`}
              className="text-sm font-medium text-action"
              data-testid="orders-crosslink"
            >
              {t('orders_crosslink')}
            </Link>
          </div>

          {result.state === 'access_denied' && (
            <NamedState variant="access_denied" locale={locale} />
          )}

          {result.state === 'unavailable' && (
            <NamedState variant="unavailable" locale={locale} />
          )}

          {result.state === 'failed' && (
            <NamedState variant="failed" locale={locale} />
          )}

          {result.state === 'ok' && result.vouchers.length === 0 && (
            <StateCard
              variant="empty"
              title={t('empty.heading')}
              description={t('empty.body')}
              data-testid="vouchers-empty-state"
            />
          )}

          {result.state === 'ok' && result.vouchers.length > 0 && (
            <div
              className="grid gap-4 md:grid-cols-2"
              data-testid="vouchers-list"
              role="list"
              aria-label={t('title')}
            >
              {result.vouchers.map(voucher => (
                <div key={voucher.code} role="listitem">
                  <VoucherRow voucher={voucher} locale={locale} t={t} />
                </div>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
