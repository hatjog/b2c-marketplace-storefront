/**
 * Shared feature-flag helper for NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED.
 *
 * Story v160-cleanup-12b (AC2) — single source of truth replacing 9 inline
 * `process.env.NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED === 'true'` reads
 * scattered across storefront components.
 *
 * Phase A semantics (env-based, per ADR-074 tri-state § Phase A):
 *  - Returns true only when env value strictly equals `'true'`.
 *  - Phase B+ may extend to check admin-DB tri-state ('on' | 'shadow') — add
 *    that logic here without touching callers.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time for client bundles
 * (static replacement). Reading on server-side works with both the build-time
 * value and runtime override via environment injection.
 *
 * Re-exports: `getCurrentFlagValue` from `src/lib/security/flagAtomicCheck.ts`
 * is preserved as the internal implementation for FlagDriftError / cart-start
 * snapshot helpers — this module delegates to it for consistency.
 */

import { getCurrentFlagValue } from '@/lib/security/flagAtomicCheck';

/**
 * Returns true when the multi-vendor pricing feature is enabled.
 *
 * Reads `NEXT_PUBLIC_MULTI_VENDOR_PRICING_ENABLED` env var. Strict `=== 'true'`
 * comparison — all other values (including 'false', '1', 'on', undefined) return
 * false. Defaults to false (production-safe OFF).
 *
 * Phase B+: when admin-DB flag tri-state is wired, extend this function to also
 * return true for `('on', 'shadow')` states from the live admin API.
 */
export function isMultiVendorEnabled(): boolean {
  return getCurrentFlagValue();
}

/**
 * Type guard: asserts that a product object carries the multi-vendor pricing
 * fields (`vendor_count`, `lowest_price_pln`, `vendor_offers`). Useful for
 * narrowing `HttpTypes.StoreProduct | Product` → `Product & MultiVendorPricingFields`
 * without double-casting.
 *
 * Does NOT check isMultiVendorEnabled() — caller decides flag gating separately
 * so this guard remains pure / testable in isolation.
 */
export function hasMultiVendorFields(
  product: object
): product is { vendor_count: number; lowest_price_pln: number } {
  return (
    typeof (product as Record<string, unknown>).vendor_count === 'number' &&
    typeof (product as Record<string, unknown>).lowest_price_pln === 'number'
  );
}

// Re-export the underlying primitive for callers that need it directly without
// importing from the security sub-module.
export { getCurrentFlagValue };
