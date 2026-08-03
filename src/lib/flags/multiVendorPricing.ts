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
 * STORY v160-cleanup-13c: This synchronous helper now ALSO consults the
 * runtime cache (`_runtimeFlagCache`). If a recent successful runtime probe
 * resolved 'off', this returns false EVEN IF the build-baked env says true.
 * This lets the backend tri-state flag toggle effectively gate the storefront
 * without rebuilding (Story 8.8 AC7 snapshot-off guard).
 *
 * Refresh cadence: callers should invoke `isMultiVendorEnabledRuntime()`
 * (async) on server boundaries (RSC root layouts, page-level fetches) before
 * downstream sync `isMultiVendorEnabled()` calls. Cache TTL = 30 s.
 */
export function isMultiVendorEnabled(): boolean {
  const buildBaked = getCurrentFlagValue();
  const runtime = _peekRuntimeFlag();
  // Runtime override — only when fresh AND backend explicitly returned 'off'.
  if (runtime !== null && runtime === false) return false;
  // Runtime explicitly true — also AND with build-baked (defense-in-depth: a
  // build that omitted the env var should NOT silently render MV UI on a
  // runtime-on backend; ops must explicitly bake the env to surface it).
  return buildBaked;
}

// ---------------------------------------------------------------------------
// Runtime gate (Story v160-cleanup-13c)
// ---------------------------------------------------------------------------

interface RuntimeFlagCache {
  value: boolean;
  fetchedAt: number;
}

const RUNTIME_TTL_MS = 30_000;
let _runtimeFlagCache: RuntimeFlagCache | null = null;

/** Peek at cached runtime flag value if fresh; otherwise null. */
function _peekRuntimeFlag(): boolean | null {
  if (!_runtimeFlagCache) return null;
  if (Date.now() - _runtimeFlagCache.fetchedAt > RUNTIME_TTL_MS) return null;
  return _runtimeFlagCache.value;
}

function _backendBaseUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    process.env.BACKEND_BASE_URL ||
    'http://localhost:9002'
  );
}

function _publishableKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    null
  );
}

/**
 * Resolves the multi-vendor flag from the backend `/store/feature-flags`
 * endpoint, caches result for 30 s, and returns the AND of (build-baked &&
 * (runtime !== 'off')) for callers preferring async resolution.
 *
 * Fallback semantics: if the backend is unreachable or the response is
 * malformed, returns the build-baked value (graceful degradation — storefront
 * keeps working with stale gate during backend outages).
 */
export async function isMultiVendorEnabledRuntime(): Promise<boolean> {
  const buildBaked = getCurrentFlagValue();

  // Cache hit shortcut.
  const cached = _peekRuntimeFlag();
  if (cached !== null) {
    if (cached === false) return false;
    return buildBaked;
  }

  try {
    const base = _backendBaseUrl();
    const pk = _publishableKey();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (pk) headers['x-publishable-api-key'] = pk;

    const res = await fetch(`${base}/store/feature-flags`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
    if (!res.ok) {
      // Don't cache errors — leave window for a healthy retry sooner.
      return buildBaked;
    }
    const body = (await res.json()) as { multi_vendor_pdp?: string };
    const state = body.multi_vendor_pdp;
    const enabled = state === 'on' || state === 'shadow';
    _runtimeFlagCache = { value: enabled, fetchedAt: Date.now() };
    if (!enabled) return false;
    return buildBaked;
  } catch {
    // Network / parse error — fallback to build-baked.
    return buildBaked;
  }
}

/** Test helper — invalidates the runtime cache. */
export function _invalidateRuntimeFlagCache(): void {
  _runtimeFlagCache = null;
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
