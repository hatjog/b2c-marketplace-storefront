import type { SellerProps } from '@/types/seller';

import { mercurClient } from '../config';
import { haversineKm } from '../helpers/distance';
import {
  fetchSellerById,
  fetchSellerProfileByHandle,
  fetchSellerSummaryByHandle,
  resolveSellerHandleToId
} from '../sdk-adapters/sellers';
import { withMercurLocaleOptions } from '../sdk/locale-interceptor';

export interface SellerListItem {
  handle: string;
  name: string;
  photo_url: string | null;
  city: string | null;
  district?: string | null;
  product_count: number;
  avg_rating?: number | null;
  review_count?: number | null;
  /**
   * Story v160-4-2: optional geo coords for SellerMap markers. Mercur 2.1.1
   * `/store/sellers` does not yet expose lat/lng — type augmented as optional;
   * SellerMap defensively filters sellers w/o valid finite coords. Backend
   * exposure tracked under Story 4.x follow-up.
   */
  lat?: number | null;
  lng?: number | null;
  /**
   * Optional human-readable address for marker popup. Falls back to i18n
   * `seller.list.map.popup_address` when absent.
   */
  address?: string | null;
}

type SellerApiItem = {
  handle: string;
  name: string;
  photo?: string | null;
  city?: string | null;
  product_count?: number;
  avg_rating?: number | null;
  review_count?: number | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  district?: string | null;
};

/**
 * Path B (story v160-2-6): migrated from `sdk.client.fetch('/store/seller')`
 * (Mercur 1.5 singular path) to `mercurClient.store.sellers.query()` (Mercur
 * 2.1.1 native plural path). Until backend codegen lands `@mercurjs/core/_generated`
 * Routes the client is `any` — typing is enforced via the local
 * `{ sellers: SellerApiItem[] }` cast.
 */
export const getSellers = async (): Promise<SellerListItem[]> => {
  return (
    mercurClient.store.sellers.query(
      await withMercurLocaleOptions({ fetchOptions: { cache: 'no-cache' } })
    ) as Promise<{ sellers: SellerApiItem[] }>
  )
    .then(({ sellers }) => {
      const mapped: SellerListItem[] = (sellers ?? []).map(v => ({
        handle: v.handle,
        name: v.name,
        photo_url: v.photo ?? null,
        city: v.city ?? null,
        product_count: v.product_count ?? 0,
        avg_rating: typeof v.avg_rating === 'number' ? v.avg_rating : null,
        review_count: typeof v.review_count === 'number' ? v.review_count : null,
        lat: typeof v.lat === 'number' ? v.lat : null,
        lng: typeof v.lng === 'number' ? v.lng : null,
        address: v.address ?? null,
        district: v.district ?? null
      }));

      return mapped.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
    })
    .catch(() => []);
};

/**
 * Story v160-4-1: search/filter/sort over sellers list.
 *
 * Strategy: client-side filter on top of full list returned by
 * `mercurClient.store.sellers.query()`. Mercur 2.1.1 backend SDK does not
 * expose typed `q`, `city`, `order` params in `@mercurjs/core/_generated`
 * Routes (verified pre-impl T2.4) — typed surface returns `any`. Until backend
 * types stabilize and codegen catches up, we run the filter pipeline
 * post-fetch in this server component data layer (acceptable for <1000
 * sellers MVP per Story 4.1 Dev Notes "Pagination strategy: limit+offset vs
 * cursor"). When backend exposes native query params (story 4.x follow-up)
 * this function migrates to server-side filtering — call sites stay stable.
 */
export type SellerSortKey = 'rating_desc' | 'name_asc' | 'name_desc';

export interface SearchSellersArgs {
  q?: string;
  city?: string;
  sort?: SellerSortKey;
  limit: number;
  offset: number;
  /**
   * Story v160-4-3 — geolocation "Blisko mnie" filter (REUSE Story 5.3
   * `haversineKm`). When all three of `userLat`, `userLng`, `radiusKm` are
   * defined, the post-filter pipeline keeps only sellers whose distance to
   * (userLat, userLng) is ≤ radiusKm. Sellers without finite `lat`/`lng`
   * are excluded from the near-me result (defensive — we don't surface a
   * salon when we don't know where it is).
   *
   * v1.6.0 backend caveat: Mercur 2.1.1 does NOT yet expose `lat`/`lng` on
   * `/store/sellers` (DRAFT — same blocker as `vendor_offer.seller_lat` in
   * Story 5.3). When that pipeline lands empty (zero coords on the wire),
   * the near-me filter naturally returns 0 items → the page renders the
   * `no_results_in_radius` empty state. Acceptable degradation for MVP.
   */
  userLat?: number;
  userLng?: number;
  radiusKm?: number;
}

