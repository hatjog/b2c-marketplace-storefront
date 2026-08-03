import { toIntlLocale } from '@/lib/helpers/hreflang';
import { convertToLocale } from '@/lib/helpers/money';

/**
 * voucher-copy.ts — Shared voucher copy and formatting helpers.
 *
 * v1.7.0 Story 2.3 (PDP): Establishes the single source of truth for
 * voucher price formatting, validity wording, and refund/cancellation copy.
 * Stories 2.4 (cart/checkout), 2.5 (confirmation) and 2.6 (recovery) MUST
 * consume this module rather than re-deriving their own copies — per the
 * Story 2.3 handoff documented in Dev Notes.
 *
 * ARCH-007: Pure computation helpers (no JSX, no UI). Safe to import from
 * both server and client components.
 *
 * Handoff for Story 2.4 / 2.5 / 2.6:
 *   - formatVoucherPrice: use for cart line item and checkout review price display.
 *   - resolveValidityWording: use for checkout review and confirmation validity text.
 *   - REFUND_HELP_ANCHOR: use as the canonical href pointing at the legal/help anchor
 *     (Story 2.9 owns the legal copy; this is a stable reference).
 */

/**
 * Defensively normalise user-supplied text (e.g. seller names, merchant names)
 * before threading through aria-labels or visible JSX.
 *
 * - Strips C0 control characters (\x00..\x1F) and DEL (\x7F) which AT readers
 *   may mis-pronounce or which would inject invisible whitespace.
 * - Trims surrounding whitespace.
 * - Returns null when the input is null/undefined/empty after sanitisation —
 *   callers can fall back to placeholder copy.
 *
 * Re-review R12 fix: hoisted from SellerProofSurface inline regex so the
 * VoucherClaritySurface merchant-link aria path uses the same sanitiser.
 */
