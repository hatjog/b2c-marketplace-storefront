import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReviewBreakdown } from './seller-reviews';

vi.mock('server-only', () => ({}));
const { getSellerByHandleMock } = vi.hoisted(() => ({
  getSellerByHandleMock: vi.fn()
}));

vi.mock('./seller', () => ({
  getSellerByHandle: getSellerByHandleMock
}));

describe('seller-reviews helpers', () => {
  beforeEach(() => {
    getSellerByHandleMock.mockReset();
  });

  it('builds a 5..1 breakdown with share percentages', () => {
    const breakdown = buildReviewBreakdown([
      {
        id: '1',
        author: 'A',
        rating: 5,
        serviceName: 'X',
        body: 'Body',
        createdAt: '2026-01-01T10:00:00.000Z',
        verifiedVisit: true,
        sellerReply: null
      },
      {
        id: '2',
        author: 'B',
        rating: 5,
        serviceName: 'Y',
        body: 'Body',
        createdAt: '2026-01-02T10:00:00.000Z',
        verifiedVisit: true,
        sellerReply: null
      },
      {
        id: '3',
        author: 'C',
        rating: 3,
        serviceName: 'Z',
        body: 'Body',
        createdAt: '2026-01-03T10:00:00.000Z',
        verifiedVisit: true,
        sellerReply: null
      }
    ]);

    expect(breakdown.map(row => row.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(breakdown.find(row => row.rating === 5)).toMatchObject({ count: 2 });
    expect(breakdown.find(row => row.rating === 3)).toMatchObject({ count: 1 });
    expect(breakdown.find(row => row.rating === 4)).toMatchObject({ count: 0 });
    expect(breakdown.find(row => row.rating === 5)?.share).toBeCloseTo(2 / 3);
  });

  it('returns zero shares for an empty review list', () => {
    const breakdown = buildReviewBreakdown([]);

    expect(breakdown).toHaveLength(5);
    expect(breakdown.every(row => row.count === 0 && row.share === 0)).toBe(true);
  });

  it('keeps the empty state when live seller reviews resolve to an empty array', async () => {
    getSellerByHandleMock.mockResolvedValue({
      id: 'seller-apteczna-pracownia-kasi',
      handle: 'apteczna-pracownia-kasi',
      name: 'Apteczna Pracownia Kasi',
      description: '',
      photo: '',
      tax_id: '',
      created_at: '2026-01-01T00:00:00.000Z',
      city: 'Warszawa',
      district: 'Centrum',
      products: [],
      reviews: []
    });

    const { getSellerReviewsSurfaceData } = await import('./seller-reviews');
    const result = await getSellerReviewsSurfaceData({
      handle: 'apteczna-pracownia-kasi',
      locale: 'pl',
      countryCode: 'pl',
      currencyCode: 'pln'
    });

    expect(result?.totalReviews).toBe(0);
    expect(result?.visibleReviews).toEqual([]);
    expect(result?.averageRating).toBeNull();
  });
});
