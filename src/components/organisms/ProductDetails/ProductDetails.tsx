import type { HttpTypes } from '@medusajs/types';

import {
  ProductAdditionalAttributes,
  ProductDetailsFooter,
  ProductDetailsHeader,
  ProductDetailsSeller,
  ProductDetailsShipping,
  ProductPageDetails
} from '@/components/cells';
import { retrieveCustomer } from '@/lib/data/customer';
import { getUserWishlists } from '@/lib/data/wishlist';
import { getCountryCode } from '@/lib/helpers/country-code';
import type { AdditionalAttributeProps } from '@/types/product';
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

  return (
    <div>
      <ProductDetailsHeader
        product={product}
        locale={locale}
        countryCode={countryCode}
        user={user}
        wishlist={wishlist}
      />
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
