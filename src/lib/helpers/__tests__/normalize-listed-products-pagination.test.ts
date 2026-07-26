import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

vi.mock('@/lib/helpers/asset-reference', () => ({
  resolveMarketAssetUrl: (url: string | null | undefined) => url ?? null,
}));

vi.mock('@/lib/helpers/market-filter', () => ({
  getMarketId: () => 'bonbeauty',
}));

vi.mock('@/lib/helpers/metadata-utils', () => ({
  getGpField: () => undefined,
  // Story 1.4 (AD-4): gate czyta `content_bar` przez ten accessor. `undefined`
  // = brak sygnału ⇒ ścieżka legacy EE-1 (wordcount), czyli DOKŁADNIE ten tor,
  // na którym stoją fixture'y tego pliku (opisy 100-słowne). Inwariant
  // paginacji jest tu badany niezależnie od fazy gate'u.
  readContentBarFlag: () => undefined,
}));

import { normalizeListedProducts, type ListedProduct } from '../normalize-listed-products';

function makeProduct(overrides: Partial<ListedProduct> & { id: string }): ListedProduct {
  return {
    ...overrides,
    id: overrides.id,
    handle: overrides.handle ?? `handle-${overrides.id}`,
    title: overrides.title ?? `Product ${overrides.id}`,
    status: overrides.status ?? 'published',
    description: overrides.description ?? Array.from({ length: 100 }, () => 'word').join(' '),
    thumbnail: overrides.thumbnail ?? 'https://cdn.example.org/real.jpg',
    images: overrides.images ?? [],
    metadata: overrides.metadata ?? {},
    variants: overrides.variants ?? [
      // Cast: vitest fixtures only need the calculated_amount field for quality-gate
      { calculated_price: { calculated_amount: 1000 } } as never,
    ],
  } as unknown as ListedProduct;
}

describe('normalizeListedProducts — pagination invariant (deferred-work.md v1.4.0)', () => {
  it('filter step runs BEFORE consumers compute count', () => {
    // 5 inputs: 3 valid + 2 dropped (placeholder thumbnail)
    const inputs: ListedProduct[] = [
      makeProduct({ id: 'p1' }),
      makeProduct({ id: 'p2' }),
      makeProduct({ id: 'p3' }),
      makeProduct({ id: 'p4-bad', thumbnail: 'https://cdn.example.com/placeholder.jpg' }),
      makeProduct({ id: 'p5-bad', thumbnail: '' }),
    ];

    const filtered = normalizeListedProducts(inputs);

    // Invariant 1: filtered output strictly less than or equal to input
    expect(filtered.length).toBeLessThanOrEqual(inputs.length);
    // Invariant 2: post-filter count is the rendered batch size (consumers should use .length)
    expect(filtered.length).toBe(3);
    // Invariant 3: dropped products NOT present in filtered output
    const filteredIds = new Set(filtered.map((p) => p.id));
    expect(filteredIds.has('p4-bad')).toBe(false);
    expect(filteredIds.has('p5-bad')).toBe(false);
    // Invariant 4: rendered count == filtered_total (rendered matches what UI shows)
    expect(filteredIds.size).toBe(filtered.length);
  });

  it('returns empty array (count=0) when all inputs fail quality gate', () => {
    const inputs: ListedProduct[] = [
      makeProduct({ id: 'bad1', thumbnail: '' }),
      makeProduct({ id: 'bad2', description: 'too short' }),
    ];

    const filtered = normalizeListedProducts(inputs);
    expect(filtered.length).toBe(0);
  });

  it('preserves order of valid products (filter is stable)', () => {
    const inputs: ListedProduct[] = [
      makeProduct({ id: 'a' }),
      makeProduct({ id: 'b-bad', thumbnail: '' }),
      makeProduct({ id: 'c' }),
      makeProduct({ id: 'd-bad', description: 'short' }),
      makeProduct({ id: 'e' }),
    ];

    const filtered = normalizeListedProducts(inputs);
    expect(filtered.map((p) => p.id)).toEqual(['a', 'c', 'e']);
  });

  it('prefers a Mercur 2 active seller when seller payload is an array', () => {
    const inputs: ListedProduct[] = [
      makeProduct({
        id: 'mv-1',
        seller: [
          {
            id: 'seller-legacy-inactive',
            handle: 'legacy-inactive',
            name: 'Legacy Inactive',
            description: 'inactive',
            photo: '',
            tax_id: '',
            created_at: '2026-01-01T00:00:00.000Z',
            store_status: 'INACTIVE',
          },
          {
            id: 'seller-runtime-open',
            handle: 'runtime-open',
            name: 'Runtime Open',
            description: 'open',
            photo: '',
            tax_id: '',
            created_at: '2026-01-01T00:00:00.000Z',
            status: 'open',
          },
        ] as unknown as ListedProduct['seller'],
      }),
    ];

    const filtered = normalizeListedProducts(inputs);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].seller).toMatchObject({
      id: 'seller-runtime-open',
      status: 'open',
    });
  });
});
