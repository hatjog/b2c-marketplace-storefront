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
  /**
   * Storefront seller handle for `/sellers/{handle}` link target.
   * Optional: Story 5.5 baseline metadata write may not include handle;
   * organism renders link defensively (skip when undefined).
   */
  handle?: string;
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
  const metaHandle =
    typeof metadata?.selected_seller_handle === 'string'
      ? metadata.selected_seller_handle
      : undefined;
  if (metaId && metaName) {
    return metaHandle
      ? { id: metaId, name: metaName, handle: metaHandle }
      : { id: metaId, name: metaName };
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
    map[lineItemId] = { id: ctx.id, name: ctx.name, ...(ctx.handle ? { handle: ctx.handle } : {}) };
    window.localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(map));
  } catch {
    // silently fail — graceful degradation acceptable per AC2
  }
};

/**
 * Story 5.7 — multi-vendor cart grouping primitives.
 *
 * `SellerGroup` reprezentuje jedną sekcję cart UI keyed by seller_id (lub
 * `null` dla default group dla items bez seller context — legacy single-vendor
 * lub addToCart bez selectedSellerId). Helper `groupLineItemsBySeller` jest
 * pure data transform — Server Component + SSR safe via underlying
 * `readSelectedSeller`. Helper `hasMultipleSellers` służy do flag-gated
 * conditional render decision (skip grouping gdy zero items z seller context).
 */
export interface SellerGroup {
  /** seller_id when known; null = default group (no seller context). */
  seller_id: string | null;
  /** seller context when known; null = default group. */
  seller: SelectedSellerContext | null;
  /** line items in this group; non-empty by construction. */
  items: HttpTypes.StoreCartLineItem[];
  /** sum of line item subtotals (minor units, currency-agnostic). */
  subtotal: number;
}

const DEFAULT_GROUP_KEY = '__default';

/**
 * Group cart line items by selected seller context.
 *
 * Deterministic order: alphabetical by seller name; default group last.
 * Pure read — no side effects; safe in Server Component.
 *
 * @param items - StoreCartLineItem[] (cart.items); empty array → empty result
 * @returns ordered SellerGroup[] (alphabetical seller name, default last)
 */
export const groupLineItemsBySeller = (
  items: ReadonlyArray<HttpTypes.StoreCartLineItem>
): SellerGroup[] => {
  const groups = new Map<string, SellerGroup>();
  for (const item of items) {
    const seller = readSelectedSeller(item);
    const key = seller?.id ?? DEFAULT_GROUP_KEY;
    let group = groups.get(key);
    if (!group) {
      group = {
        seller_id: seller?.id ?? null,
        seller,
        items: [],
        subtotal: 0,
      };
      groups.set(key, group);
    }
    group.items.push(item);
    group.subtotal += typeof item.subtotal === 'number' ? item.subtotal : 0;
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.seller_id === null) return 1;
    if (b.seller_id === null) return -1;
    return (a.seller?.name ?? '').localeCompare(b.seller?.name ?? '');
  });
};

/**
 * Detect whether cart has any item z seller metadata. Used dla flag-gated
 * conditional render: gdy zero items mają seller context, grouping yields
 * jedną default group → no UX benefit → flat fallback preferred.
 */
export const hasMultipleSellers = (
  items: ReadonlyArray<HttpTypes.StoreCartLineItem>
): boolean => {
  return items.some((item) => readSelectedSeller(item) !== null);
};
