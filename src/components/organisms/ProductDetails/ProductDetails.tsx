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
import { TrustSignals } from '@/components/organisms/TrustSignals/TrustSignals';
import { VoucherValidityInfo } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpMetadata } from '@/lib/helpers/metadata-utils';
import { resolveDefaultValidityInfo, resolvePdpTrustSignals } from '@/lib/runtime-market-config';
import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';
import { getProductPrice } from '@/lib/helpers/get-product-price';
import {
  deriveVoucherClarityVariant,
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
  const { cheapestVariant } = getProductPrice({ product });
  const hasPrice = cheapestVariant !== null && !!cheapestVariant.calculated_price;

  const voucherVariant: VoucherClarityVariant = deriveVoucherClarityVariant({
    hasPrice,
    isVendorUnavailable: showNoActiveVendorsFallback,
  });

  // Resolve validity wording from voucher-copy.ts (shared with Stories 2.4/2.5/2.6)
  const validityWording = resolveValidityWording(validityPeriod, defaultValidityInfo);

  // Realization rules — sourced from trust signals (market config pdp_trust_signals).
  // These represent "how/where the voucher can be redeemed" — aligned with UX-DR7.
  const realizationRules = trustSignals.map((s) => ({ text: s }));

  // Seller data for SellerProofSurface
  const seller = product.seller;
  const sellerReviews = Array.isArray(seller?.reviews) ? seller.reviews.filter(Boolean) : [];
  const reviewCount = sellerReviews.length;
  const rating =
    reviewCount > 0
      ? sellerReviews.reduce((sum: number, r: { rating?: number }) => sum + Number(r?.rating ?? 0), 0) / reviewCount
      : null;

  // VendorBadge as identity slot inside SellerProofSurface
  const sellerIdentitySlot =
    seller?.name && seller?.handle ? (
      <VendorBadge
        variant="pdp"
        vendor={{
          name: seller.name,
          handle: seller.handle,
          photoUrl: seller.photo || null,
          productCount: seller.products?.length ?? 0,
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
        validityWording={validityWording}
        realizationRules={realizationRules}
        merchantName={seller?.name}
        merchantHandle={seller?.handle}
        variant={voucherVariant}
        status={
          voucherVariant === 'warning'
            ? {
                kind: 'unavailable',
                message: 'Voucher tymczasowo niedostępny',
                nextAction: {
                  href: `/${locale}/categories`,
                  label: 'Wróć do listy',
                },
              }
            : voucherVariant === 'error'
              ? {
                  kind: 'expired',
                  message: 'Voucher niedostępny',
                  nextAction: {
                    href: `/${locale}/categories`,
                    label: 'Wróć do listy',
                  },
                }
              : undefined
        }
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
