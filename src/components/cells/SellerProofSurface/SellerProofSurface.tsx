/**
 * SellerProofSurface — BonBeauty DS seller credibility surface (UX-CMP-3).
 *
 * v1.7.0 Story 2.3: Shows salon/vendor identity, verification status,
 * proof points and rating/reviews.
 *
 * Three states (derived from data, NOT caller-settable):
 *   - `complete` — verification mark + proof points + rating/reviews
 *   - `partial` — renders available proof, explicitly marks missing categories
 *   - `unavailable` — "Salon nie udostępnił jeszcze pełnych informacji"
 *
 * IMPORTANT ANTI-PATTERN to avoid:
 *   - `partial` state must NOT silently omit missing proof — it must explicitly
 *     mark categories as missing (e.g. "Brak dostępnych opinii").
 *   - `unavailable` must NOT use "nieznany salon" or imply distrust.
 *     Tone: quiet hospitality, "nie udostępnił jeszcze" (UX-DR5).
 *   - Variant is DERIVED from data — callers cannot override it.
 *
 * ARCH-007: Customer-facing storefront only.
 *
 * Server component by default. Composes SellerInfo / VendorBadge molecules
 * as slots — does not parallel-fork seller display logic.
 */

import type { ReactNode } from 'react';

import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

import { MarketplaceVerificationMark } from '@/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark';
import { cn } from '@/lib/utils';
import { cleanText, deriveSellerProofVariant, type SellerProofVariant } from '@/lib/voucher/voucher-copy';

export interface SellerProofData {
  /** Seller name — if missing, state is `unavailable` */
  name: string | null | undefined;
  /** Seller handle for /sellers/[handle] link */
  handle: string | null | undefined;
  /** Seller photo URL (optional — initials fallback rendered by VendorBadge) */
  photoUrl?: string | null;
  /** Mercur seller.status (open/pending/suspended/terminated) */
  status?: 'pending_approval' | 'open' | 'suspended' | 'terminated' | null;
  /** Star rating (e.g. 4.7) — null if no ratings yet */
  rating?: number | null;
  /** Number of reviews */
  reviewCount?: number | null;
  /** City/address for proof point */
  city?: string | null;
  /** Address line for proof point */
  addressLine?: string | null;
}

export interface SellerProofSurfaceProps {
  seller: SellerProofData;
  /** Optional slot — renders full seller identity badge (VendorBadge/SellerInfo) */
  identitySlot?: ReactNode;
  /** Additional class names */
  className?: string;
  /** R22 fix: optional instance ID prefix — required when multiple
   *  SellerProofSurface instances render on the same page (e.g. PDP + Story 2.5
   *  confirmation recap). Defaults to a stable static prefix. */
  instanceId?: string;
}

/** Star icon — decorative, aria-hidden in all uses per AC2 + WCAG decorative image */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 1l1.8 3.6L14 5.5l-3 2.9.7 4.1L8 10.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9z" />
    </svg>
  );
}

/** Renders a single proof point row.
 *  F24 fix: missing-value aria-label routed through i18n key, not hardcoded PL. */
function ProofPoint({
  label,
  value,
  missing = false,
  missingAria,
}: {
  label: string;
  value: string | null | undefined;
  missing?: boolean;
  /** Pre-formatted aria-label for missing-state — supplied via t('missing_value_aria', { label }) */
  missingAria?: string;
}) {
  return (
    <div className="bb-card-muted space-y-0.5">
      <p className="label-sm text-secondary">{label}</p>
      {missing || !value ? (
        <p
          className="label-md text-secondary"
          // R9 fix: drop the `${label}` fallback — duplicating the visible
          // label as aria-label triggers double-announce on the wrapping <p>.
          // When the caller doesn't pass `missingAria`, the visible text alone
          // is sufficient.
          aria-label={missingAria}
        >
          {value || '—'}
        </p>
      ) : (
        <p className="label-md text-primary">{value}</p>
      )}
    </div>
  );
}

/**
 * SellerProofSurface — server component (default).
 * Variant is derived from seller data; callers cannot override it.
 */
