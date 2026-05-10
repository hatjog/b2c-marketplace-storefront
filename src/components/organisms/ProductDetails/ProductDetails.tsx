/**
 * ProductDetails organism — PDP detail column composition.
 *
 * v1.7.0 Story 2.3: Retrofits PDP to use VoucherClaritySurface (UX-CMP-2)
 * and SellerProofSurface (UX-CMP-3) in place of the ad-hoc
 * TrustSignals + VoucherValidityInfo two-column block and ProductDetailsSeller.
 *
 * Retrofit approach (NOT a rewrite):
 *   - ProductDetailsPage two-column grid preserved
 *   - ProductDetails organism composition order preserved
 *   - Story 5.x multi-vendor pricing dispatch (NoActiveVendorsFallback /
 *     SoleVendorBadge / SellerSelectorCartBridge) preserved unchanged
 *   - VendorBadge is now consumed as the identitySlot inside SellerProofSurface
 *   - TrustSignals + VoucherValidityInfo are consumed as slots inside VoucherClaritySurface
 *   - ProductDetailsSeller is replaced by SellerProofSurface (composes SellerInfo inside)
 *
 * Variant state machine (T4 — state-change consistency):
 *   VoucherClaritySurface variant is derived from product availability state
 *   via deriveVoucherClarityVariant() from voucher-copy.ts (single source of truth
 *   for downstream Stories 2.4/2.5/2.6).
 *
 * cleanup-12f: flag check moved to async function body (lazy eval) to avoid
 * Turbopack module-evaluation order issue with barrel imports (TDZ ReferenceError).
 *
 * TF-75 (cleanup-32 synthesis): single helper getCurrentFlagValue() from
 * @/lib/security/flagAtomicCheck invoked at render-time.
 */

import type { HttpTypes } from '@medusajs/types';

import { getTranslations } from 'next-intl/server';

import {
  ProductAdditionalAttributes,
  ProductDetailsFooter,
  ProductDetailsHeader,
  ProductDetailsShipping,
  ProductPageDetails,
  VoucherClaritySurface,
  SellerProofSurface,
} from '@/components/cells';
import { VendorBadge } from '@/components/molecules/VendorBadge';
import {
  NoActiveVendorsFallback,
  SellerSelectorCartBridge,
  SoleVendorBadge,
} from '@/components/cells/SellerSelector';
// F9 fix: TrustSignals + VoucherValidityInfo were imported but never used after
// the Story 2.3 retrofit (VoucherClaritySurface now owns those concerns).
// Story Dev Notes had claimed they were "consumed as slots inside VoucherClaritySurface"
// but in fact the new surface fully replaces them. Imports removed.
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpMetadata } from '@/lib/helpers/metadata-utils';
import { resolveDefaultValidityInfo, resolvePdpTrustSignals } from '@/lib/runtime-market-config';
import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import {
  cleanText,
  derivePdpVoucherClarityVariant,
  resolveValidityWording,
  type VoucherClarityVariant,
} from '@/lib/voucher/voucher-copy';
import type {
  AdditionalAttributeProps,
  GpProductMetadata,
  MultiVendorPricingFields,
} from '@/types/product';
import type { SellerProps } from '@/types/seller';
import type { Wishlist } from '@/types/wishlist';

/**
 * Story 5.2 — multi-vendor pricing feature flag (re-uses single flag
 * introduced in Story 5.1 ProductCard.tsx). Single flag governs both
 * PLP badge + PDP selector for coherent Phase B flip (story 8.3).
 * Default OFF (`'false'`) → selector hidden across whole app.
 *
 * cleanup-12f: flag check moved to async function body (lazy eval) to avoid
 * Turbopack module-evaluation order issue with barrel imports (TDZ ReferenceError).
 *
 * TF-75 (cleanup-32 synthesis): single helper `getCurrentFlagValue()` from
 * `@/lib/security/flagAtomicCheck` invoked at render-time (preserves
 * cleanup-12f TDZ-safe body-scoped pattern).
 */

