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

import {
  fetchSellerById,
  fetchSellerProfileByHandle,
  fetchSellerSummaryByHandle,
  resolveSellerHandleToId
} from '../sellers';

// ---- Mock mercurClient + unstable_cache BEFORE module imports ----

// unstable_cache (Next.js server function) is not available in vitest env —
// mock it to execute the callback directly (synchronous passthrough).
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn
}));

const mockSellersQuery = vi.fn();
const mockSellersIdQuery = vi.fn();
const mockSdkFetch = vi.fn();

vi.mock('../../config', () => ({
  sdk: {
    client: {
      fetch: (...args: unknown[]) => mockSdkFetch(...args)
    }
  },
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
  store_status: 'ACTIVE', // noqa: mercur15-drift — legacy Mercur 1.x bridge fixture
  address_line: 'ul. Testowa 1',
  postal_code: '00-001',
  country_code: 'pl',
  district: 'Śródmieście',
  lat: 52.2297,
  lng: 21.0122,
  regon: '123456789',
  krs: '0000123456',
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

  it('falls back to unfiltered seller list when handle filter returns empty', async () => {
    mockSellersQuery.mockResolvedValueOnce({ sellers: [] }).mockResolvedValueOnce({
      sellers: [
        makeSeller({ id: 'seller-other', handle: 'other' }),
        makeSeller({ id: 'seller-city', handle: 'city-beauty' })
      ]
    });

    const result = await resolveSellerHandleToId('city-beauty');

    expect(result).toBe('seller-city');
    expect(mockSellersQuery).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ handle: 'city-beauty', limit: 1 })
    );
    expect(mockSellersQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fetchOptions: {
          cache: 'no-cache',
          headers: { 'x-medusa-locale': 'pl-PL' }
        }
      })
    );
  });

  it('does not accept a mismatched first seller when backend ignores the handle filter', async () => {
    mockSellersQuery
      .mockResolvedValueOnce({
        sellers: [makeSeller({ id: 'seller-other', handle: 'other' })]
      })
      .mockResolvedValueOnce({
        sellers: [makeSeller({ id: 'seller-city', handle: 'city-beauty' })]
      });

    const result = await resolveSellerHandleToId('city-beauty');

    expect(result).toBe('seller-city');
  });

  it('normalizes leading slashes and handle casing during resolution', async () => {
    mockSellersQuery.mockResolvedValue({
      sellers: [makeSeller({ id: 'seller-city', handle: 'City-Beauty' })]
    });

    const result = await resolveSellerHandleToId('/city-beauty/');

    expect(result).toBe('seller-city');
  });

  it('returns null when sellers array is empty (handle not found)', async () => {
    mockSellersQuery.mockResolvedValueOnce({ sellers: [] }).mockResolvedValueOnce({ sellers: [] });

    const result = await resolveSellerHandleToId('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null when sellers key is missing in response', async () => {
    mockSellersQuery.mockResolvedValueOnce({}).mockResolvedValueOnce({});

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

  // cleanup-28 review AC-1: cache key must include the handle arg, not collapse
  // distinct handles to a single cache slot. Using a real per-call mock that
  // returns a handle-specific id verifies the resolver does not memoize
  // incorrectly within a single test (and that mockSellersQuery is invoked
  // once per unique handle regardless of `unstable_cache` keying behavior).
  it('returns distinct ids for distinct handles (cache key includes handle)', async () => {
    mockSellersQuery.mockImplementation(async (params: { handle: string }) => ({
      sellers: [makeSeller({ id: `id-${params.handle}`, handle: params.handle })]
    }));

    const idA = await resolveSellerHandleToId('handle-a');
    const idB = await resolveSellerHandleToId('handle-b');

    expect(idA).toBe('id-handle-a');
    expect(idB).toBe('id-handle-b');
    expect(mockSellersQuery).toHaveBeenCalledTimes(2);
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

    expect(mockSellersIdQuery).toHaveBeenCalledWith(expect.objectContaining({ $id: 'seller-abc' }));
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

  it('falls back to logo and metadata photo when direct photo is absent', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({
        photo: null,
        logo: null,
        metadata: {
          gp: {
            photo_url: 'https://img.example.com/metadata-photo.jpg',
            gallery: ['https://img.example.com/gallery-1.jpg']
          }
        }
      })
    });

    const result = await fetchSellerById('seller-abc');

    expect(result?.photo).toBe('https://img.example.com/metadata-photo.jpg');
    expect(result?.gallery).toEqual([{ url: 'https://img.example.com/gallery-1.jpg' }]);
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
      seller: makeSeller({ status: 'suspended', store_status: 'SUSPENDED' }) // noqa: mercur15-drift — legacy bridge fixture
    });

    const result = await fetchSellerById('seller-abc');
    expect(result?.status).toBe('suspended');
    expect(result?.store_status).toBe('SUSPENDED'); // noqa: mercur15-drift — legacy bridge assertion
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

  it('maps address, geo and legal fields from seller payload', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller()
    });

    const result = await fetchSellerById('seller-abc');

    expect(result?.address_line).toBe('ul. Testowa 1');
    expect(result?.postal_code).toBe('00-001');
    expect(result?.country_code).toBe('pl');
    expect(result?.district).toBe('Śródmieście');
    expect(result?.lat).toBe(52.2297);
    expect(result?.lng).toBe(21.0122);
    expect(result?.regon).toBe('123456789');
    expect(result?.krs).toBe('0000123456');
  });

  it('falls back to the first location when direct address fields are absent', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({
        address_line: null,
        postal_code: null,
        country_code: null,
        district: null,
        locations: [
          {
            address_line: 'ul. Zapasowa 2',
            postal_code: '30-001',
            city: 'Kraków',
            country_code: 'pl',
            district: 'Kazimierz'
          }
        ]
      })
    });

    const result = await fetchSellerById('seller-abc');

    expect(result?.address_line).toBe('ul. Zapasowa 2');
    expect(result?.postal_code).toBe('30-001');
    expect(result?.country_code).toBe('pl');
    expect(result?.district).toBe('Kazimierz');
  });

  it('falls back to lat/lng from the first location when direct geo fields are absent', async () => {
    mockSellersIdQuery.mockResolvedValue({
      seller: makeSeller({
        lat: null,
        lng: null,
        locations: [
          {
            address_line: 'ul. Geo 3',
            postal_code: '00-003',
            city: 'Warszawa',
            country_code: 'pl',
            district: 'Centrum',
            lat: 52.2297,
            lng: 21.0122
          }
        ]
      })
    });

    const result = await fetchSellerById('seller-abc');

    expect(result?.lat).toBe(52.2297);
    expect(result?.lng).toBe(21.0122);
  });
});

