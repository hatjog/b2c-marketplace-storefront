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
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import { getMarketId } from '@/lib/helpers/market-filter';
import { getGpMetadata } from '@/lib/helpers/metadata-utils';
import { resolveDefaultValidityInfo, resolvePdpTrustSignals } from '@/lib/runtime-market-config';
import type { AdditionalAttributeProps, GpProductMetadata } from '@/types/product';
import type { SellerProps } from '@/types/seller';
import type { Wishlist } from '@/types/wishlist';

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

  return (
    <div>
      <ProductDetailsHeader
        product={product}
        locale={locale}
        countryCode={countryCode}
        user={user}
        wishlist={wishlist}
      />
      {product.seller && (
        <div
          className="mt-4"
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
      <TrustSignals variant="full" signals={trustSignals} detailsUrl="/zasady" />
      <VoucherValidityInfo validityPeriod={validityPeriod} defaultInfo={defaultValidityInfo} />
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
