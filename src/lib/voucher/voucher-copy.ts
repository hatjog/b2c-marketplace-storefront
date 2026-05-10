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

/** Canonical legal/help anchor — Story 2.9 owns the content; we reference it. */
export const REFUND_HELP_ANCHOR = '/zasady#zwroty' as const;

/** Canonical help page href for voucher FAQs. */
export const VOUCHER_HELP_HREF = '/zasady' as const;

/**
 * Formats a voucher price from minor units (grosz) to display string.
 * Uses Intl.NumberFormat for locale-aware formatting.
 *
 * @param amountInMinorUnits — integer amount in minor currency units (e.g. 5000 = 50 PLN)
 * @param currencyCode — ISO 4217 currency code (e.g. "PLN", "EUR")
 * @param locale — BCP 47 locale (e.g. "pl", "en")
 * @returns formatted string (e.g. "50,00 zł" for pl/PLN)
 */
export function formatVoucherPrice(
  amountInMinorUnits: number,
  currencyCode: string,
  locale: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amountInMinorUnits / 100);
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
 * Derives the VoucherClaritySurface variant from product availability state.
 *
 * Used by ProductDetails to determine which variant to pass to VoucherClaritySurface.
 * Cart (Story 2.4), checkout (Story 2.4) and recovery (Story 2.6) should also use this
 * helper for consistent state derivation.
 *
 * @param hasPrice — true if any variant has a calculated_price
 * @param isOutOfStock — true if selected variant has no inventory
 * @param isRegionRestricted — true if product is not purchasable in the current region
 * @param isVendorUnavailable — true when no active vendor offers exist (Story 5.6)
 * @param isExpiredInCatalog — true if the voucher is marked as expired in catalog
 */
export type VoucherClarityVariant = 'default' | 'condensed' | 'warning' | 'error';

export function deriveVoucherClarityVariant(params: {
  hasPrice: boolean;
  isOutOfStock?: boolean;
  isRegionRestricted?: boolean;
  isVendorUnavailable?: boolean;
  isExpiredInCatalog?: boolean;
}): VoucherClarityVariant {
  const { hasPrice, isOutOfStock, isRegionRestricted, isVendorUnavailable, isExpiredInCatalog } =
    params;

  if (isExpiredInCatalog) return 'error';
  if (!hasPrice) return 'error';
  if (isVendorUnavailable) return 'warning';
  if (isRegionRestricted) return 'warning';
  if (isOutOfStock) return 'warning';

  return 'default';
}

/**
 * Derives the SellerProofSurface variant from seller data completeness.
 *
 * IMPORTANT: Callers MUST NOT override this — the variant must always derive
 * from the actual data to avoid overstating trust (AC2, anti-pattern in story spec).
 */
export type SellerProofVariant = 'complete' | 'partial' | 'unavailable';

export function deriveSellerProofVariant(params: {
  hasName: boolean;
  hasVerificationStatus: boolean;
  hasRating: boolean | null;
  hasReviews: boolean | null;
  hasAddress: boolean | null;
}): SellerProofVariant {
  const { hasName, hasVerificationStatus, hasRating, hasReviews } = params;

  if (!hasName) return 'unavailable';

  // complete = verification + at least some social proof (rating or reviews)
  if (hasVerificationStatus && (hasRating || hasReviews)) return 'complete';

  // partial = has name and either verification OR some proof points but not both
  if (hasName) return 'partial';

  return 'unavailable';
}
