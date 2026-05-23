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

vi.mock('../sdk-adapters/sellers', () => ({
  resolveSellerHandleToId: (...args: unknown[]) => mockResolveHandleToId(...args),
  fetchSellerById: (...args: unknown[]) => mockFetchSellerById(...args),
  fetchSellerSummaryByHandle: (...args: unknown[]) => mockFetchSellerSummaryByHandle(...args)
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
  });

  it('returns seller when handle resolves to id and seller is fetched', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller());

    const result = await getSellerByHandle('bonbeauty');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('seller-abc');
    expect(result?.handle).toBe('bonbeauty');
    expect(mockResolveHandleToId).toHaveBeenCalledWith('bonbeauty');
    expect(mockFetchSellerById).toHaveBeenCalledWith('seller-abc', expect.stringContaining('+created_at'));
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

  it('passes enriched fields string to fetchSellerById', async () => {
    mockResolveHandleToId.mockResolvedValue('seller-abc');
    mockFetchSellerById.mockResolvedValue(makeSeller());

    await getSellerByHandle('bonbeauty');

    const fieldsArg = mockFetchSellerById.mock.calls[0][1] as string;
    expect(fieldsArg).toContain('+email');
    expect(fieldsArg).toContain('+phone');
    expect(fieldsArg).toContain('+social_links');
    expect(fieldsArg).toContain('+reviews.rating');
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
