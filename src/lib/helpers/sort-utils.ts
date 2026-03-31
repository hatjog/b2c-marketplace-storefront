import type { HttpTypes } from '@medusajs/types';

/**
 * Sorts products by metadata.gp.sort_rank ascending.
 * Products without sort_rank are placed at the end of the list.
 * Returns a new array (pure function — does not mutate input).
 */
export function sortByRecommended(products: HttpTypes.StoreProduct[]): HttpTypes.StoreProduct[] {
  return [...products].sort((a, b) => {
    const rankA = (a.metadata?.gp as { sort_rank?: number } | null)?.sort_rank ?? Infinity;
    const rankB = (b.metadata?.gp as { sort_rank?: number } | null)?.sort_rank ?? Infinity;
    return rankA - rankB;
  });
}
