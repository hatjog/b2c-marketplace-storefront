import { describe, it, expect } from 'vitest';
import type { HttpTypes } from '@medusajs/types';
import { sortByRecommended } from '../sort-utils';

function makeProduct(id: string, sortRank?: number | null): HttpTypes.StoreProduct {
  return {
    id,
    title: `Product ${id}`,
    metadata: sortRank !== undefined ? { gp: { sort_rank: sortRank } } : undefined,
  } as HttpTypes.StoreProduct;
}

describe('sortByRecommended', () => {
  it('sortuje produkty rosnąco po sort_rank', () => {
    const products = [
      makeProduct('c', 3),
      makeProduct('a', 1),
      makeProduct('b', 2),
    ];
    const result = sortByRecommended(products);
    expect(result.map(p => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('produkty bez sort_rank trafiają na koniec', () => {
    const products = [
      makeProduct('no-rank'),
      makeProduct('rank-1', 1),
      makeProduct('rank-2', 2),
    ];
    const result = sortByRecommended(products);
    expect(result[0].id).toBe('rank-1');
    expect(result[1].id).toBe('rank-2');
    expect(result[2].id).toBe('no-rank');
  });

  it('null sort_rank traktowany jak Infinity (trafia na koniec)', () => {
    const products = [
      makeProduct('null-rank', null),
      makeProduct('rank-5', 5),
      makeProduct('rank-1', 1),
    ];
    const result = sortByRecommended(products);
    expect(result[0].id).toBe('rank-1');
    expect(result[1].id).toBe('rank-5');
    expect(result[2].id).toBe('null-rank');
  });

  it('nie mutuje tablicy wejściowej', () => {
    const original = [makeProduct('b', 2), makeProduct('a', 1)];
    const copy = [...original];
    sortByRecommended(original);
    expect(original.map(p => p.id)).toEqual(copy.map(p => p.id));
  });

  it('zwraca pustą tablicę gdy wejście jest puste', () => {
    expect(sortByRecommended([])).toEqual([]);
  });
});
