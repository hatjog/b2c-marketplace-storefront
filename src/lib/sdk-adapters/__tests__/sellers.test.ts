/**
 * Tests for sdk-adapters/sellers.ts (story v160-cleanup-28, AC2 + AC5).
 *
 * Covers:
 *  - resolveSellerHandleToId: happy path, not found (empty sellers), API error
 *  - fetchSellerById: happy path, not found (null seller), API error
 *  - mapSellerApiToProps: field mapping (indirectly via fetchSellerById)
 *
 * Tests use vitest mocks for mercurClient (singleton from lib/config).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mock mercurClient + unstable_cache BEFORE module imports ----

// unstable_cache (Next.js server function) is not available in vitest env —
// mock it to execute the callback directly (synchronous passthrough).
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn
}));

const mockSellersQuery = vi.fn();
const mockSellersIdQuery = vi.fn();

vi.mock('../../config', () => ({
  mercurClient: {
    store: {
      sellers: new Proxy(
        {
          query: (...args: unknown[]) => mockSellersQuery(...args),
          $id: new Proxy(
            {},
            {
              get(_target, prop) {
                if (prop === 'query') {
                  return (...args: unknown[]) => mockSellersIdQuery(...args);
                }
                return undefined;
              }
            }
          )
        },
        {
          get(target, prop) {
            if (prop === '$id') {
              return target.$id;
            }
            if (prop in target) {
              return (target as Record<string, unknown>)[prop as string];
            }
            return undefined;
          }
        }
      )
    }
  }
}));

import { fetchSellerById, resolveSellerHandleToId } from '../sellers';

// ---------------------------------------------------------------------------

const makeSeller = (overrides: Record<string, unknown> = {}) => ({
  id: 'seller-abc',
  handle: 'bonbeauty',
  name: 'BonBeauty',
  photo: 'https://img.example.com/photo.jpg',
  description: 'Beauty salon',
  city: 'Warszawa',
  product_count: 12,
  tax_id: 'PL123',
  created_at: '2024-01-01T00:00:00Z',
  email: 'contact@bonbeauty.pl',
  phone: '+48600000000',
  status: 'open',
  store_status: 'ACTIVE',
  social_links: { instagram: '@bonbeauty' },
  gallery: null,
  opening_hours: null,
  locations: null,
  reviews: [],
  ...overrides
});

// ---------------------------------------------------------------------------
// resolveSellerHandleToId
// ---------------------------------------------------------------------------

describe('resolveSellerHandleToId', () => {
  beforeEach(() => {
    mockSellersQuery.mockReset();
  });

  it('returns seller id when handle matches a seller', async () => {
    mockSellersQuery.mockResolvedValue({ sellers: [makeSeller()] });

    const result = await resolveSellerHandleToId('bonbeauty');

    expect(result).toBe('seller-abc');
    expect(mockSellersQuery).toHaveBeenCalledWith(
      expect.objectContaining({ handle: 'bonbeauty', limit: 1 })
    );
  });

  it('returns null when sellers array is empty (handle not found)', async () => {
    mockSellersQuery.mockResolvedValue({ sellers: [] });

    const result = await resolveSellerHandleToId('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when sellers key is missing in response', async () => {
    mockSellersQuery.mockResolvedValue({});

    const result = await resolveSellerHandleToId('bonbeauty');
    expect(result).toBeNull();
  });

  it('returns null when API throws (graceful error handling)', async () => {
    mockSellersQuery.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await resolveSellerHandleToId('bonbeauty');
    expect(result).toBeNull();
  });

  it('returns null when API returns null', async () => {
    mockSellersQuery.mockResolvedValue(null);

    const result = await resolveSellerHandleToId('bonbeauty');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchSellerById
// ---------------------------------------------------------------------------

describe('fetchSellerById', () => {
  beforeEach(() => {
    mockSellersIdQuery.mockReset();
  });

  it('returns SellerProps when seller found by id', async () => {
    mockSellersIdQuery.mockResolvedValue({ seller: makeSeller() });

    const result = await fetchSellerById('seller-abc');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('seller-abc');
    expect(result?.handle).toBe('bonbeauty');
    expect(result?.name).toBe('BonBeauty');
  });

  it('passes $id param in query call', async () => {
    mockSellersIdQuery.mockResolvedValue({ seller: makeSeller() });

    await fetchSellerById('seller-abc');

    expect(mockSellersIdQuery).toHaveBeenCalledWith(
      expect.objectContaining({ $id: 'seller-abc' })
    );
  });

  it('passes fields param when provided', async () => {
    mockSellersIdQuery.mockResolvedValue({ seller: makeSeller() });

    await fetchSellerById('seller-abc', '+email,+phone');

    expect(mockSellersIdQuery).toHaveBeenCalledWith(
      expect.objectContaining({ $id: 'seller-abc', fields: '+email,+phone' })
    );
  });

  it('returns null when seller key is absent in response', async () => {
    mockSellersIdQuery.mockResolvedValue({});

    const result = await fetchSellerById('seller-abc');
    expect(result).toBeNull();
  });

  it('returns null on 404 / API error', async () => {
    mockSellersIdQuery.mockRejectedValue(new Error('Not Found'));

    const result = await fetchSellerById('seller-abc');
    expect(result).toBeNull();
  });

  it('maps photo to SellerProps.photo field', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({ photo: 'https://img.example.com/photo.jpg' })
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.photo).toBe('https://img.example.com/photo.jpg');
  });

  it('returns empty string for photo when absent', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({ photo: null })
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.photo).toBe('');
  });

  it('maps email and phone when present', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({ email: 'test@test.pl', phone: '+48600000001' })
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.email).toBe('test@test.pl');
    expect(result?.phone).toBe('+48600000001');
  });

  it('maps status and store_status correctly', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({ status: 'suspended', store_status: 'SUSPENDED' })
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.status).toBe('suspended');
    expect(result?.store_status).toBe('SUSPENDED');
  });

  it('maps social_links when present', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({ social_links: { instagram: '@beauty' } })
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.social_links).toEqual({ instagram: '@beauty' });
  });

  it('returns empty reviews array when reviews missing', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({ reviews: undefined })
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.reviews).toEqual([]);
  });
});
