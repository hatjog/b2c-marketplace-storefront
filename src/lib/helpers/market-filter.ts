/**
 * Client-side market data guard utilities.
 *
 * NOTE (build-time constraint): NEXT_PUBLIC_PAYLOAD_MARKET_ID is embedded by
 * Next.js at build time, not resolved at runtime. Changing the active market
 * for a deployment requires a full rebuild.
 *
 * Usage: filterByMarket(items, getMarketId())
 * Fallback: when market_id is empty (dev/unset env), all items pass through.
 */

import { getGpMetadata } from './metadata-utils';

export function getMarketId(): string {
  return process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
}

function readGpMarketId(item: unknown): string | null {
  if (!item || typeof item !== 'object') {
    return null
  }

  const anyItem = item as { metadata?: Record<string, unknown> }
  const gpMeta = getGpMetadata<Record<string, unknown>>(anyItem.metadata)
  const marketId = gpMeta?.market_id

  return typeof marketId === 'string' && marketId.length > 0 ? marketId : null
}

/**
 * Filter Medusa API items by metadata.gp.market_id.
 * Works with any item type — accesses metadata via runtime optional chaining.
 * Emits a warning when items are filtered out to aid debugging.
 */
export function filterByMarket<T>(items: T[], marketId: string): T[] {
  if (!marketId) return items; // dev fallback: no market_id = no filtering

  const filtered = items.filter(item => {
    return readGpMarketId(item) === marketId
  });

  if (filtered.length < items.length) {
    console.warn(
      `[market-filter] ${items.length - filtered.length} item(s) removed for market "${marketId}" — run sync-catalog to set metadata.gp.market_id`
    );
  }

  return filtered;
}

export function filterByMarketOrKeepUntagged<T>(items: T[], marketId: string): T[] {
  if (!marketId) {
    return items
  }

  const filtered = filterByMarket(items, marketId)
  if (filtered.length > 0) {
    return filtered
  }

  const hasTaggedItems = items.some(item => readGpMarketId(item) !== null)
  return hasTaggedItems ? filtered : items
}

export function selectMarketScopedItem<T>(items: T[], marketId: string): T | undefined {
  return filterByMarketOrKeepUntagged(items, marketId)[0]
}
