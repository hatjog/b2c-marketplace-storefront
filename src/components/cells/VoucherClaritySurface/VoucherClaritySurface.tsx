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

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { CalendarIcon } from '@/icons';
import { cn } from '@/lib/utils';
import { REFUND_HELP_ANCHOR, VOUCHER_HELP_HREF } from '@/lib/voucher/voucher-copy';

export type VoucherClarityVariantProp = 'default' | 'condensed' | 'warning' | 'error';

export type VoucherClarityStatus = {
  kind: 'pending' | 'unavailable' | 'expired' | 'recovery';
  /** Human-readable status message — never a raw API error or variant code. */
  message: string;
  /** Exactly one recommended next action per UX-DR18.
   *  F11 fix: dropped `onClick: string` — strings are not React event handlers,
   *  and functions cannot cross the server-component boundary. Client interaction
   *  is wired by wrapping <VoucherClaritySurface> in a 'use client' component
   *  that intercepts the rendered <Link>/<a> by data-testid; Stories 2.4/2.5/2.6
   *  add their own client wrappers without needing this hook. */
  nextAction?: {
    href?: string;
    label: string;
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

  // Surface-level classes driven by variant.
  // F6 fix: tokenized warning/error surfaces (--color-warning, --color-error,
  // --bb-icon-bg-error / unavailable from bb-surfaces.css). No raw rgba literals.
  // F20 fix: condensed gets a tighter card variant — lighter shell for cart row reuse.
  const surfaceClass = cn(
    variant === 'condensed' ? 'bb-card-muted space-y-3' : 'bb-section-shell space-y-4',
    variant === 'warning' &&
      'border-[var(--bb-icon-bg-unavailable)] bg-[var(--bb-icon-bg-unavailable)]',
    variant === 'error' &&
      'border-[var(--bb-icon-bg-error)] bg-[var(--bb-icon-bg-error)]',
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
      {/* F17 fix: drop redundant aria-live (role=status implies it).
          F6 fix: tokenized status colors via CSS variables (--color-warning,
          --color-error, --bb-icon-bg-* from bb-surfaces.css). */}
      {isNonDefault && status && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-2 rounded-md px-3 py-2',
            variant === 'warning'
              ? 'bg-[var(--bb-icon-bg-unavailable)] text-[color:var(--color-warning)]'
              : 'bg-[var(--bb-icon-bg-error)] text-[color:var(--color-error)]',
          )}
          data-testid="voucher-clarity-status-banner"
        >
          <StatusIcon kind={status.kind} className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="label-md font-medium">{status.message}</p>
            {status.nextAction && (
              <>
                {status.nextAction.href ? (
                  <Link
                    href={status.nextAction.href}
                    className="label-sm underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                    data-testid="voucher-clarity-next-action"
                  >
                    {status.nextAction.label}
                  </Link>
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
      {/* F13 fix: condensed variant suppresses the validity-help fallback link
          (cart/checkout summary should not surface help links — Story 2.4 owns
          its own validity helper). When condensed + missing validity, render
          plain status text only. */}
      <div className="flex items-start gap-2" data-testid="voucher-clarity-validity">
        <CalendarIcon size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-secondary" />
        <div className="min-w-0 flex-1">
          {validityWording ? (
            <p className="label-md text-primary">{validityWording}</p>
          ) : isCondensed ? (
            <p className="label-md text-secondary">{t('validity_to_confirm')}</p>
          ) : (
            <p className="label-md text-secondary">
              {t('validity_to_confirm')}{' '}
              <Link
                href={VOUCHER_HELP_HREF}
                className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              >
                {t('validity_help_link')}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* ─── Realization rules (semantic list) ───────────────────────────── */}
      {/* F23 fix: aria-labelledby on <ul> references the caption <p> (no duplicate label).
          F6 fix: trust check icon uses tokenized text-trust class, no hex fallback. */}
      {!isCondensed && realizationRules.length > 0 && (
        <div data-testid="voucher-clarity-rules">
          <p id="voucher-clarity-rules-label" className="label-sm mb-2 text-secondary">
            {t('realization_rules_label')}
          </p>
          <ul aria-labelledby="voucher-clarity-rules-label" className="space-y-1">
            {realizationRules.map((rule, i) => (
              <li
                key={i}
                className="label-md flex items-start gap-2 text-primary"
              >
                <span className="mt-0.5 text-trust" aria-hidden="true">
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
                <Link
                  href={REFUND_HELP_ANCHOR}
                  className="underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                >
                  {t('refund_policy_link')}
                </Link>
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
          <Link
            href={`/sellers/${merchantHandle}`}
            className="label-md font-medium text-primary underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            aria-label={t('merchant_link_aria', { name: merchantName })}
          >
            {merchantName}
          </Link>
        </div>
      ) : null}

      {/* ─── CTA slot (single next action for PDP; one CTA only) ─────────── */}
      {ctaSlot && (
        <div data-testid="voucher-clarity-cta">{ctaSlot}</div>
      )}
    </section>
  );
}