export interface SearchSellersResult {
  items: SellerListItem[];
  total: number;
}

export const searchSellers = async ({
  q,
  city,
  sort = 'name_asc',
  limit,
  offset,
  userLat,
  userLng,
  radiusKm
}: SearchSellersArgs): Promise<SearchSellersResult> => {
  // Defensive try/catch: getSellers() is `async` and already has its own
  // `.catch(() => [])`, but mercurClient.store.sellers.query() can throw
  // synchronously when backend is unreachable (ECONNREFUSED) before a
  // Promise materializes. Belt + braces — keep page renderable.
  let all: SellerListItem[] = [];
  try {
    all = await getSellers();
  } catch {
    all = [];
  }

  const queryNeedle = q?.trim().toLowerCase() ?? '';
  const cityNeedle = city?.trim().toLowerCase() ?? '';

  let filtered = all;
  if (queryNeedle) {
    filtered = filtered.filter(
      s =>
        s.name.toLowerCase().includes(queryNeedle) || s.handle.toLowerCase().includes(queryNeedle)
    );
  }
  if (cityNeedle) {
    filtered = filtered.filter(s => (s.city ?? '').toLowerCase().includes(cityNeedle));
  }

  // Story v160-4-3 — geolocation post-filter. AR48: client-side filter
  // pipeline at the server data-layer (NOT browser); zero new fetch calls.
  const nearMeActive =
    typeof userLat === 'number' &&
    typeof userLng === 'number' &&
    typeof radiusKm === 'number' &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    Number.isFinite(radiusKm) &&
    radiusKm > 0;

  let withDistance: Array<SellerListItem & { _distanceKm?: number }> = filtered;
  if (nearMeActive) {
    withDistance = filtered
      .filter(
        (s): s is SellerListItem & { lat: number; lng: number } =>
          typeof s.lat === 'number' &&
          typeof s.lng === 'number' &&
          Number.isFinite(s.lat) &&
          Number.isFinite(s.lng)
      )
      .map(s => ({
        ...s,
        _distanceKm: haversineKm(
          userLat as number,
          userLng as number,
          s.lat as number,
          s.lng as number
        )
      }))
      .filter(
        s => Number.isFinite(s._distanceKm) && (s._distanceKm as number) <= (radiusKm as number)
      );
  }

  const sorted = [...withDistance].sort((a, b) => {
    if (nearMeActive) {
      // When near-me is active, distance ASC dominates unless user explicitly
      // chose a non-default sort key. Default is name_asc; we override it to
      // distance-first because the very point of the filter is proximity.
      const aDist = a._distanceKm ?? Number.POSITIVE_INFINITY;
      const bDist = b._distanceKm ?? Number.POSITIVE_INFINITY;
      if (sort === 'name_asc' || sort === 'name_desc') {
        // Distance wins when default sort. If user picked name_desc explicitly,
        // honor it — same precedent as Story 5.3 SellerSelector.
        if (sort === 'name_asc') {
          if (aDist !== bDist) return aDist - bDist;
        }
      }
    }
    if (sort === 'rating_desc') {
      const aRating = typeof a.avg_rating === 'number' ? a.avg_rating : Number.NEGATIVE_INFINITY;
      const bRating = typeof b.avg_rating === 'number' ? b.avg_rating : Number.NEGATIVE_INFINITY;
      if (aRating !== bRating) {
        return bRating - aRating;
      }

      const aReviewCount =
        typeof a.review_count === 'number' ? a.review_count : Number.NEGATIVE_INFINITY;
      const bReviewCount =
        typeof b.review_count === 'number' ? b.review_count : Number.NEGATIVE_INFINITY;
      if (aReviewCount !== bReviewCount) {
        return bReviewCount - aReviewCount;
      }
    }

    const cmp = a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
    return sort === 'name_desc' ? -cmp : cmp;
  });

  // Strip internal _distanceKm before returning to keep public type stable.
  const items = sorted.slice(offset, offset + limit).map(({ _distanceKm: _drop, ...rest }) => rest);

  return {
    items,
    total: sorted.length
  };
};

/**
 * Resolve a seller by handle via Path B (story v160-cleanup-28, TF-51 — Option B).
 *
 * Mercur 2.1.1 `/store/sellers/:id` is ID-only; there is no native
 * `/store/sellers/by-handle/:handle` endpoint. This function implements
 * Option B: two-step resolution with Next.js `unstable_cache` TTL.
 *
 *   1. List `/store/sellers?handle=:handle` (Mercur 2 list supports handle filter)
 *      → cache handle→id mapping for 10 min via `resolveSellerHandleToId`.
 *   2. Fetch `/store/sellers/:id` (native Mercur 2 endpoint) via `fetchSellerById`.
 *
 * Returns `null` on any error (404, network failure, handle not found).
 *
 * Replaces legacy: `sdk.client.fetch('/store/seller/:handle')` (Mercur 1.5 path
 * that 404s against Mercur 2 backends — TF-51 shape-break).
 *
 * @see TF-51 (getSellerByHandle shape-break, Option B chosen)
 * @see sdk-adapters/sellers.ts (resolveSellerHandleToId, fetchSellerById)
 */