export function cleanText(input: string | null | undefined): string | null {
  if (typeof input !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = input.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/** Canonical legal/help anchor — Story 2.9 owns the content; we reference it.
 *  These constants are RELATIVE (no locale prefix) — Next.js next-intl
 *  middleware will rewrite them to the active locale at request time when
 *  used inside a localised route. For explicit locale-prefixed builds use
 *  `voucherHelpHref(locale)` / `refundHelpAnchor(locale)` instead.
 *  F26 fix: documented and exposed locale-aware variants for cart/checkout/
 *  recovery surfaces (Stories 2.4/2.5/2.6) that need explicit prefixes. */
export const REFUND_HELP_ANCHOR = '/zasady#zwroty' as const;

/** Canonical help page href for voucher FAQs. */
export const VOUCHER_HELP_HREF = '/zasady' as const;

/** Returns the voucher help href explicitly prefixed with the active locale. */
export function voucherHelpHref(locale: string): string {
  return `/${locale}${VOUCHER_HELP_HREF}`;
}

/** Returns the refund help anchor explicitly prefixed with the active locale. */
export function refundHelpAnchor(locale: string): string {
  return `/${locale}${REFUND_HELP_ANCHOR}`;
}

/**
 * Formats a voucher price from minor units (grosz) to display string.
 * Uses Intl.NumberFormat for locale-aware formatting.
 *
 * @param amountInMinorUnits — integer amount in minor currency units (e.g. 5000 = 50 PLN)
 * @param currencyCode — ISO 4217 currency code (e.g. "PLN", "EUR")
 * @param locale — storefront locale or BCP 47 locale (e.g. "pl", "en", "ua", "de")
 * @returns formatted string (e.g. "50,00 zł" for pl/PLN)
 */
export function formatVoucherPrice(
  amountInMinorUnits: number,
  currencyCode: string,
  locale: string,
): string {
  try {
    return convertToLocale({
      amount: amountInMinorUnits,
      currency_code: currencyCode,
      locale: toIntlLocale(locale),
      isMinorUnit: true,
    });
  } catch {
    // Fallback for unsupported locale/currency combos
    return `${(amountInMinorUnits / 100).toFixed(2)} ${currencyCode}`;
  }
}

/**
 * Resolves validity wording from product metadata and market config.
 *
 * Priority: gpMetaValidityPeriod (product-level) > marketDefaultValidityInfo (market-level).
 * When both are absent, returns null (caller should show "Validity to be confirmed" state).
 *
 * @param gpMetaValidityPeriod — validity_period from product.metadata.gp
 * @param marketDefaultValidityInfo — default_validity_info from market runtime config
 */
export function resolveValidityWording(
  gpMetaValidityPeriod: string | null | undefined,
  marketDefaultValidityInfo: string | null | undefined,
): string | null {
  if (gpMetaValidityPeriod?.trim()) return gpMetaValidityPeriod.trim();
  if (marketDefaultValidityInfo?.trim()) return marketDefaultValidityInfo.trim();
  return null;
}

/**
 * VoucherClaritySurface variant.
 *
 * F15 fix: split into a base helper (deriveVoucherClarityVariant — usable
 * by Stories 2.4 cart/checkout, 2.5 confirmation, 2.6 recovery) and a
 * PDP-flavoured wrapper (derivePdpVoucherClarityVariant) that adds
 * PDP-specific signals (out-of-stock, region-restricted, vendor-unavailable).
 *
 * Cart/checkout/recovery do NOT see vendor offers or PDP variant inventory
 * directly — they see line items and order state — so the PDP-flavoured
 * input shape would force them to pass dummy values forever.
 */
export type VoucherClarityVariant = 'default' | 'condensed' | 'warning' | 'error';

/** Base derivation — usable from cart, checkout, confirmation, recovery.
 *  Inputs are the minimum a downstream surface ever sees. */
export function deriveVoucherClarityVariant(params: {
  hasPrice: boolean;
  isExpiredInCatalog?: boolean;
}): VoucherClarityVariant {
  const { hasPrice, isExpiredInCatalog } = params;
  if (isExpiredInCatalog) return 'error';
  if (!hasPrice) return 'error';
  return 'default';
}

/** PDP-flavoured wrapper: adds PDP-only signals (vendor unavailable, region
 *  restricted, out of stock). Stories 2.4/2.5/2.6 should NOT depend on these. */
export function derivePdpVoucherClarityVariant(params: {
  hasPrice: boolean;
  isOutOfStock?: boolean;
  isRegionRestricted?: boolean;
  isVendorUnavailable?: boolean;
  isExpiredInCatalog?: boolean;
}): VoucherClarityVariant {
  const base = deriveVoucherClarityVariant({
    hasPrice: params.hasPrice,
    isExpiredInCatalog: params.isExpiredInCatalog,
  });
  if (base === 'error') return 'error';
  if (params.isVendorUnavailable) return 'warning';
  if (params.isRegionRestricted) return 'warning';
  if (params.isOutOfStock) return 'warning';
  return base;
}

/**
 * Derives the SellerProofSurface variant from seller data completeness.
 *
 * IMPORTANT: Callers MUST NOT override this — the variant must always derive
 * from the actual data to avoid overstating trust (AC2, anti-pattern in story spec).
 *
 * F10 fix: removed the unreachable trailing `return 'unavailable'` (after
 * `if (hasName)` always returns); `hasAddress` is no longer accepted (was
 * unused in the prior version) — callers should pass it via the surface but
 * not as a derivation signal. `hasRating`/`hasReviews` allow null for callers
 * that don't have rating data yet.
 */
export type SellerProofVariant = 'complete' | 'partial' | 'unavailable';

export function deriveSellerProofVariant(params: {
  hasName: boolean;
  hasVerificationStatus: boolean;
  hasRating: boolean | null;
  hasReviews: boolean | null;
  /** Accepted for API stability with the surface but not used for derivation —
   *  address presence is a partial-proof point, not a complete-state gate. */
  hasAddress?: boolean | null;
}): SellerProofVariant {
  const { hasName, hasVerificationStatus, hasRating, hasReviews } = params;

  if (!hasName) return 'unavailable';

  // complete = verification + at least some social proof (rating or reviews)
  if (hasVerificationStatus && (hasRating || hasReviews)) return 'complete';

  // Otherwise (name present, missing verification OR missing proof) → partial.
  return 'partial';
}
