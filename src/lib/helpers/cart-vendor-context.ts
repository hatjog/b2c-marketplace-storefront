/**
 * cart-vendor-context — read/write helper dla seller context preserved
 * w cart line item metadata (Option A — backend persisted) z localStorage
 * fallback (Option B — graceful degradation gdy backend strip metadata
 * lub SSR-only render path).
 *
 * Story: v160-5-5-vendor-context-preservation-cart
 *
 * Decision (Story 5.5 T2.4 audit): **Option A** preferred.
 *  - `@medusajs/types` `StoreCartLineItem` exposes `metadata?: Record<string, unknown> | null`
 *    (node_modules/@medusajs/types/dist/http/cart/common.d.ts:271)
 *  - `StoreAddCartLineItem` payload exposes `metadata?: Record<string, unknown>`
 *    (node_modules/@medusajs/types/dist/http/cart/store/payloads.d.ts:41,77)
 *  - Mercur 2.1.1 inherits Medusa cart workflows → metadata pass-through expected
 *
 * Option B (localStorage map) retained jako defensive fallback gdy:
 *  - backend stripuje custom metadata keys post-create
 *  - SSR-only render gdzie metadata read miss (np. dev preview)
 *
 * SSR safety: helpers gracefully early-return null gdy `typeof window === 'undefined'`
 * lub localStorage throws (private browsing / quota exceeded).
 */

import type { HttpTypes } from '@medusajs/types';

const LOCALSTORAGE_KEY = 'gp_cart_seller_map';

export interface SelectedSellerContext {
  id: string;
  name: string;
}

/**
 * Read selected seller context z line item metadata (Option A) z fallback
 * do localStorage map (Option B). Returns null gdy obie ścieżki puste lub
 * unavailable (SSR / corrupt JSON / no seller context).
 *
 * @param item - Medusa StoreCartLineItem (lub partial; defensive na null/undefined fields)
 */
export const readSelectedSeller = (
  item: Pick<HttpTypes.StoreCartLineItem, 'id' | 'metadata'>
): SelectedSellerContext | null => {
  // Option A: backend persisted metadata
  const metadata = item.metadata as Record<string, unknown> | null | undefined;
  const metaId = typeof metadata?.selected_seller_id === 'string' ? metadata.selected_seller_id : undefined;
  const metaName =
    typeof metadata?.selected_seller_name === 'string' ? metadata.selected_seller_name : undefined;
  if (metaId && metaName) {
    return { id: metaId, name: metaName };
  }

  // Option B fallback: localStorage map keyed by line_item_id
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, SelectedSellerContext>;
    const entry = map[item.id];
    if (entry && typeof entry.id === 'string' && typeof entry.name === 'string') {
      return entry;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Write selected seller context do localStorage map (Option B).
 * Used post-successful addToCart gdy backend metadata path uncertain
 * (defensive belt-and-suspenders) lub gdy backend strip detected.
 *
 * SSR-safe: silent no-op gdy window unavailable lub localStorage throws
 * (private browsing, quota exceeded). Read path gracefully returns null →
 * cart UI degrades do legacy single-vendor display (zero crash).
 */
export const writeSelectedSellerLocal = (
  lineItemId: string,
  ctx: SelectedSellerContext
): void => {
  if (typeof window === 'undefined') return;
  if (!lineItemId || !ctx?.id || !ctx?.name) return;
  try {
    const raw = window.localStorage.getItem(LOCALSTORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, SelectedSellerContext>) : {};
    map[lineItemId] = { id: ctx.id, name: ctx.name };
    window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(map));
  } catch {
    // silently fail — graceful degradation acceptable per AC2
  }
};