export const getSellerByHandle = async (handle: string): Promise<SellerProps | null> => {
  // `reviews.*` is intentionally NOT expanded here: `reviews` is not a
  // populatable relation on the Mercur 2 `/store/sellers/:id` endpoint (no
  // seller↔review module link), so requesting it makes mikro-orm throw
  // (`expandDotPaths` → HTTP 500) and forced a wasteful fallback re-fetch on
  // every seller page load. Removing it is behavior-preserving: that 500 meant
  // the primary fetch already fell through to the reviews-free SAFE fetch, so
  // `seller.reviews` was always `[]` in production. The seller-facing review
  // surfaces (SellerReviewTab and /sellers/[handle]/reviews via
  // getSellerReviewsSurfaceData) now derive reviews via the dedicated
  // `/store/reviews?seller_id=...` endpoint (wired in Story 2.4). The
  // `/store/reviews` endpoint (without filters) is still consumed by the user
  // written-reviews page at /user/reviews/written; as of Story 2.4 that
  // unfiltered call returns only product-scoped reviews — seller reviews require
  // an explicit seller_id filter. Mirrors the `*seller.reviews` constraint
  // documented for /store/products in lib/data/products.ts.
  const SELLER_FIELDS =
    '+created_at,+email,+phone,+logo,+metadata,+social_links,+gallery';
  // Retained as the resilient fallback field set for any other transient 5xx
  // on the primary fetch (already reviews-free given the literal above).
  const SAFE_SELLER_FIELDS = SELLER_FIELDS.split(',')
    .filter(field => !field.includes('reviews'))
    .join(',');

  const normalizeSeller = (seller: SellerProps): SellerProps => ({
    ...seller,
    reviews:
      (seller.reviews as Array<{ created_at: string }> | undefined)
        ?.filter(item => item !== null)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? []
  });

  const mergeSellerProfile = (base: SellerProps, profile: SellerProps | null): SellerProps => {
    if (!profile) return base;
    return normalizeSeller({
      ...base,
      description: base.description || profile.description,
      photo: base.photo || profile.photo,
      email: base.email ?? profile.email,
      phone: base.phone ?? profile.phone,
      social_links: base.social_links ?? profile.social_links,
      gallery: base.gallery ?? profile.gallery,
      opening_hours: base.opening_hours ?? profile.opening_hours,
      locations: base.locations ?? profile.locations,
      city: base.city ?? profile.city,
      address_line: base.address_line ?? profile.address_line,
      postal_code: base.postal_code ?? profile.postal_code,
      country_code: base.country_code ?? profile.country_code,
      district: base.district ?? profile.district,
      lat: base.lat ?? profile.lat,
      lng: base.lng ?? profile.lng,
      tax_id: base.tax_id || profile.tax_id,
      regon: base.regon ?? profile.regon,
      krs: base.krs ?? profile.krs
    });
  };

  const needsProfileEnrichment = (seller: SellerProps): boolean =>
    !seller.photo ||
    !seller.gallery?.length ||
    !seller.address_line ||
    !seller.city ||
    !seller.phone ||
    !seller.social_links;

  const id = await resolveSellerHandleToId(handle);
  if (!id) return null;

  const seller = await fetchSellerById(id, SELLER_FIELDS);
  if (seller) {
    const normalized = normalizeSeller(seller);
    return needsProfileEnrichment(normalized)
      ? mergeSellerProfile(normalized, await fetchSellerProfileByHandle(handle))
      : normalized;
  }

  const sellerWithoutReviews = await fetchSellerById(id, SAFE_SELLER_FIELDS);
  if (sellerWithoutReviews) {
    const normalized = normalizeSeller(sellerWithoutReviews);
    return needsProfileEnrichment(normalized)
      ? mergeSellerProfile(normalized, await fetchSellerProfileByHandle(handle))
      : normalized;
  }

  const sellerSummary = await fetchSellerSummaryByHandle(handle, SAFE_SELLER_FIELDS);
  if (sellerSummary) {
    const normalized = normalizeSeller(sellerSummary);
    return needsProfileEnrichment(normalized)
      ? mergeSellerProfile(normalized, await fetchSellerProfileByHandle(handle))
      : normalized;
  }

  return (await fetchSellerProfileByHandle(handle)) ?? null;
};
