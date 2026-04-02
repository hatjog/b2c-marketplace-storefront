import type { HttpTypes } from '@medusajs/types';

import { getPricesForVariant } from '@/lib/helpers/get-product-price';

export const MAX_GROUP_SIZE = 4;
export const MIN_GROUP_SIZE = 2;

function hasRenderablePrice(product: HttpTypes.StoreProduct): boolean {
  return product.variants?.some(variant => getPricesForVariant(variant)?.calculated_price_number != null) ?? false;
}

export function filterCrossSellProducts(
  products: HttpTypes.StoreProduct[],
  currentProductId: string,
): HttpTypes.StoreProduct[] {
  return products
    .filter((product) => Boolean(product.id) && product.id !== currentProductId)
    .filter(hasRenderablePrice)
    .slice(0, MAX_GROUP_SIZE);
}

/**
 * Filter for seller-embedded products (from product.seller.products).
 * Applies the same price check as filterCrossSellProducts — seller products
 * now include calculated_price via the listProducts fields query.
 *
 * Intentionally identical to filterCrossSellProducts — keep in sync if either changes.
 */
export function filterCrossSellSellerProducts(
  products: HttpTypes.StoreProduct[],
  currentProductId: string,
): HttpTypes.StoreProduct[] {
  return products
    .filter((product) => Boolean(product.id) && product.id !== currentProductId)
    .filter(hasRenderablePrice)
    .slice(0, MAX_GROUP_SIZE);
}
