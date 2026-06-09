import { getSellerByHandle } from '@/lib/data/seller';
import { getSellerReviews, type StoreReviewRecord } from '@/lib/data/reviews';
import type { SellerProps } from '@/types/seller';

type RawSellerReview = StoreReviewRecord & {
  id?: string | null;
  rating?: number | null;
  customer_note?: string | null;
  seller_note?: string | null;
  created_at?: string | null;
  locale?: string | null;
  provenance?: string | null;
  provenance_tag?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

export type SellerReviewSortKey = 'newest' | 'highest' | 'lowest';

type SellerReviewOffer = {
  title?: string | null;
};

export type SellerReviewsSeller = {
  handle: string;
  name: string;
  displayName: string;
  imageUrl: string | null;
  city: string | null;
  district: string | null;
  offers: SellerReviewOffer[];
};

export type SellerReviewItem = {
  id: string;
  author: string;
  rating: number;
  /** null when the review payload does not carry a genuine service reference (L1) */
  serviceName: string | null;
  body: string;
  createdAt: string;
  verifiedVisit: boolean;
  sellerReply: string | null;
  locale: string | null;
  provenance: string | null;
};

export type SellerReviewBreakdownRow = {
  rating: number;
  count: number;
  share: number;
};

export type SellerReviewsSurfaceData = {
  seller: SellerReviewsSeller;
  reviews: SellerReviewItem[];
  totalReviews: number;
  visibleReviews: SellerReviewItem[];
  averageRating: number | null;
  breakdown: SellerReviewBreakdownRow[];
  activeRating: number | null;
  sort: SellerReviewSortKey;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

// FALLBACK_SERVICE_NAMES removed: assigning a service name by positional index
// fabricates a label that has no real link to the service the review is about,
// which conflicts with the HG-6 "real data" requirement. serviceName is now null
// when the review payload does not carry a genuine service reference.
// A future story (e.g. 2.5/2.6) should materialise the review→service relationship
// and pass it through the Store API so this field can be populated from real data.

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRating(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5
    ? Math.round(value)
    : null;
}

function buildAuthorName(review: RawSellerReview) {
  const firstName = normalizeString(review.customer?.first_name);
  const lastName = normalizeString(review.customer?.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return fullName || 'BonBeauty';
}

function buildReviewFromRaw(
  review: RawSellerReview,
  index: number,
  _offers: SellerReviewOffer[]
): SellerReviewItem | null {
  const body = normalizeString(review.customer_note);
  const createdAt = normalizeString(review.created_at);
  const rating = normalizeRating(review.rating);

  if (!body || !createdAt || rating == null) {
    return null;
  }

  return {
    id: normalizeString(review.id) ?? `seller-review-${index + 1}`,
    author: buildAuthorName(review),
    rating,
    // serviceName is null when the review payload does not carry a genuine
    // service reference. Positional fabrication from the offers list was removed
    // (L1 finding) because it showed buyers a label unrelated to the actual
    // reviewed service. UI components should treat null as "not available".
    serviceName: null,
    body,
    createdAt,
    verifiedVisit: true,
    sellerReply: normalizeString(review.seller_note),
    locale:
      normalizeString(review.locale) ??
      normalizeString(review.metadata?.gp?.locale) ??
      normalizeString(review.metadata?.locale),
    provenance:
      normalizeString(review.provenance) ??
      normalizeString(review.provenance_tag) ??
      normalizeString(review.metadata?.gp?.provenance) ??
      normalizeString(review.metadata?.gp?.provenance_tag) ??
      normalizeString(review.metadata?.provenance) ??
      normalizeString(review.metadata?.provenance_tag)
  };
}

function sortReviews(items: SellerReviewItem[], sort: SellerReviewSortKey): SellerReviewItem[] {
  return [...items].sort((left, right) => {
    if (sort === 'highest') {
      if (right.rating !== left.rating) return right.rating - left.rating;
    }

    if (sort === 'lowest') {
      if (left.rating !== right.rating) return left.rating - right.rating;
    }

    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function buildReviewBreakdown(items: SellerReviewItem[]): SellerReviewBreakdownRow[] {
  const total = items.length;

  return [5, 4, 3, 2, 1].map(rating => {
    const count = items.filter(item => item.rating === rating).length;

    return {
      rating,
      count,
      share: total === 0 ? 0 : count / total
    };
  });
}

function paginateReviews(items: SellerReviewItem[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const offset = (safePage - 1) * pageSize;

  return {
    visibleReviews: items.slice(offset, offset + pageSize),
    page: safePage,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPreviousPage: safePage > 1
  };
}

function mapSellerForReviewsSurface(seller: SellerProps): SellerReviewsSeller {
  return {
    handle: seller.handle,
    name: seller.name,
    displayName: seller.name,
    imageUrl: seller.photo || null,
    city: seller.city ?? null,
    district: seller.district ?? null,
    offers: (seller.products ?? []).map(product => ({ title: product.title }))
  };
}

async function loadReviewSource(sourceSeller: SellerProps, seller: SellerReviewsSeller) {
  const response = await getSellerReviews(sourceSeller.id);

  return response.reviews
    .map((review, index) => buildReviewFromRaw(review, index, seller.offers))
    .filter((review): review is SellerReviewItem => review !== null);
}

export async function getSellerReviewsSurfaceData({
  handle,
  locale,
  countryCode,
  currencyCode,
  sort = 'newest',
  rating,
  page = 1,
  pageSize = 6
}: {
  handle: string;
  locale: string;
  countryCode: string;
  currencyCode: string;
  sort?: SellerReviewSortKey;
  rating?: number | null;
  page?: number;
  pageSize?: number;
}): Promise<SellerReviewsSurfaceData | null> {
  void locale;
  void countryCode;
  void currencyCode;

  const sourceSeller = await getSellerByHandle(handle);

  if (!sourceSeller) {
    return null;
  }

  const seller = mapSellerForReviewsSurface(sourceSeller);
  const reviews = await loadReviewSource(sourceSeller, seller);
  const filteredReviews =
    rating && rating >= 1 && rating <= 5
      ? reviews.filter(review => review.rating === rating)
      : reviews;
  const sortedReviews = sortReviews(filteredReviews, sort);
  const {
    visibleReviews,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    page: safePage
  } = paginateReviews(sortedReviews, page, pageSize);

  return {
    seller,
    reviews,
    totalReviews: reviews.length,
    visibleReviews,
    averageRating:
      reviews.length > 0
        ? Number(
            (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)
          )
        : null,
    breakdown: buildReviewBreakdown(reviews),
    activeRating: rating && rating >= 1 && rating <= 5 ? rating : null,
    sort,
    page: safePage,
    pageSize,
    totalPages,
    hasNextPage,
    hasPreviousPage
  };
}