export const ProductDetails = async ({
  product,
  locale
}: {
  product: HttpTypes.StoreProduct & {
    seller?: SellerProps;
    attribute_values?: AdditionalAttributeProps[];
  };
  locale: string;
}) => {
  const user = await retrieveCustomer();

  const countryCode = await getCountryCode(locale);
  let wishlist: Wishlist = { products: [] };
  if (user) {
    wishlist = await getUserWishlists({ countryCode });
  }

  const marketId = getMarketId();
  const [trustSignals, defaultValidityInfo] = await Promise.all([
    resolvePdpTrustSignals(marketId),
    resolveDefaultValidityInfo(marketId),
  ]);

  const gpMeta = getGpMetadata<GpProductMetadata>(product.metadata as Record<string, unknown>);
  const validityPeriod = gpMeta?.validity_period ?? null;

  // cleanup-12c AC1/AC2/AC3/AC4 — explicit 4-branch vendor_offers dispatch.
  // vendorOfferCount === -1  → undefined / not an array (flag OFF or pre-Phase-B)
  // vendorOfferCount === 0   → empty array → showNoActiveVendorsFallback (Story 5.6)
  // vendorOfferCount === 1   → showSoleVendorBadge (closes audit F4 silent length===1 fall-through)
  // vendorOfferCount >= 2    → showSellerSelector (Story 5.2 / 5.3 / 5.5)
  const vendorOffers =
    (product as unknown as MultiVendorPricingFields).vendor_offers ?? undefined;
  const vendorOfferCount = Array.isArray(vendorOffers) ? vendorOffers.length : -1;
  // cleanup-12f + TF-75: evaluate flag inside function body via single helper.
  const MULTI_VENDOR_PRICING_ENABLED = getCurrentFlagValue();
  const showSellerSelector = MULTI_VENDOR_PRICING_ENABLED && vendorOfferCount >= 2;
  const showSoleVendorBadge = MULTI_VENDOR_PRICING_ENABLED && vendorOfferCount === 1;
  // Story 5.6 — sibling branch dla `length === 0` empty-state path. Defensive
  // `Array.isArray()` guard zapobiega cross-contamination z undefined case
  // (undefined → fallthrough do default Medusa flow; flag OFF default w v1.6.0).
  const showNoActiveVendorsFallback = MULTI_VENDOR_PRICING_ENABLED && vendorOfferCount === 0;

  // ── Story 2.3: Derive VoucherClaritySurface variant from product state ──
  // T4: state-change consistency — variant drives the surface display,
  // not ad-hoc inline conditions scattered through JSX.
  // F16 fix: getProductPrice throws on missing product.id — guard so PDP
  // degrades to error variant instead of bubbling 500 to error.tsx (UX-DR18).
  // R18 fix: log the swallowed throw to the server console so silent
  // degradation does not hide upstream bugs (customer never sees the log).
  // R7 fix: also capture the formatted price string so VoucherClaritySurface
  // can render its own price slot (AC1 "voucher value visible"). Previously the
  // price prop was always undefined and the surface skipped its price block.
  let hasPrice = false;
  let cheapestVariantInventory: number | null = null;
  let voucherPriceDisplay: string | null = null;
  try {
    const { cheapestVariant, cheapestPrice } = getProductPrice({ product });
    hasPrice = cheapestVariant !== null && !!cheapestVariant.calculated_price;
    if (cheapestVariant && typeof (cheapestVariant as { inventory_quantity?: number }).inventory_quantity === 'number') {
      cheapestVariantInventory = (cheapestVariant as { inventory_quantity?: number }).inventory_quantity ?? null;
    }
    if (cheapestPrice && typeof cheapestPrice.calculated_price === 'string') {
      voucherPriceDisplay = cheapestPrice.calculated_price;
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ProductDetails] getProductPrice threw — falling back to error variant', e);
    hasPrice = false;
  }

  // R6 fix: AC3 explicit signals — wire isOutOfStock from product variant data
  // and isExpiredInCatalog from product status (Medusa lifecycle field).
  // The PDP helper now exercises all three PDP-only signals it advertises.
  const isOutOfStock = cheapestVariantInventory === 0;
  const isExpiredInCatalog =
    typeof product.status === 'string' && product.status !== 'published';

  const voucherVariant: VoucherClarityVariant = derivePdpVoucherClarityVariant({
    hasPrice,
    isVendorUnavailable: showNoActiveVendorsFallback,
    isOutOfStock,
    isExpiredInCatalog,
  });

  // F2 fix: status messages + next-action labels routed through next-intl
  // instead of hardcoded PL literals (anti-pattern).
  // R5 fix: i18n keys renamed status_*_heading → status_*_message — the surface
  // renders this string as flow text inside <div role="status">, not as a
  // heading, so the semantic name now matches the render path.
  // R6 fix: error branch now uses the `expired` message key matching its kind
  // (was mismatched: kind=expired + message=status_unavailable_*).
  const tVoucher = await getTranslations('voucher.clarity');
  const voucherStatus =
    voucherVariant === 'warning'
      ? {
          kind: 'unavailable' as const,
          message: tVoucher('status_pending_message'),
          nextAction: {
            href: `/${locale}/categories`,
            label: tVoucher('next_action_back_to_list'),
          },
        }
      : voucherVariant === 'error'
        ? {
            kind: 'expired' as const,
            message: tVoucher('status_expired_message'),
            nextAction: {
              href: `/${locale}/categories`,
              label: tVoucher('next_action_back_to_list'),
            },
          }
        : undefined;

  // Resolve validity wording from voucher-copy.ts (shared with Stories 2.4/2.5/2.6)
  const validityWording = resolveValidityWording(validityPeriod, defaultValidityInfo);

  // Realization rules — F18 fix: prefer product-level gpMeta.realization_rules
  // when present (Story 2.9 SSOT direction); fall back to market-config
  // pdp_trust_signals (existing v1.7.0 path). Both represent "how/where the
  // voucher can be redeemed" — aligned with UX-DR7.
  const productRules = Array.isArray(gpMeta?.realization_rules)
    ? (gpMeta.realization_rules.filter(
        (s): s is string => typeof s === 'string' && s.trim().length > 0,
      ) as string[])
    : null;
  const realizationRulesSource =
    productRules && productRules.length > 0 ? productRules : trustSignals;
  const realizationRules = realizationRulesSource.map((s) => ({ text: s }));

  // Seller data for SellerProofSurface
  const seller = product.seller;
  const sellerReviews = Array.isArray(seller?.reviews) ? seller.reviews.filter(Boolean) : [];
  const reviewCount = sellerReviews.length;
  const rating =
    reviewCount > 0
      ? sellerReviews.reduce((sum: number, r: { rating?: number }) => sum + Number(r?.rating ?? 0), 0) / reviewCount
      : null;

  // VendorBadge as identity slot inside SellerProofSurface.
  // F25 note: when products array is missing, fall back to 0; VendorBadge's
  // current API requires `number`. Promoting productCount to optional is out of
  // scope for Story 2.3 (touches molecules/VendorBadge ownership) — flagged as
  // a follow-up. Pluralizer renders "0 produktów" which is technically truthful
  // when seller has no products yet.
  const sellerIdentitySlot =
    seller?.name && seller?.handle ? (
      <VendorBadge
        variant="pdp"
        vendor={{
          name: seller.name,
          handle: seller.handle,
          photoUrl: seller.photo || null,
          productCount: Array.isArray(seller.products) ? seller.products.length : 0,
        }}
      />
    ) : null;

  return (
    <div className="space-y-4">
      <ProductDetailsHeader
        product={product}
        locale={locale}
        countryCode={countryCode}
        user={user}
        wishlist={wishlist}
      />

      {showNoActiveVendorsFallback && (
        // Story 5.6 — empty-state branch (vendor_offers === [] po flag flip).
        // Renders muted card "Salon przygotowuje ofertę" + Back to list CTA
        // + disabled Notify me placeholder. Orthogonal do 5.4 error path:
        // 5.4 = circuit/boundary failure; 5.6 = lifecycle vendor onboarding
        // in-progress. Per persona Marta-self transparent komunikat zamiast
        // mylącego default Medusa single-variant flow.
        <NoActiveVendorsFallback backHref={`/${locale}/categories`} />
      )}
      {showSoleVendorBadge && vendorOffers && (
        // cleanup-12c AC3 — sole-vendor explicit branch (audit F4 closed).
        // Renders a non-interactive badge instead of a 1-option selector
        // (single-option radio is UX antipattern per Epic-5 F4 audit).
        <SoleVendorBadge offer={vendorOffers[0]} />
      )}
      {showSellerSelector && vendorOffers && (
        // Story 5.3 — geolocation-aware wrapper consumes useGeolocation
        // hook (client-side) and feeds resolved coords + status to the
        // presentational SellerSelector. Lowest-price fallback preserved
        // when geolocation denied / unsupported / sellers lack coords.
        // Story 5.5 — Bridge wraps wrapper i propaguje selected seller
        // do CartContext shared state (consumed by ProductDetailsHeader
        // Add-to-Cart button + StickyAddToCart fallback path).
        <SellerSelectorCartBridge sellers={vendorOffers} />
      )}

      {/* ── Story 2.3: VoucherClaritySurface replaces ad-hoc TrustSignals + VoucherValidityInfo ── */}
      {/* Composes TrustSignals + VoucherValidityInfo as internal slots rather than duplicating
          their data resolution. refundCancellationInfo is a stable link anchor to /zasady#zwroty;
          Story 2.9 owns the legal copy SSOT — we reference it here, not freeze it. */}
      <VoucherClaritySurface
        title={product.title ?? ''}
        price={voucherPriceDisplay}
        validityWording={validityWording}
        realizationRules={realizationRules}
        merchantName={cleanText(seller?.name)}
        merchantHandle={seller?.handle}
        variant={voucherVariant}
        status={voucherStatus}
      />

      {/* ── Story 2.3: SellerProofSurface replaces ProductDetailsSeller + standalone VendorBadge ── */}
      {/* VendorBadge is passed as identitySlot — composed, not parallel-forked.
          ProductDetailsSeller (full info grid: address, contact, rating) is now inside
          SellerProofSurface state logic. SellerInfo is accessed via VendorBadge / identitySlot. */}
      {seller && (
        <SellerProofSurface
          seller={{
            name: seller.name,
            handle: seller.handle,
            photoUrl: seller.photo || null,
            status: seller.status,
            rating: rating,
            reviewCount: reviewCount > 0 ? reviewCount : null,
            city: seller.city || null,
            addressLine: seller.address_line || null,
          }}
          identitySlot={sellerIdentitySlot}
        />
      )}

      <ProductPageDetails details={product?.description || ''} />
      <ProductAdditionalAttributes attributes={product?.attribute_values || []} />
      <ProductDetailsShipping />
      <ProductDetailsFooter
        tags={product?.tags || []}
        posted={product?.created_at}
      />
    </div>
  );
};
