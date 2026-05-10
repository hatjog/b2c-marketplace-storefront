/**
 * VoucherClaritySurface — BonBeauty DS voucher information surface (UX-CMP-2).
 *
 * v1.7.0 Story 2.3: PDP voucher clarity — price, voucher value, validity,
 * realization rules, refund/cancellation info, merchant identity and next action.
 *
 * Variants:
 *   - `default` — all information present; normal purchase flow
 *   - `condensed` — for cart summary and checkout review (Stories 2.4/2.5)
 *   - `warning` — warning/pending state (e.g. vendor unavailable, region-restricted)
 *   - `error` — error/recovery state (e.g. voucher expired, unavailable)
 *
 * ARCH-007: Customer-facing storefront only. Do NOT import from admin/vendor/CLI.
 *
 * Server component by default. Client-interactive sub-pieces (accordion toggle)
 * are wrapped in separate 'use client' components below.
 *
 * Handoff for Stories 2.4 / 2.5 / 2.6:
 *   - Import VoucherClaritySurface and pass `variant="condensed"` for cart/checkout summary.
 *   - Pass `variant="warning"` or `variant="error"` for payment-pending / recovery states.
 *   - The `status` prop carries the specific message and single next action for non-default states.
 */

import type { ReactNode } from 'react';

import { getTranslations } from 'next-intl/server';

import { CalendarIcon } from '@/icons';
import { cn } from '@/lib/utils';
import { REFUND_HELP_ANCHOR, VOUCHER_HELP_HREF } from '@/lib/voucher/voucher-copy';

export type VoucherClarityVariantProp = 'default' | 'condensed' | 'warning' | 'error';

export type VoucherClarityStatus = {
  kind: 'pending' | 'unavailable' | 'expired' | 'recovery';
  /** Human-readable status message — never a raw API error or variant code. */
  message: string;
  /** Exactly one recommended next action per UX-DR18. */
  nextAction?: {
    href?: string;
    label: string;
    onClick?: string; // Serializable reference only — client interactions wired via wrapper
  };
};

export type RealizationRule = {
  /** Short rule text — rendered as list item */
  text: string;
};

export interface VoucherClaritySurfaceProps {
  /** Product/voucher title */
  title: string;
  /** Price display string (already formatted, e.g. "250,00 zł") */
  price?: string | null;
  /** Voucher face value if different from price (e.g. "Voucher 300 zł") */
  voucherValue?: string | null;
  /** Validity wording — from product metadata or market config */
  validityWording?: string | null;
  /** Realization rules — rendered as semantic list */
  realizationRules?: RealizationRule[];
  /** Refund/cancellation info or link */
  refundCancellationInfo?: string | null;
  /** Merchant name for identity cue */
  merchantName?: string | null;
  /** Merchant handle for /sellers/[handle] link */
  merchantHandle?: string | null;
  /** Surface variant */
  variant?: VoucherClarityVariantProp;
  /** Status for non-default variants */
  status?: VoucherClarityStatus;
  /** Additional class names */
  className?: string;
  /** Slot: renders the merchant identity badge (VendorBadge or similar) */
  merchantSlot?: ReactNode;
  /** Slot: renders the primary CTA (add-to-cart button from ProductDetailsHeader) */
  ctaSlot?: ReactNode;
}

/** Status icon for non-default variants — inline SVG, no external deps. */
function StatusIcon({
  kind,
  className,
}: {
  kind: VoucherClarityStatus['kind'];
  className?: string;
}) {
  // warning/pending: clock-like icon
  if (kind === 'pending' || kind === 'unavailable') {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className={className}
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }
  // error/recovery: exclamation icon
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M8 1.5L1.5 13h13L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="8" cy="11.5" r="0.7" fill="currentColor" />
    </svg>
  );
}

/**
 * VoucherClaritySurface — server component (default).
 * Client-interactive sub-pieces (expandable rules) must be wrapped separately.
 */
