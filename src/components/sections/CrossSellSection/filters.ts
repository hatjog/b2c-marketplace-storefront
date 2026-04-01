import type { HttpTypes } from '@medusajs/types';

export const MAX_GROUP_SIZE = 4;
export const MIN_GROUP_SIZE = 2;

export function filterCrossSellProducts(
  products: HttpTypes.StoreProduct[],
  currentProductId: string,
): HttpTypes.StoreProduct[] {
  return products
    .filter((p) => p.id !== currentProductId)
    // != null catches both null and undefined — either means "no price"
    .filter((p) => p.variants?.some(v => v.calculated_price != null) ?? false)
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
    .filter((p) => p.id !== currentProductId)
    // != null catches both null and undefined — either means "no price"
    .filter((p) => p.variants?.some(v => v.calculated_price != null) ?? false)
    .slice(0, MAX_GROUP_SIZE);
}
