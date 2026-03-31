import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock('../config', () => ({
  sdk: {
    client: {
      fetch: mockFetch
    }
  }
}));

import { getSellers } from './seller';

const makeVendor = (overrides: Record<string, unknown> = {}) => ({
  handle: 'salon-a',
  name: 'Salon A',
  photo_url: null,
  city: 'Warszawa',
  product_count: 5,
  ...overrides
});

describe('getSellers', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns empty array when API throws', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await getSellers();
    expect(result).toEqual([]);
  });

  it('filters out vendors with product_count = 0', async () => {
    mockFetch.mockResolvedValue({
      vendors: [
        makeVendor({ handle: 'zero', name: 'Zero', product_count: 0 }),
        makeVendor({ handle: 'one', name: 'One', product_count: 1 })
      ]
    });
    const result = await getSellers();
    expect(result).toHaveLength(1);
    expect(result[0].handle).toBe('one');
  });

  it('filters out vendors with product_count derived from empty products array', async () => {
    mockFetch.mockResolvedValue({
      vendors: [
        makeVendor({ handle: 'empty', name: 'Empty', product_count: undefined, products: [] }),
        makeVendor({ handle: 'full', name: 'Full', product_count: undefined, products: [{}] })
      ]
    });
    const result = await getSellers();
    expect(result.map(s => s.handle)).toEqual(['full']);
  });

  it('sorts sellers alphabetically by name (case-insensitive, pl locale)', async () => {
    mockFetch.mockResolvedValue({
      vendors: [
        makeVendor({ handle: 'c', name: 'Żaneta', product_count: 1 }),
        makeVendor({ handle: 'a', name: 'anna', product_count: 1 }),
        makeVendor({ handle: 'b', name: 'Basia', product_count: 1 })
      ]
    });
    const result = await getSellers();
    const names = result.map(s => s.name);
    // Polish locale: a < B < Ż
    expect(names[0].toLowerCase()).toBe('anna');
    expect(names[1]).toBe('Basia');
    expect(names[2]).toBe('Żaneta');
  });

  it('maps photo field to photo_url when photo_url absent', async () => {
    mockFetch.mockResolvedValue({
      vendors: [makeVendor({ handle: 'x', photo_url: undefined, photo: 'http://img.test/a.jpg', product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].photo_url).toBe('http://img.test/a.jpg');
  });

  it('returns null photo_url when neither photo_url nor photo present', async () => {
    mockFetch.mockResolvedValue({
      vendors: [makeVendor({ photo_url: undefined, photo: undefined, product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].photo_url).toBeNull();
  });

  it('returns empty array when vendors array is empty', async () => {
    mockFetch.mockResolvedValue({ vendors: [] });
    const result = await getSellers();
    expect(result).toEqual([]);
  });

  it('returns empty array when vendors key is undefined', async () => {
    mockFetch.mockResolvedValue({});
    const result = await getSellers();
    expect(result).toEqual([]);
  });

  it('maps city from vendor city field', async () => {
    mockFetch.mockResolvedValue({
      vendors: [makeVendor({ handle: 'x', city: 'Kraków', product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].city).toBe('Kraków');
  });

  it('sets city to null when city field absent', async () => {
    mockFetch.mockResolvedValue({
      vendors: [makeVendor({ handle: 'x', city: undefined, product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].city).toBeNull();
  });
});
