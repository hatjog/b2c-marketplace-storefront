import type { HttpTypes } from '@medusajs/types';

export const MAX_GROUP_SIZE = 4;
export const MIN_GROUP_SIZE = 2;

export function filterCrossSellProducts(
  products: HttpTypes.StoreProduct[],
  currentProductId: string,
): HttpTypes.StoreProduct[] {
  return products
    .filter((p) => p.id !== currentProductId)
    .filter((p) => (p.variants?.[0]?.calculated_price ?? null) !== null)
    .slice(0, MAX_GROUP_SIZE);
}
