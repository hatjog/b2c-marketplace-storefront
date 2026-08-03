/**
 * Market-aware locale resolver — Story 1.1 v1.14.0 (FR-4, HG-7; AD-2, ADR-154).
 *
 * Single narrowing point between the compile-time platform superset
 * (`SUPPORTED_LOCALES` in `src/i18n/routing.ts`, ADR-150-4) and the runtime
 * market configuration (`locales` block in market.yaml, read through
 * `MarketRuntimeConfig`). Every consumer that needs "which locales does THIS
 * market expose" (middleware, hreflang/sitemap, footer surfaces, account
 * locale select) MUST import this resolver instead of keeping its own list.
 *
 * Module-level cache (AD-2): deployment is per-market, so a `locales` change
 * in market.yaml takes effect on storefront restart. This is an explicitly
 * accepted trade-off — do NOT "fix" it with a per-request re-read.
 */

import { SUPPORTED_LOCALES, isSupportedLocale, type SupportedLocale } from '@/i18n/routing';
import { readRuntimeMarketConfigOrThrow, resolveRuntimeMarketId } from '@/lib/runtime-market-config';

// Marker prefix for errors raised by `fail()` below — i.e. deterministic
// config-validation failures (bad/missing `locales` block), as opposed to raw
// fs errors surfaced by `readRuntimeMarketConfigOrThrow` (F2: transient I/O).
const VALIDATION_ERROR_PREFIX = '[market-locales]';

function isMarketLocalesValidationError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith(VALIDATION_ERROR_PREFIX);
}

// Key set of `properties.locales` in market-runtime-config.v1.schema.json.
// Drift-tested against the schema (AC4 allowed-keys == schema-properties parity).
export const MARKET_LOCALES_SCHEMA_KEYS = ['default', 'supported', 'fallback_chain'] as const;
export type MarketLocalesSchemaKey = (typeof MARKET_LOCALES_SCHEMA_KEYS)[number];

export type MarketLocales = {
  supported: readonly SupportedLocale[];
  defaultLocale: SupportedLocale;
};

const PLATFORM_SUPERSET = `[${SUPPORTED_LOCALES.join(', ')}]`;

function fail(marketId: string, field: string, problem: string): never {
  throw new Error(
    `[market-locales] market "${marketId}": ${field} ${problem}. ` +
      'Market-aware locale resolution is fail-fast by design (AD-2) — fix the ' +
      '`locales` block in market.yaml instead of relying on a platform fallback.'
  );
}

/**
 * Pure narrowing of a raw `locales` block to the market locale contract.
 * Throws (fail-fast) instead of silently widening or falling back:
 * a market must never expose a locale outside the platform superset
 * (ADR-150-4 / HG-7) and must always declare its own explicit default.
 */
