import type { HttpTypes } from '@medusajs/types';

import {
  ProductAdditionalAttributes,
  ProductDetailsFooter,
  ProductDetailsHeader,
  ProductDetailsSeller,
  ProductDetailsShipping,
  ProductPageDetails
} from '@/components/cells';
import { VoucherValidityInfo } from '@/components/molecules';
import { TrustSignals } from '@/components/organisms/TrustSignals/TrustSignals';
import { VendorBadge } from '@/components/molecules/VendorBadge';
import {
  NoActiveVendorsFallback,
  SellerSelectorCartBridge,
  SoleVendorBadge,
} from '@/components/cells/SellerSelector';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpMetadata } from '@/lib/helpers/metadata-utils';
import { resolveDefaultValidityInfo, resolvePdpTrustSignals } from '@/lib/runtime-market-config';
import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';
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

  return (
    <div className="space-y-4">
      <ProductDetailsHeader
        product={product}
        locale={locale}
        countryCode={countryCode}
        user={user}
        wishlist={wishlist}
      />
      {product.seller && (
        <div
          className="bb-card-muted"
          data-testid="product-details-vendor-badge"
        >
          <VendorBadge
            variant="pdp"
            vendor={{
              name: product.seller.name,
              handle: product.seller.handle,
              photoUrl: product.seller.photo || null,
              productCount: product.seller.products?.length ?? 0,
            }}
          />
        </div>
      )}
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
      <div className="grid gap-4 lg:grid-cols-2">
        <TrustSignals variant="full" signals={trustSignals} detailsUrl="/zasady" />
        <VoucherValidityInfo validityPeriod={validityPeriod} defaultInfo={defaultValidityInfo} />
      </div>
      <ProductPageDetails details={product?.description || ''} />
      <ProductAdditionalAttributes attributes={product?.attribute_values || []} />
      <ProductDetailsShipping />
      <ProductDetailsSeller seller={product?.seller} />
      <ProductDetailsFooter
        tags={product?.tags || []}
        posted={product?.created_at}
      />
    </div>
  );
};
