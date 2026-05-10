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

import { getTranslations } from 'next-intl/server';

import { MarketplaceVerificationMark } from '@/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark';
import { cn } from '@/lib/utils';
import { deriveSellerProofVariant, type SellerProofVariant } from '@/lib/voucher/voucher-copy';

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
}

/** Star icon — decorative, aria-hidden in all uses per AC2 + WCAG decorative image */
function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 1l1.8 3.6L14 5.5l-3 2.9.7 4.1L8 10.4l-3.7 2.1.7-4.1-3-2.9 4.2-.9z" />
    </svg>
  );
}

/** Renders a single proof point row */
function ProofPoint({
  label,
  value,
  missing = false,
}: {
  label: string;
  value: string | null | undefined;
  missing?: boolean;
}) {
  return (
    <div className="bb-card-muted space-y-0.5">
      <p className="label-sm text-secondary">{label}</p>
      {missing || !value ? (
        <p className="label-md text-secondary opacity-60" aria-label={`${label}: brak danych`}>
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
}: SellerProofSurfaceProps) {
  const t = await getTranslations('seller.proof');

  const hasName = Boolean(seller.name?.trim());
  const hasVerification =
    seller.status === 'open' ||
    seller.status === 'pending_approval';
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
  const verificationLabel =
    variant === 'unavailable'
      ? t('verification_pending_label')
      : t('verification_label');

  const headingId = 'seller-proof-heading';

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

        {/* MarketplaceVerificationMark — text label always present (UX-DR6 / AC2) */}
        <span
          className="self-start"
          data-testid="seller-proof-verification-mark"
          data-label={verificationLabel}
        >
          {MarketplaceVerificationMark({
            label: verificationLabel,
            variant: variant === 'unavailable' ? 'compact' : 'default',
            className:
              '!bg-[rgba(22,101,52,0.08)] !border-[rgba(22,101,52,0.2)] !text-[var(--color-trust,#15803d)] !backdrop-blur-0',
          })}
        </span>
      </div>

      {/* ─── Unavailable state ─────────────────────────────────────────── */}
      {variant === 'unavailable' && (
        <div
          role="region"
          aria-label={t('heading_unavailable')}
          className="space-y-3"
          data-testid="seller-proof-unavailable"
        >
          <p className="label-md text-secondary">
            {t('unavailable_body')}
          </p>
          {/* Exactly one recommended next action (UX-DR18) */}
          <a
            href="/sellers"
            className="label-md inline-block font-medium underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
            data-testid="seller-proof-next-action"
          >
            {t('unavailable_cta')}
          </a>
        </div>
      )}

      {/* ─── Identity slot or fallback ────────────────────────────────── */}
      {(variant === 'complete' || variant === 'partial') && (
        <>
          {identitySlot ? (
            <div data-testid="seller-proof-identity">{identitySlot}</div>
          ) : seller.name && seller.handle ? (
            <div data-testid="seller-proof-identity">
              <a
                href={`/sellers/${seller.handle}`}
                className="label-md font-medium text-primary underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
                aria-label={t('seller_link_aria', { name: seller.name })}
              >
                {seller.name}
              </a>
            </div>
          ) : null}

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
                    rating: (seller.rating ?? 0).toFixed(1),
                    count: seller.reviewCount ?? 0,
                  })}
                >
                  <StarIcon className="h-4 w-4 text-yellow-500" />
                  <span>{(seller.rating ?? 0).toFixed(1)}</span>
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
                  className="label-md text-secondary opacity-60"
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
              /* Partial: explicitly mark missing address */
              <ProofPoint
                label={t('address_label')}
                value={t('missing_address_label')}
                missing
              />
            )}
          </div>

          {/* ─── Partial-specific clarification (not silently a complete state) */}
          {variant === 'partial' && (
            <p
              className="label-sm text-secondary"
              role="note"
              data-testid="seller-proof-partial-note"
            >
              {t('partial_note')}
            </p>
          )}

          {/* ─── Link to seller detail (one action, non-blocking) ───────── */}
          {seller.handle && (
            <a
              href={`/sellers/${seller.handle}`}
              className="label-md inline-block font-medium underline underline-offset-2 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring,#2563eb)]"
              aria-label={t('seller_detail_link_aria', { name: seller.name ?? '' })}
              data-testid="seller-proof-detail-link"
            >
              {t('seller_detail_link')}
            </a>
          )}
        </>
      )}
    </section>
  );
}