export function narrowMarketLocales(rawLocales: unknown, marketId: string): MarketLocales {
  if (rawLocales === null || rawLocales === undefined) {
    fail(marketId, 'locales', 'block is missing from market.yaml');
  }

  if (typeof rawLocales !== 'object' || Array.isArray(rawLocales)) {
    fail(marketId, 'locales', 'must be a mapping with `default` and `supported`');
  }

  const record = rawLocales as Record<string, unknown>;

  const unknownKeys = Object.keys(record).filter(
    key => !(MARKET_LOCALES_SCHEMA_KEYS as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    fail(
      marketId,
      'locales',
      `contains unknown key(s) [${unknownKeys.join(', ')}] (schema additionalProperties: false)`
    );
  }

  const rawSupported = record.supported;
  if (rawSupported === undefined || rawSupported === null) {
    fail(marketId, 'locales.supported', 'is missing');
  }
  if (!Array.isArray(rawSupported) || rawSupported.length === 0) {
    fail(marketId, 'locales.supported', 'must be a non-empty array of locale slugs');
  }

  const supported: SupportedLocale[] = [];
  for (const entry of rawSupported) {
    if (typeof entry !== 'string' || !isSupportedLocale(entry)) {
      fail(
        marketId,
        'locales.supported',
        `contains "${String(entry)}" outside the platform superset ${PLATFORM_SUPERSET} (ADR-150-4, HG-7)`
      );
    }
    if (supported.includes(entry)) {
      fail(marketId, 'locales.supported', `contains duplicate entry "${entry}"`);
    }
    supported.push(entry);
  }

  const rawDefault = record.default;
  if (rawDefault === undefined || rawDefault === null) {
    fail(marketId, 'locales.default', 'is missing');
  }
  if (typeof rawDefault !== 'string' || !isSupportedLocale(rawDefault)) {
    fail(
      marketId,
      'locales.default',
      `is "${String(rawDefault)}" — outside the platform superset ${PLATFORM_SUPERSET} (ADR-150-4)`
    );
  }
  if (!supported.includes(rawDefault)) {
    fail(marketId, 'locales.default', `"${rawDefault}" is not a member of locales.supported`);
  }

  const rawFallbackChain = record.fallback_chain;
  if (rawFallbackChain !== undefined && rawFallbackChain !== null) {
    if (!Array.isArray(rawFallbackChain)) {
      fail(marketId, 'locales.fallback_chain', 'must be an array of locale slugs when present');
    }
    for (const entry of rawFallbackChain) {
      if (typeof entry !== 'string' || !supported.includes(entry as SupportedLocale)) {
        fail(
          marketId,
          'locales.fallback_chain',
          `contains "${String(entry)}" which is not a member of locales.supported`
        );
      }
    }
  }

  return { supported, defaultLocale: rawDefault };
}

async function loadMarketLocales(): Promise<MarketLocales> {
  const configuredMarketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID?.trim() ?? '';
  const marketId = await resolveRuntimeMarketId(configuredMarketId);
  if (!marketId) {
    throw new Error(
      '[market-locales] cannot resolve a runtime market id — set NEXT_PUBLIC_PAYLOAD_MARKET_ID ' +
        'or provide a market config under GP_CONFIG_ROOT (fail-fast, AD-2)'
    );
  }

  // Transient fs errors (not ENOENT) propagate as raw errors here (F2) — they
  // are deliberately NOT wrapped in `fail()` so `resolveMarketLocales` can tell
  // them apart from a deterministically missing/invalid `locales` block below.
  const config = await readRuntimeMarketConfigOrThrow(marketId);
  if (!config) {
    fail(marketId, 'market.yaml', 'is missing or unreadable under the resolved config root');
  }

  return narrowMarketLocales(config.locales, marketId);
}

let marketLocalesPromise: Promise<MarketLocales> | null = null;

/**
 * Resolves the market locale contract with a module-level cache — exactly one
 * config read per process (AD-2; market.yaml change requires restart). A
 * rejected load stays cached ONLY when it is a deterministic config-validation
 * failure (missing/invalid `locales` block, unresolvable market id) — a market
 * without a valid `locales` block must fail fast on every request, not
 * silently fall back to the platform superset.
 *
 * A *transient* fs error (F2 — e.g. a config volume mounting a moment after
 * container start, or an EMFILE/EIO burst) is NOT cached: the promise is
 * cleared so the next call retries the read instead of permanently 500-ing
 * every request until restart.
 */
export function resolveMarketLocales(): Promise<MarketLocales> {
  if (!marketLocalesPromise) {
    marketLocalesPromise = loadMarketLocales().catch(error => {
      if (!isMarketLocalesValidationError(error)) {
        marketLocalesPromise = null;
      }
      throw error;
    });
  }
  return marketLocalesPromise;
}

export async function isMarketSupportedLocale(locale: string): Promise<boolean> {
  const { supported } = await resolveMarketLocales();
  return (supported as readonly string[]).includes(locale);
}

export async function getMarketDefaultLocale(): Promise<SupportedLocale> {
  const { defaultLocale } = await resolveMarketLocales();
  return defaultLocale;
}

/** Test-only escape hatch — production code must rely on the module cache. */
export function resetMarketLocalesCacheForTests(): void {
  marketLocalesPromise = null;
}