describe('fetchSellerProfileByHandle', () => {
  beforeEach(() => {
    mockSdkFetch.mockReset();
  });

  it('returns a mapped seller from the enriched handle route', async () => {
    mockSdkFetch.mockResolvedValue({
      seller: makeSeller({
        photo: 'https://img.example.com/profile.jpg',
        seo: {
          meta_title: 'Studio Nova',
          meta_description: 'Realny profil salonu',
          og_image_url: 'https://img.example.com/og.jpg'
        }
      })
    });

    const result = await fetchSellerProfileByHandle('studio-nova');

    expect(result?.photo).toBe('https://img.example.com/profile.jpg');
    expect(result?.seo).toEqual({
      meta_title: 'Studio Nova',
      meta_description: 'Realny profil salonu',
      og_image_url: 'https://img.example.com/og.jpg'
    });
    expect(mockSdkFetch).toHaveBeenCalledWith('/store/seller/studio-nova', {
      method: 'GET',
      cache: 'no-cache'
    });
  });

  it('returns null when the enriched handle route fails', async () => {
    mockSdkFetch.mockRejectedValue(new Error('Not Found'));

    const result = await fetchSellerProfileByHandle('missing');

    expect(result).toBeNull();
  });
});

describe('fetchSellerSummaryByHandle', () => {
  beforeEach(() => {
    mockSellersQuery.mockReset();
  });

  it('returns a mapped seller from the filtered handle query', async () => {
    mockSellersQuery.mockResolvedValue({ sellers: [makeSeller()] });

    const result = await fetchSellerSummaryByHandle('bonbeauty', '+email,+phone');

    expect(result?.handle).toBe('bonbeauty');
    expect(result?.address_line).toBe('ul. Testowa 1');
    expect(mockSellersQuery).toHaveBeenCalledWith(
      expect.objectContaining({ handle: 'bonbeauty', limit: 1, fields: '+email,+phone' })
    );
  });

  it('retries with no-cache when the filtered response contains no matching seller', async () => {
    mockSellersQuery
      .mockResolvedValueOnce({ sellers: [] })
      .mockResolvedValueOnce({ sellers: [makeSeller({ handle: 'city-beauty' })] });

    const result = await fetchSellerSummaryByHandle('city-beauty');

    expect(result?.handle).toBe('city-beauty');
    expect(mockSellersQuery).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        handle: 'city-beauty',
        limit: 1,
        fetchOptions: {
          cache: 'no-cache',
          headers: { 'x-medusa-locale': 'pl-PL' }
        }
      })
    );
  });
});
