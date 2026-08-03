import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCollectionsMock = vi.fn();
const getCollectionByHandleMock = vi.fn();

vi.mock('./collections', () => ({
  listCollections: listCollectionsMock,
  getCollectionByHandle: getCollectionByHandleMock
}));

vi.mock('@/lib/collection-media', () => ({
  getCollectionPhotoUrl: () => null
}));

describe('editorial-collections helpers', () => {
  beforeEach(() => {
    listCollectionsMock.mockReset();
    getCollectionByHandleMock.mockReset();
  });

  it('builds fixture-backed index cards grouped by bucket', async () => {
    listCollectionsMock.mockResolvedValue({ collections: [], count: 0 });
    getCollectionByHandleMock.mockResolvedValue(null);

    const { listEditorialCollections } = await import('./editorial-collections');
    const result = await listEditorialCollections('en');

    expect(result.cards.length).toBeGreaterThanOrEqual(4);
    expect(result.featured?.handle).toBe('wybor-redakcji');
    expect(result.grouped.editorial.some(card => card.handle === 'wybor-redakcji')).toBe(true);
    expect(result.grouped.seasonal.some(card => card.handle === 'sezonowe-rytualy')).toBe(true);
    expect(result.grouped.recommended.some(card => card.handle === 'polecane-prezenty')).toBe(true);
  });

  it('keeps curated order by default and can switch to title sort', async () => {
    listCollectionsMock.mockResolvedValue({ collections: [], count: 0 });
    getCollectionByHandleMock.mockResolvedValue(null);

    const { getEditorialCollectionDetail } = await import('./editorial-collections');
    const curated = await getEditorialCollectionDetail({
      handle: 'polecane-prezenty',
      locale: 'pl',
      sort: 'curated'
    });
    const sorted = await getEditorialCollectionDetail({
      handle: 'polecane-prezenty',
      locale: 'pl',
      sort: 'title-desc'
    });

    expect(curated?.items.map(item => item.title)).toEqual([
      'Voucher podarunkowy 200 zł',
      'Zestaw manicure + brow bar',
      'Pakiet relaksacyjny dla dwojga'
    ]);
    expect(sorted?.items.map(item => item.title)).toEqual([
      'Zestaw manicure + brow bar',
      'Voucher podarunkowy 200 zł',
      'Pakiet relaksacyjny dla dwojga'
    ]);
  });

  it('reports empty collections without inventing fallback products', async () => {
    listCollectionsMock.mockResolvedValue({ collections: [], count: 0 });
    getCollectionByHandleMock.mockResolvedValue(null);

    const { getEditorialCollectionDetail } = await import('./editorial-collections');
    const result = await getEditorialCollectionDetail({
      handle: 'pusta-kolekcja',
      locale: 'pl'
    });

    expect(result?.isEmpty).toBe(true);
    expect(result?.items).toEqual([]);
  });
});
