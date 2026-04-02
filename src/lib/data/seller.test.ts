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

const makeSeller = (overrides: Record<string, unknown> = {}) => ({
  handle: 'salon-a',
  name: 'Salon A',
  photo: null,
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

  it('calls the GP seller endpoint', async () => {
    mockFetch.mockResolvedValue({
      sellers: [makeSeller()]
    });
    await getSellers();

    expect(mockFetch).toHaveBeenCalledWith('/store/seller', { cache: 'no-cache' });
  });

  it('returns all sellers provided by the API regardless of product_count', async () => {
    mockFetch.mockResolvedValue({
      sellers: [
        makeSeller({ handle: 'zero', name: 'Zero', product_count: 0 }),
        makeSeller({ handle: 'one', name: 'One', product_count: 1 })
      ]
    });

    const result = await getSellers();

    expect(result.map(s => s.handle)).toEqual(['one', 'zero']);
  });

  it('sorts sellers alphabetically by name (case-insensitive, pl locale)', async () => {
    mockFetch.mockResolvedValue({
      sellers: [
        makeSeller({ handle: 'c', name: 'Żaneta', product_count: 1 }),
        makeSeller({ handle: 'a', name: 'anna', product_count: 1 }),
        makeSeller({ handle: 'b', name: 'Basia', product_count: 1 })
      ]
    });
    const result = await getSellers();
    const names = result.map(s => s.name);
    // Polish locale: a < B < Ż
    expect(names[0].toLowerCase()).toBe('anna');
    expect(names[1]).toBe('Basia');
    expect(names[2]).toBe('Żaneta');
  });

  it('maps photo field to photo_url', async () => {
    mockFetch.mockResolvedValue({
      sellers: [makeSeller({ handle: 'x', photo: 'http://img.test/a.jpg', product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].photo_url).toBe('http://img.test/a.jpg');
  });

  it('returns null photo_url when photo is absent', async () => {
    mockFetch.mockResolvedValue({
      sellers: [makeSeller({ photo: undefined, product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].photo_url).toBeNull();
  });

  it('defaults product_count to 0 when the field is missing', async () => {
    mockFetch.mockResolvedValue({
      sellers: [makeSeller({ handle: 'x', product_count: undefined })]
    });
    const result = await getSellers();
    expect(result[0].product_count).toBe(0);
  });

  it('returns empty array when sellers array is empty', async () => {
    mockFetch.mockResolvedValue({ sellers: [] });
    const result = await getSellers();
    expect(result).toEqual([]);
  });

  it('returns empty array when sellers key is undefined', async () => {
    mockFetch.mockResolvedValue({});
    const result = await getSellers();
    expect(result).toEqual([]);
  });

  it('maps city from vendor city field', async () => {
    mockFetch.mockResolvedValue({
      sellers: [makeSeller({ handle: 'x', city: 'Kraków', product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].city).toBe('Kraków');
  });

  it('sets city to null when city field absent', async () => {
    mockFetch.mockResolvedValue({
      sellers: [makeSeller({ handle: 'x', city: undefined, product_count: 1 })]
    });
    const result = await getSellers();
    expect(result[0].city).toBeNull();
  });
});
