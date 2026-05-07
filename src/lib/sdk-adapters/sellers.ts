/**
 * Seller adapters — Path B (story v160-cleanup-28, TF-50/TF-51).
 *
 * Wraps `mercurClient.store.sellers.*` (Mercur 2.x typed proxy) and exposes
 * stable, typed signatures matching the GP storefront domain types.
 *
 * AC2: adapter module under sdk-adapters/ providing Path B wrappers.
 * AC4: `getSellerByHandle` resolved via Option B (handle→id list-with-filter
 *       + Next.js unstable_cache with 10-min TTL).
 *
 * Replaces the legacy `sdk.client.fetch('/store/seller/:handle')` callsite
 * in `lib/data/seller.ts` (Mercur 1.5 singular path that 404s against
 * Mercur 2 backends).
 *
 * @see TF-50 (Path B migration ratio)
 * @see TF-51 (getSellerByHandle shape-break)
 */

import { unstable_cache } from 'next/cache';

import type { SellerProps } from '@/types/seller';

import { mercurClient } from '../config';

/**
 * Internal Mercur 2 seller list item shape returned by `/store/sellers`.
 * `mercurClient` is `any` at runtime (no Routes codegen yet); this type
 * documents the observed wire shape.
 */
type SellerListApiItem = {
  id: string;
  handle: string;
  name: string;
  photo?: string | null;
  description?: string | null;
  city?: string | null;
  product_count?: number;
  avg_rating?: number | null;
  review_count?: number | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  store_status?: string | null;
  social_links?: Record<string, string | null> | null;
  gallery?: Array<{ url: string; alt?: string | null; is_primary?: boolean | null }> | null;
  opening_hours?: Record<string, { open: string; close: string } | null> | null;
  locations?: Array<{
    city?: string | null;
    address_line?: string | null;
    postal_code?: string | null;
    country_code?: string | null;
  }> | null;
  tax_id?: string | null;
  created_at?: string;
  reviews?: unknown[];
};

/**
 * Fetch seller ID by handle using Mercur 2 `/store/sellers?handle=:handle`.
 *
 * Mercur 2 `/store/sellers/:id` is ID-only. The list endpoint supports
 * `handle` as a filter param (verified against Mercur 2.1.1 validators.d.ts).
 * This resolver is cached via Next.js `unstable_cache` with a 10-min TTL
 * and `sellers` tag for on-demand revalidation.
 *
 * Replaces legacy: `sdk.client.fetch('/store/seller/:handle')` (Mercur 1.5 path).
 * @see TF-51 (getSellerByHandle shape-break, Option B)
 */
export const resolveSellerHandleToId = unstable_cache(
  async (handle: string): Promise<string | null> => {
    try {
      // Note: no inner `cache: 'no-cache'` — outer `unstable_cache`
      // memoizes per-handle for 600s; underlying HTTP cache is harmless
      // within that window and reduces backend pressure on cache misses.
      // cleanup-28 review CACHE-2.
      const result = (await mercurClient.store.sellers.query({
        handle,
        limit: 1
      })) as { sellers?: SellerListApiItem[] };
      return result?.sellers?.[0]?.id ?? null;
    } catch (err) {
      // cleanup-28 review CACHE-1: surface adapter failures to server logs
      // / Sentry instead of swallowing silently. Distinguishes "backend
      // down" from "handle not found" in production diagnostics.
      console.error('[sdk-adapters/sellers] resolveSellerHandleToId failed', {
        handle,
        error: err instanceof Error ? err.message : String(err)
      });
      return null;
    }
  },
  ['seller-handle-to-id'],
  { revalidate: 600, tags: ['sellers'] }
);

/**
 * Fetch full seller details by ID via Mercur 2 typed proxy.
 *
 * Calls `/store/sellers/:id` (Mercur 2.x native endpoint).
 * Replaces legacy: `sdk.client.fetch('/store/seller/:id')` (Mercur 1.5).
 *
 * @param id Seller ID (use `resolveSellerHandleToId` to resolve from handle)
 * @param fields Optional `+field1,+field2` Medusa fields string for enriched data
 * @returns SellerProps or null on 404/error
 * @see TF-50 (Path B migration), TF-51 (getSellerByHandle resolution)
 */
export async function fetchSellerById(
  id: string,
  fields?: string
): Promise<SellerProps | null> {
  try {
    // Mercur 2 proxy: `mercurClient.store.sellers.$id.query({ $id: id })`
    // builds URL `/store/sellers/:id` — `$id` segment is substituted from
    // the `$id` key in the params object per @mercurjs/client proxy convention.
    //
    // TODO (cleanup-28 review TYPE-1): `$id as any` cast required because
    // `@mercurjs/client@2.1.1` proxy typings don't expose `$id` segment on
    // `sellers.store`. Cast point is the single migration boundary; revisit
    // once Mercur 2 client codegen lands typed proxy support (likely v1.7.0+).
    // Dropped inner `cache: 'no-cache'` — Next default fetch cache is the
    // right tier for ID-stable seller-detail reads. cleanup-28 review CACHE-2.
    const result = (await (mercurClient.store.sellers.$id as any).query({
      $id: id,
      ...(fields ? { fields } : {})
    })) as { seller?: SellerListApiItem };
    const s = result?.seller;
    if (!s) return null;
    return mapSellerApiToProps(s);
  } catch (err) {
    // cleanup-28 review CACHE-1: log instead of silent swallow.
    console.error('[sdk-adapters/sellers] fetchSellerById failed', {
      id,
      error: err instanceof Error ? err.message : String(err)
    });
    return null;
  }
}

/**
 * Map Mercur 2 seller API item to GP `SellerProps` domain type.
 */
function mapSellerApiToProps(s: SellerListApiItem): SellerProps {
  return {
    id: s.id,
    name: s.name,
    handle: s.handle,
    description: s.description ?? '',
    photo: s.photo ?? '',
    tax_id: s.tax_id ?? '',
    created_at: s.created_at ?? '',
    reviews: Array.isArray(s.reviews) ? s.reviews : [],
    email: s.email ?? undefined,
    phone: s.phone ?? undefined,
    status: s.status as SellerProps['status'],
    store_status: s.store_status as SellerProps['store_status'],
    social_links: s.social_links as SellerProps['social_links'] ?? null,
    gallery: s.gallery ?? null,
    opening_hours: s.opening_hours as SellerProps['opening_hours'] ?? null,
    locations: s.locations ?? null,
    city: s.city ?? undefined,
    address_line: undefined,
    postal_code: undefined,
    country_code: undefined
  };
}
