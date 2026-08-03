/**
 * Tests for getSellerByHandle (story v160-cleanup-28, AC4 + AC5 — TF-51).
 *
 * Verifies Option B resolution: handle→id list lookup (cached) + id-based fetch.
 *
 * Coverage:
 *  - Happy path: handle resolves to id, seller fetched successfully
 *  - Handle not found: resolveSellerHandleToId returns null → getSellerByHandle returns null
 *  - Seller id found but fetchSellerById returns null → getSellerByHandle returns null
 *  - Reviews sorted by created_at desc (existing consumer contract preserved)
 *  - Graceful null on any sub-call error
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock sdk-adapters/sellers — isolates getSellerByHandle logic from adapter internals
const mockResolveHandleToId = vi.fn();
const mockFetchSellerById = vi.fn();
const mockFetchSellerSummaryByHandle = vi.fn();
const mockFetchSellerProfileByHandle = vi.fn();

vi.mock('../sdk-adapters/sellers', () => ({
  resolveSellerHandleToId: (...args: unknown[]) => mockResolveHandleToId(...args),
  fetchSellerById: (...args: unknown[]) => mockFetchSellerById(...args),
  fetchSellerProfileByHandle: (...args: unknown[]) => mockFetchSellerProfileByHandle(...args),
  fetchSellerSummaryByHandle: (...args: unknown[]) => mockFetchSellerSummaryByHandle(...args)
}));

// Mock locale interceptor — control the active storefront locale per test.
// Default to the source locale (pl-PL) so existing cases keep PL behavior.
const mockResolveStorefrontLocale = vi.fn<() => Promise<string>>(() =>
  Promise.resolve('pl-PL')
);
vi.mock('../sdk/locale-interceptor', () => ({
  resolveStorefrontLocale: () => mockResolveStorefrontLocale(),
  withMercurLocaleOptions: (args: unknown) =>
    Promise.resolve(args ?? { fetchOptions: {} }),
  normalizeToCanonicalLocale: (loc: string) =>
    ({ pl: 'pl-PL', ua: 'uk-UA', de: 'de-DE', en: 'en-US' })[loc] ?? loc,
  // v1.14.0 Story 1.2: seller.ts porównuje locale w przestrzeni slugów
  // (lint-gate gp/locale-cache-boundary zakazuje literałów BCP-47 w lib/data/**).
  slugFromCanonical: (loc: string) =>
    ({ 'pl-PL': 'pl', 'uk-UA': 'ua', 'de-DE': 'de', 'en-US': 'en' })[loc] ?? loc
}));

// Mock mercurClient — seller.ts imports it for getSellers (not used by getSellerByHandle now)
vi.mock('../config', () => ({
  mercurClient: {
    store: {
      sellers: {
        query: vi.fn()
      }
    }
  }
}));

import { getSellerByHandle } from './seller';

// ---------------------------------------------------------------------------

const makeSeller = (overrides: Record<string, unknown> = {}) => ({
  id: 'seller-abc',
  handle: 'bonbeauty',
  name: 'BonBeauty',
  photo: 'https://img.example.com/photo.jpg',
  description: 'Beauty salon',
  tax_id: 'PL123',
  created_at: '2024-01-01T00:00:00Z',
  reviews: [],
  ...overrides
});

describe('getSellerByHandle', () => {
  beforeEach(() => {
    mockResolveHandleToId.mockReset();
    mockFetchSellerById.mockReset();
    mockFetchSellerSummaryByHandle.mockReset();
    mockFetchSellerProfileByHandle.mockReset();
    mockResolveStorefrontLocale.mockReset();
    mockResolveStorefrontLocale.mockResolvedValue('pl-PL');
  });

  // A base seller that needs no media/contact enrichment, so the profile fetch
  // is only triggered by the localized-description path (not needsProfileEnrichment).
  const makeCompleteBase = (overrides: Record<string, unknown> = {}) =>
    makeSeller({
      gallery: [{ url: 'https://img.example.com/base-gallery.jpg' }],
      address_line: 'ul. Bazowa 1',
      city: 'Warszawa',
      phone: '+48600000000',
      social_links: { instagram: '@bonbeauty' },
      opening_hours: { monday: { open: '10:00', close: '19:00' }, sunday: null },
      ...overrides
    });

  it('skips the profile fetch on the source locale when the base is complete', async () => {
    mockResolveStorefrontLocale.mockResolvedValue('pl-PL');
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeCompleteBase());

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.id).toBe('seller-abc');
    expect(mockFetchSellerProfileByHandle).not.toHaveBeenCalled();
  });

  it('fetches the profile for a localized description on a non-source locale even when the base is complete', async () => {
    mockResolveStorefrontLocale.mockResolvedValue('uk-UA');
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    // Base carries only the source-locale (PL) description.
    mockFetchSellerById.mockResolvedValue(
      makeCompleteBase({ description: 'Salon premium w centrum Warszawy.' })
    );
    // GP profile route applies the seller translation overlay.
    mockFetchSellerProfileByHandle.mockResolvedValue(
      makeCompleteBase({ description: 'Преміальний салон у центрі Варшави.' })
    );

    const result = await getSellerByHandle('bonbeauty');

    expect(mockFetchSellerProfileByHandle).toHaveBeenCalledWith('bonbeauty', 'uk-UA');
    expect(result?.description).toBe('Преміальний салон у центрі Варшави.');
  });

  it('returns seller when handle resolves to id and seller is fetched', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller());
    mockFetchSellerProfileByHandle.mockResolvedValue(
      makeSeller({
        gallery: [{ url: 'https://img.example.com/gallery.jpg' }],
        address_line: 'ul. Testowa 1',
        city: 'Warszawa',
        phone: '+48600000000',
        social_links: { instagram: '@bonbeauty' }
      })
    );

    const result = await getSellerByHandle('bonbeauty');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('seller-abc');
    expect(result?.handle).toBe('bonbeauty');
    expect(mockResolveHandleToId).toHaveBeenCalledWith('bonbeauty');
    expect(mockFetchSellerById).toHaveBeenCalledWith('seller-abc', expect.stringContaining('+created_at'));
  });

  it('enriches missing media from the handle profile fallback', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller({ photo: '', gallery: null }));
    mockFetchSellerProfileByHandle.mockResolvedValue(
      makeSeller({
        photo: 'https://img.example.com/profile.jpg',
        gallery: [{ url: 'https://img.example.com/gallery.jpg' }],
        address_line: 'ul. Profilowa 2',
        city: 'Warszawa',
        phone: '+48600000000',
        social_links: { instagram: '@bonbeauty' }
      })
    );

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.photo).toBe('https://img.example.com/profile.jpg');
    expect(result?.gallery).toEqual([{ url: 'https://img.example.com/gallery.jpg' }]);
    expect(mockFetchSellerProfileByHandle).toHaveBeenCalledWith('bonbeauty', 'pl-PL');
  });

  it('enriches opening hours and SEO from the handle profile when native seller omits them', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(
      makeSeller({
        gallery: [{ url: 'https://img.example.com/base-gallery.jpg' }],
        address_line: 'ul. Bazowa 1',
        city: 'Warszawa',
        phone: '+48600000000',
        social_links: { instagram: '@bonbeauty' },
        opening_hours: null,
        seo: null
      })
    );
    mockFetchSellerProfileByHandle.mockResolvedValue(
      makeSeller({
        opening_hours: {
          monday: { open: '10:00', close: '19:00' },
          sunday: null
        },
        seo: {
          meta_title: 'BonBeauty Studio',
          meta_description: 'Realny profil salonu',
          og_image_url: 'https://img.example.com/og.jpg'
        }
      })
    );

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.opening_hours).toEqual({
      monday: { open: '10:00', close: '19:00' },
      sunday: null
    });
    expect(result?.seo).toEqual({
      meta_title: 'BonBeauty Studio',
      meta_description: 'Realny profil salonu',
      og_image_url: 'https://img.example.com/og.jpg'
    });
    expect(mockFetchSellerProfileByHandle).toHaveBeenCalledWith('bonbeauty', 'pl-PL');
  });

  it('returns null when handle is not found (resolveSellerHandleToId returns null)', async () => {
    mockResolveHandleToId.mockResolvedValue(null);

    const result = await getSellerByHandle('nonexistent-handle');

    expect(result).toBeNull();
    // fetchSellerById should NOT be called if handle resolution failed
    expect(mockFetchSellerById).not.toHaveBeenCalled();
  });

  it('returns null when fetchSellerById returns null (seller id not found)', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(null);

    const result = await getSellerByHandle('bonbeauty');

    expect(result).toBeNull();
  });

  it('sorts reviews by created_at desc (preserves existing consumer contract)', async () => {
    const reviews = [
      { created_at: '2024-01-01T00:00:00Z', rating: 4 },
      { created_at: '2024-03-01T00:00:00Z', rating: 5 },
      { created_at: '2024-02-01T00:00:00Z', rating: 3 }
    ];

    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller({ reviews }));

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.reviews).toHaveLength(3);
    // Sorted desc: March > February > January
    expect((result?.reviews as Array<{ created_at: string }>)?.[0]?.created_at).toBe(
      '2024-03-01T00:00:00Z'
    );
    expect((result?.reviews as Array<{ created_at: string }>)?.[2]?.created_at).toBe(
      '2024-01-01T00:00:00Z'
    );
  });

  it('filters null reviews from array', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(
      makeSeller({ reviews: [{ created_at: '2024-01-01T00:00:00Z' }, null, null] })
    );

    const result = await getSellerByHandle('bonbeauty');

    // Null reviews filtered out
    expect(result?.reviews).toHaveLength(1);
  });

  it('returns seller with empty reviews when reviews is empty array', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller({ reviews: [] }));

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.reviews).toEqual([]);
  });

  it('passes enriched (reviews-free) fields string to fetchSellerById', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller());

    await getSellerByHandle('bonbeauty');

    const fieldsArg = mockFetchSellerById.mock.calls[0][1] as string;
    expect(fieldsArg).toContain('+email');
    expect(fieldsArg).toContain('+phone');
    expect(fieldsArg).toContain('+social_links');
    expect(fieldsArg).toContain('+gallery');
    // `reviews` is NOT an expandable relation on /store/sellers/:id (no
    // seller↔review module link) — requesting it 500s the endpoint, so it is
    // omitted. seller.reviews was already empty in production (the 500 forced
    // the reviews-free fallback), so dropping the expansion is behavior-preserving.
    expect(fieldsArg).not.toContain('reviews');
  });

  it('retries without reviews when expanded seller fetch fails', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValueOnce(null).mockResolvedValueOnce(makeSeller());

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.id).toBe('seller-abc');
    expect(mockFetchSellerById).toHaveBeenCalledTimes(2);
    expect(mockFetchSellerById.mock.calls[1][1]).not.toContain('reviews');
    expect(mockFetchSellerSummaryByHandle).not.toHaveBeenCalled();
  });

  it('falls back to handle summary when both id-based fetches fail', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mockFetchSellerSummaryByHandle.mockResolvedValue(makeSeller({ reviews: undefined }));

    const result = await getSellerByHandle('bonbeauty');

    expect(result?.handle).toBe('bonbeauty');
    expect(result?.reviews).toEqual([]);
    expect(mockFetchSellerSummaryByHandle).toHaveBeenCalledWith(
      'bonbeauty',
      expect.not.stringContaining('reviews')
    );
  });
});
