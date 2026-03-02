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

export function getMarketId(): string {
  return process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID || '';
}

/**
 * Filter Medusa API items by metadata.gp.market_id.
 * Works with any item type — accesses metadata via runtime optional chaining.
 * Emits a warning when items are filtered out to aid debugging.
 */
export function filterByMarket<T>(items: T[], marketId: string): T[] {
  if (!marketId) return items; // dev fallback: no market_id = no filtering

  const filtered = items.filter(item => {
    const anyItem = item as { metadata?: Record<string, unknown> };
    const gpMeta = anyItem.metadata?.gp as Record<string, unknown> | undefined;
    return gpMeta?.market_id === marketId;
  });

  if (filtered.length < items.length) {
    console.warn(
      `[market-filter] ${items.length - filtered.length} item(s) removed for market "${marketId}" — run sync-catalog to set metadata.gp.market_id`
    );
  }

  return filtered;
}
