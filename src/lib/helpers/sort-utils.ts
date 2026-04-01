import type { HttpTypes } from '@medusajs/types';
import { getGpMetadata } from './metadata-utils';

/**
 * Sorts products by metadata.gp.sort_rank ascending.
 * Products without sort_rank are placed at the end of the list.
 * Returns a new array (pure function — does not mutate input).
 */
export function sortByRecommended(products: HttpTypes.StoreProduct[]): HttpTypes.StoreProduct[] {
  return [...products].sort((a, b) => {
    const rankA = getGpMetadata<{ sort_rank?: number }>(a.metadata as Record<string, unknown>)?.sort_rank ?? Infinity;
    const rankB = getGpMetadata<{ sort_rank?: number }>(b.metadata as Record<string, unknown>)?.sort_rank ?? Infinity;
    return rankA - rankB;
  });
}