export async function VoucherClaritySurface({
  title,
  price,
  voucherValue,
  validityWording,
  realizationRules = [],
  refundCancellationInfo,
  merchantName,
  merchantHandle,
  variant = 'default',
  status,
  className,
  merchantSlot,
  ctaSlot,
}: VoucherClaritySurfaceProps) {
  const t = await getTranslations('voucher.clarity');

  const isNonDefault = variant === 'warning' || variant === 'error';
  const isCondensed = variant === 'condensed';

  // Surface-level classes driven by variant
  const surfaceClass = cn(
    'bb-section-shell space-y-4',
    variant === 'warning' && 'border-[rgba(202,138,4,0.25)] bg-[rgba(254,249,195,0.4)]',
    variant === 'error' && 'border-[rgba(185,28,28,0.2)] bg-[rgba(254,226,226,0.35)]',
    className,
  );

  return (
    <section
      aria-labelledby="voucher-clarity-heading"
      className={surfaceClass}
      data-testid="voucher-clarity-surface"
      data-variant={variant}
    >
      {/* ─── Status banner for non-default variants ─────────────────────── */}
      {isNonDefault && status && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            'flex items-start gap-2 rounded-md px-3 py-2',
            variant === 'warning'
              ? 'bg-yellow-50 text-yellow-800'
              : 'bg-red-50 text-red-800',
          )}
          data-testid="voucher-clarity-status-banner"
        >
          <StatusIcon kind={status.kind} className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="label-md font-medium">{status.message}</p>
            {status.nextAction && (
              <>
                {status.nextAction.href ? (
                  <a
                    href={status.nextAction.href}
                    className="label-sm underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
                    data-testid="voucher-clarity-next-action"
                  >
                    {status.nextAction.label}
                  </a>
                ) : (
                  <span
                    className="label-sm"
                    data-testid="voucher-clarity-next-action"
                  >
                    {status.nextAction.label}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── Heading ─────────────────────────────────────────────────────── */}
      <h2
        id="voucher-clarity-heading"
        className={cn(
          'heading-sm text-primary',
          isNonDefault && 'opacity-80',
        )}
      >
        {title}
      </h2>

      {/* ─── Price + Voucher value ────────────────────────────────────────── */}
      {(price || voucherValue) && (
        <div className="flex flex-wrap items-baseline gap-2" data-testid="voucher-clarity-price">
          {price && (
            <span className="heading-md text-primary font-semibold">{price}</span>
          )}
          {voucherValue && voucherValue !== price && (
            <span className="label-md text-secondary">{voucherValue}</span>
          )}
        </div>
      )}

      {/* ─── Validity ────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2" data-testid="voucher-clarity-validity">
        <CalendarIcon size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-secondary" />
        <div className="min-w-0 flex-1">
          {validityWording ? (
            <p className="label-md text-primary">{validityWording}</p>
          ) : (
            <p className="label-md text-secondary">
              {t('validity_to_confirm')}{' '}
              <a
                href={VOUCHER_HELP_HREF}
                className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
              >
                {t('validity_help_link')}
              </a>
            </p>
          )}
        </div>
      </div>

      {/* ─── Realization rules (semantic list) ───────────────────────────── */}
      {!isCondensed && realizationRules.length > 0 && (
        <div data-testid="voucher-clarity-rules">
          <p className="label-sm mb-2 text-secondary">{t('realization_rules_label')}</p>
          <ul
            aria-label={t('realization_rules_label')}
            className="space-y-1"
          >
            {realizationRules.map((rule, i) => (
              <li
                key={i}
                className="label-md flex items-start gap-2 text-primary"
              >
                <span className="mt-0.5 text-[var(--color-trust,#16a34a)]" aria-hidden="true">
                  ✓
                </span>
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ─── Refund / cancellation ───────────────────────────────────────── */}
      {!isCondensed && (
        <div className="flex items-start gap-2" data-testid="voucher-clarity-refund">
          <div className="min-w-0 flex-1">
            {refundCancellationInfo ? (
              <p className="label-md text-primary">{refundCancellationInfo}</p>
            ) : (
              <p className="label-md text-secondary">
                {t('refund_policy_label')}{' '}
                <a
                  href={REFUND_HELP_ANCHOR}
                  className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
                >
                  {t('refund_policy_link')}
                </a>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ─── Merchant identity cue ───────────────────────────────────────── */}
      {merchantSlot ? (
        <div data-testid="voucher-clarity-merchant">{merchantSlot}</div>
      ) : merchantName && merchantHandle ? (
        <div data-testid="voucher-clarity-merchant">
          <p className="label-sm text-secondary">{t('merchant_label')}</p>
          <a
            href={`/sellers/${merchantHandle}`}
            className="label-md font-medium text-primary underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
            aria-label={t('merchant_link_aria', { name: merchantName })}
          >
            {merchantName}
          </a>
        </div>
      ) : null}

      {/* ─── CTA slot (single next action for PDP; one CTA only) ─────────── */}
      {ctaSlot && (
        <div data-testid="voucher-clarity-cta">{ctaSlot}</div>
      )}
    </section>
  );
}
