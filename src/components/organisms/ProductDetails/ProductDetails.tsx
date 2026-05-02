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
import { SellerSelectorWithGeolocation } from '@/components/cells/SellerSelector';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpMetadata } from '@/lib/helpers/metadata-utils';
import { resolveDefaultValidityInfo, resolvePdpTrustSignals } from '@/lib/runtime-market-config';
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
 */
const MULTI_VENDOR_PRICING_ENABLED =
  process.env.NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED === 'true';

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

  // Story 5.2 — vendor offers DRAFT schema-only in v1.6.0; backend Phase B
  // populates this field. Read defensively from metadata; selector hidden
  // unless flag flipped AND length > 1 per AC4.
  const vendorOffers =
    (product as unknown as MultiVendorPricingFields).vendor_offers ?? undefined;
  const showSellerSelector =
    MULTI_VENDOR_PRICING_ENABLED && Array.isArray(vendorOffers) && vendorOffers.length > 1;

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
      {showSellerSelector && vendorOffers && (
        // Story 5.3 — geolocation-aware wrapper consumes useGeolocation
        // hook (client-side) and feeds resolved coords + status to the
        // presentational SellerSelector. Lowest-price fallback preserved
        // when geolocation denied / unsupported / sellers lack coords.
        <SellerSelectorWithGeolocation
          sellers={vendorOffers}
          // Story 5.5+ wires cart context; v1.6.0 placeholder (no-op) —
          // selector is flag-gated DRAFT until Phase B flip.
          onSelect={() => {
            /* TODO Story 5.5+ — propagate seller_id into cart context */
          }}
        />
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
