import type { HttpTypes } from '@medusajs/types';

export const MAX_GROUP_SIZE = 4;
export const MIN_GROUP_SIZE = 2;

export function filterCrossSellProducts(
  products: HttpTypes.StoreProduct[],
  currentProductId: string,
): HttpTypes.StoreProduct[] {
  return products
    .filter((p) => p.id !== currentProductId)
    .filter((p) => p.variants?.some(v => v.calculated_price != null) ?? false)
    .slice(0, MAX_GROUP_SIZE);
}

/**
 * Filter for seller-embedded products (from product.seller.products).
 * These lack calculated_price (not in fields query) so we skip the price check.
 * They are already published (Medusa store API filters status=published).
 */
export function filterCrossSellSellerProducts(
  products: HttpTypes.StoreProduct[],
  currentProductId: string,
): HttpTypes.StoreProduct[] {
  return products
    .filter((p) => p.id !== currentProductId)
    .slice(0, MAX_GROUP_SIZE);
}
