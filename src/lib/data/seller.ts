import type { SellerProps } from '@/types/seller';

import { mercurClient, sdk } from '../config';

export interface SellerListItem {
  handle: string;
  name: string;
  photo_url: string | null;
  city: string | null;
  product_count: number;
}

type SellerApiItem = {
  handle: string;
  name: string;
  photo?: string | null;
  city?: string | null;
  product_count?: number;
};

/**
 * Path B (story v160-2-6): migrated from `sdk.client.fetch('/store/seller')`
 * (Mercur 1.5 singular path) to `mercurClient.store.sellers.query()` (Mercur
 * 2.1.1 native plural path). Until backend codegen lands `@mercurjs/core/_generated`
 * Routes the client is `any` — typing is enforced via the local
 * `{ sellers: SellerApiItem[] }` cast.
 */
export const getSellers = async (): Promise<SellerListItem[]> => {
  return (mercurClient.store.sellers.query({ fetchOptions: { cache: 'no-cache' } }) as Promise<{ sellers: SellerApiItem[] }>)
    .then(({ sellers }) => {
      const mapped: SellerListItem[] = (sellers ?? []).map(v => ({
        handle: v.handle,
        name: v.name,
        photo_url: v.photo ?? null,
        city: v.city ?? null,
        product_count: v.product_count ?? 0
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
export type SellerSortKey = 'name_asc' | 'name_desc';

export interface SearchSellersArgs {
  q?: string;
  city?: string;
  sort?: SellerSortKey;
  limit: number;
  offset: number;
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
  offset
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
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(queryNeedle) ||
      s.handle.toLowerCase().includes(queryNeedle)
    );
  }
  if (cityNeedle) {
    filtered = filtered.filter(s =>
      (s.city ?? '').toLowerCase().includes(cityNeedle)
    );
  }

  const sorted = [...filtered].sort((a, b) => {
    const cmp = a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' });
    return sort === 'name_desc' ? -cmp : cmp;
  });

  return {
    items: sorted.slice(offset, offset + limit),
    total: sorted.length
  };
};

/**
 * Mercur 2.1.1 native `/store/sellers/:id` accepts ID-only (NOT handle). The
 * Mercur 1.5 contract supported handle lookup via `/store/seller/:handle` —
 * Mercur 2 dropped that overload. Until a GP backend extension restores the
 * handle path (story 2.7 follow-up) this fetcher continues to call the
 * legacy path through `sdk.client.fetch`. The path WILL 404 against a fresh
 * Mercur 2 backend; consumers (`/[locale]/sellers/[handle]`) should expect
 * graceful degradation (`null` return) until 2.7 lands the rewrite.
 */
export const getSellerByHandle = async (handle: string) => {
  return sdk.client
    .fetch<{ seller: SellerProps }>(`/store/seller/${handle}`, {
      query: {
        fields:
          '+created_at,+email,+phone,+social_links,+reviews.seller.name,+reviews.rating,+reviews.customer_note,+reviews.seller_note,+reviews.created_at,+reviews.updated_at,+reviews.customer.first_name,+reviews.customer.last_name'
      },
      cache: 'no-cache'
    })
    .then(({ seller }) => {
      const response = {
        ...seller,
        reviews:
          seller.reviews
            ?.filter(item => item !== null)
            .sort((a, b) => b.created_at.localeCompare(a.created_at)) ?? []
      };

      return response as SellerProps;
    })
    .catch(() => null);
};