export async function SellerProofSurface({
  seller,
  identitySlot,
  className,
  instanceId = 'seller-proof',
}: SellerProofSurfaceProps) {
  // QD-03 (CAP-3): locale rozstrzygnięte raz i użyte jawnie — również przez
  // `getTranslations`. Wcześniej ten sam fakt był czytany dwa razy: raz przez
  // `getLocale()`, raz niejawnie wewnątrz `getTranslations`.
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: 'seller.proof' });

  // R11 fix: format rating with locale-aware decimal separator. toFixed(1)
  // emits a period regardless of locale, which PL screen readers pronounce
  // as "kropka" instead of "przecinek". Use Intl.NumberFormat for correctness.
  const ratingFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const formatRating = (value: number): string => ratingFormatter.format(value);

  // F22 fix: defensive trim + control-char strip on user-supplied seller name
  // before threading through aria-labels. AT readers may mis-pronounce control
  // chars; also defensive against unusual vendor onboarding data.
  // R12 fix: hoisted to shared cleanText() so VoucherClaritySurface merchant
  // path applies the same sanitisation.
  const sellerNameClean = cleanText(seller.name) ?? '';
  const hasName = sellerNameClean.length > 0;
  // F3 fix: pending_approval is NOT verified — must not be labelled
  // "Zweryfikowany salon" (overstating trust per AC2). Only `open` sellers
  // get the verification label; everything else (pending_approval, suspended,
  // terminated, missing) gets the explicit "Weryfikacja w toku" label.
  const hasVerification = seller.status === 'open';
  const hasRating = typeof seller.rating === 'number' && seller.reviewCount != null;
  const hasReviews = hasRating && (seller.reviewCount ?? 0) > 0;
  const hasAddress = Boolean(seller.city || seller.addressLine);

  const variant: SellerProofVariant = deriveSellerProofVariant({
    hasName,
    hasVerificationStatus: hasVerification,
    hasRating: hasRating,
    hasReviews: hasReviews,
    hasAddress: hasAddress,
  });

  const headingId = `${instanceId}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn('bb-section-shell space-y-4', className)}
      data-testid="seller-proof-surface"
      data-variant={variant}
    >
      {/* ─── Heading (state-specific) ──────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <h2
          id={headingId}
          className="heading-sm text-primary"
          data-testid="seller-proof-heading"
        >
          {variant === 'complete' && t('heading_complete')}
          {variant === 'partial' && t('heading_partial')}
          {variant === 'unavailable' && t('heading_unavailable')}
        </h2>

        {/* MarketplaceVerificationMark — text label always present (UX-DR6 / AC2).
            F3 fix: pending verification gets the explicit "Weryfikacja w toku" label,
            never the misleading "Zweryfikowany salon" label.
            F5 fix: surface="page" drives token-bound styling — no `!important`
            overrides; data-testid is now an officially supported prop. */}
        <MarketplaceVerificationMark
          label={
            hasVerification
              ? t('verification_label')
              : t('verification_pending_label')
          }
          variant={variant === 'unavailable' ? 'compact' : 'default'}
          surface="page"
          className="self-start"
          data-testid="seller-proof-verification-mark"
        />
      </div>

      {/* ─── Unavailable state ─────────────────────────────────────────── */}
      {/* F21 fix: drop redundant role=region (parent <section aria-labelledby> already
          declares the landmark). F6 fix: use --accent token for focus ring. */}
      {variant === 'unavailable' && (
        <div
          className="space-y-3"
          data-testid="seller-proof-unavailable"
        >
          <p className="label-md text-secondary">
            {t('unavailable_body')}
          </p>
          {/* Exactly one recommended next action (UX-DR18) */}
          <Link
            href="/sellers"
            className="label-md inline-block font-medium underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            data-testid="seller-proof-next-action"
          >
            {t('unavailable_cta')}
          </Link>
        </div>
      )}

      {/* ─── Identity slot or fallback ────────────────────────────────── */}
      {(variant === 'complete' || variant === 'partial') && (
        <>
          {identitySlot ? (
            <div data-testid="seller-proof-identity">{identitySlot}</div>
          ) : sellerNameClean && seller.handle ? (
            <div data-testid="seller-proof-identity">
              <Link
                href={`/sellers/${seller.handle}`}
                className="label-md font-medium text-primary underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                aria-label={t('seller_link_aria', { name: sellerNameClean })}
              >
                {sellerNameClean}
              </Link>
            </div>
          ) : null}

          {/* ─── Partial-specific clarification (R19 fix: placed BEFORE the
              proof points grid so AT users get the context before scanning
              the missing-data tiles). R8 fix: dropped role="note" — plain <p>
              announces via reading order. R10 fix: copy reworded so the lead
              sentence differs from `unavailable_body`. */}
          {variant === 'partial' && (
            <p
              className="label-sm text-secondary"
              data-testid="seller-proof-partial-note"
            >
              {t('partial_note')}
            </p>
          )}

          {/* ─── Proof points grid ──────────────────────────────────── */}
          <div className="grid gap-3 sm:grid-cols-2" data-testid="seller-proof-points">
            {/* Rating proof point */}
            {hasReviews && hasRating ? (
              <div className="bb-card-muted space-y-1">
                <p className="label-sm text-secondary">{t('rating_label')}</p>
                {/* Accessible rating: numbers + text, stars are decorative */}
                <p
                  className="heading-sm text-primary flex items-center gap-1"
                  aria-label={t('rating_aria', {
                    rating: formatRating(seller.rating ?? 0),
                    count: seller.reviewCount ?? 0,
                  })}
                >
                  {/* R16 fix: tokenize star colour (was Tailwind text-yellow-500) */}
                  <StarIcon className="h-4 w-4 text-[color:var(--gold)]" />
                  <span>{formatRating(seller.rating ?? 0)}</span>
                  <span className="label-sm text-secondary font-normal">
                    ({seller.reviewCount})
                  </span>
                </p>
              </div>
            ) : (
              /* Partial: explicitly mark missing rating (not silently omit) */
              <div className="bb-card-muted space-y-0.5">
                <p className="label-sm text-secondary">{t('rating_label')}</p>
                <p
                  className="label-md text-secondary"
                  data-testid="seller-proof-missing-rating"
                  aria-label={t('missing_reviews_aria')}
                >
                  {t('missing_reviews_label')}
                </p>
              </div>
            )}

            {/* Address proof point */}
            {hasAddress ? (
              <ProofPoint
                label={t('address_label')}
                value={[seller.city, seller.addressLine].filter(Boolean).join(', ')}
              />
            ) : (
              /* Partial: explicitly mark missing address — F24 fix: i18n aria */
              <ProofPoint
                label={t('address_label')}
                value={t('missing_address_label')}
                missing
                missingAria={t('missing_value_aria', { label: t('address_label') })}
              />
            )}
          </div>

          {/* ─── Single recommended next action (UX-DR18: exactly one CTA) ───
              R1 fix: partial state gets a DISTINCT CTA label/aria from complete.
              R2 fix: when seller.handle is missing in partial/complete (rare but
              legitimate during onboarding), fall back to /sellers so we still
              surface exactly one next action — never zero. */}
          {seller.handle ? (
            <Link
              href={`/sellers/${seller.handle}`}
              className="label-md inline-block font-medium underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              // R13 fix: only interpolate {name} into aria-label when the
              // sanitized seller name is non-empty; otherwise the aria-label
              // is left undefined and AT falls back to the visible link text.
              aria-label={
                sellerNameClean
                  ? variant === 'partial'
                    ? t('partial_cta_aria', { name: sellerNameClean })
                    : t('seller_detail_link_aria', { name: sellerNameClean })
                  : undefined
              }
              data-testid={
                variant === 'partial'
                  ? 'seller-proof-partial-cta'
                  : 'seller-proof-detail-link'
              }
            >
              {variant === 'partial' ? t('partial_cta') : t('seller_detail_link')}
            </Link>
          ) : (
            <Link
              href="/sellers"
              className="label-md inline-block font-medium underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              data-testid="seller-proof-no-handle-fallback"
            >
              {t('no_handle_fallback_cta')}
            </Link>
          )}
        </>
      )}
    </section>
  );
}
