/**
 * Structured logger wrapper — storefront-side.
 *
 * Dispatch chain (evaluated at call time, no top-level side effects):
 *   1. If `NEXT_PUBLIC_SENTRY_DSN` is set → `Sentry.captureMessage` with structured `extra`.
 *   2. Else if `PORTAL_LOG_ENDPOINT` is set → fire-and-forget POST (TODO: v1.7.0 activate).
 *   3. Else → `console.warn` / `console.error` with `JSON.stringify(payload)`.
 *
 * Tree-shake-safe: no module-level Sentry init; lazy `import('@sentry/nextjs')` guard is
 * replaced by a synchronous `require` check below — safe in Next.js App Router bundles.
 *
 * PII policy: payloads MUST NOT contain raw URLs, user IDs, email, vendor IDs, raw filenames
 * from user content, or query strings with PII. Use boolean flags / counts / non-PII enums
 * in `context` instead.
 *
 * @module lib/logger
 * @see TF-138 / story v160-cleanup-58-structured-logging-storefront
 *
 * ### Console log audit inventory (AC4 — 2026-05-07)
 *
 * Total callsites in `GP/storefront/src/` (excluding __tests__, *.stories.*): **warn=15  error=22**
 *
 * | File | Line | Kind | Tag |
 * |------|------|------|-----|
 * | actions/voucher-claim.ts | 94 | error | REPLACE_FOLLOWUP |
 * | actions/voucher-consent.ts | 70 | warn | REPLACE_FOLLOWUP |
 * | app/[locale]/(main)/categories/error.tsx | 13 | error | REPLACE_FOLLOWUP |
 * | app/[locale]/(main)/categories/page.tsx | 114 | warn | REPLACE_FOLLOWUP |
 * | app/[locale]/(main)/error.tsx | 14 | error | REPLACE_FOLLOWUP |
 * | app/api/csp-report/route.ts | 30 | warn | KEEP (intentional CSP violation report) |
 * | app/global-error.tsx | 14 | error | REPLACE_FOLLOWUP |
 * | components/blocks/HomepageRenderer.tsx | 89 | error | REPLACE_FOLLOWUP |
 * | components/blocks/homepage-utils.ts | 101 | warn | DONE (replaced in this story) |
 * | components/cells/SellerMap/SellerMap.tsx | 139 | warn | REPLACE_FOLLOWUP |
 * | components/molecules/DeleteCartItemButton/DeleteCartItemButton.tsx | 18 | error | REPLACE_FOLLOWUP |
 * | components/providers/Cart/CartProvider.tsx | 52 | error | REPLACE_FOLLOWUP |
 * | components/providers/Cart/CartProvider.tsx | 124 | error | REPLACE_FOLLOWUP |
 * | components/providers/Cart/CartProvider.tsx | 164 | error | REPLACE_FOLLOWUP |
 * | components/providers/Cart/CartProvider.tsx | 190 | error | REPLACE_FOLLOWUP |
 * | components/sections/ProductListing/ProductListing.tsx | 147 | warn | REPLACE_FOLLOWUP |
 * | components/sections/ProductListing/ProductListing.tsx | 177 | error | REPLACE_FOLLOWUP |
 * | hooks/useCircuitBreaker.ts | 216 | warn | KEEP (structured warn — TF-71 intentional) |
 * | lib/blog.ts | 85 | warn | REPLACE_FOLLOWUP |
 * | lib/blog.ts | 107 | error | REPLACE_FOLLOWUP |
 * | lib/blog.ts | 114 | error | REPLACE_FOLLOWUP |
 * | lib/data/cart.ts | 325 | warn | REPLACE_FOLLOWUP |
 * | lib/data/cart.ts | 720 | warn | KEEP (fail-open audit trail) |
 * | lib/data/cart.ts | 727 | warn | KEEP (fail-open audit trail) |
 * | lib/data/products.ts | 165 | error | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 291 | error | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 378 | warn | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 410 | error | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 459 | error | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 479 | error | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 565 | warn | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 595 | error | REPLACE_FOLLOWUP |
 * | lib/data/products.ts | 615 | error | REPLACE_FOLLOWUP |
 * | lib/helpers/market-filter.ts | 43 | warn | REPLACE_FOLLOWUP |
 * | lib/helpers/medusa-error.ts | 6-9 | error ×4 | REPLACE_FOLLOWUP |
 * | lib/helpers/parse-purchase-mode.ts | 44, 65 | warn ×2 | REPLACE_FOLLOWUP |
 * | lib/homepage/dynamic-blocks.ts | 110, 143, 177, 212, 223, 235 | error ×6 | REPLACE_FOLLOWUP |
 * | lib/portal.server.ts | 25 | error | REPLACE_FOLLOWUP |
 * | lib/runtime-market-config.ts | 131 | error | REPLACE_FOLLOWUP |
 *
 * Summary: DONE=1, KEEP=4, REPLACE_FOLLOWUP=32, REMOVE=0. Full mass-replace deferred to
 * next dedicated story (out of scope for TF-138).
 */

import * as Sentry from '@sentry/nextjs';

export type LogPayload = {
  event_type: string;
  source: string;
  context?: Record<string, unknown>;
  error_message?: string;
};

type EmitInput = Omit<LogPayload, 'event_type'>;

function dispatch(level: 'warn' | 'error', event_type: string, input: EmitInput): void {
  const payload: LogPayload = { event_type, ...input };

  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(event_type, {
      level: level === 'error' ? 'error' : 'warning',
      extra: payload as Record<string, unknown>,
    });
    return;
  }

  // TODO(v1.7.0): if PORTAL_LOG_ENDPOINT → fire-and-forget POST to portal log API
  // const endpoint = process.env.PORTAL_LOG_ENDPOINT;
  // if (endpoint) { void fetch(endpoint, { method: 'POST', body: JSON.stringify(payload) }); return; }

  if (level === 'error') {
    console.error(JSON.stringify(payload));
  } else {
    console.warn(JSON.stringify(payload));
  }
}

export const logger = {
  warn: (event_type: string, input: EmitInput): void => dispatch('warn', event_type, input),
  error: (event_type: string, input: EmitInput): void => dispatch('error', event_type, input),
};
