import Medusa from '@medusajs/js-sdk';
import { createClient } from '@mercurjs/client';

import { resolveMedusaBackendUrl } from './env';
import { applyLocaleInterceptor, withLocaleHeader } from './sdk/locale-interceptor';
import { stripInternalHeadersForThirdParty } from './security/header-allowlist';

const MEDUSA_BACKEND_URL = resolveMedusaBackendUrl();

export const sdk = applyLocaleInterceptor(
  new Medusa({
    baseUrl: MEDUSA_BACKEND_URL,
    debug: false,
    publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  })
);

/**
 * Mercur 2.x typed client (story v160-2-4, Path B dual-SDK).
 *
 * Parallel to the Medusa class instance above. Existing `sdk.store.*` /
 * `sdk.auth.*` / `sdk.client.fetch` callsites (50+ in src/lib/data/*) remain
 * untouched and continue to work via @medusajs/js-sdk@2.13.4.
 *
 * `mercurClient` is reserved for *new* code reaching Mercur 2 extension
 * routes (sellers, order-groups, commission, vendor onboarding) that are not
 * covered by @medusajs/js-sdk's typed surface. Callsite migration is
 * progressive across stories 2.5 (cookies/headers), 2.6 (endpoint contract),
 * and 2.7 (naming preservation). Do NOT bulk-rewrite existing data layer here.
 *
 * Note: createClient() returns `any` until backend codegen produces a
 * `@mercurjs/core/_generated` Routes export. When that lands, swap to
 * `createClient<Routes>({...})` for full type inference.
 */
export const mercurClient = createClient({
  baseUrl: MEDUSA_BACKEND_URL,
  fetchOptions: {
    headers: {
      'Content-Type': 'application/json',
      'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string
    }
  }
});

type FetchQueryOptions = Omit<RequestInit, 'headers' | 'body'> & {
  headers?: Record<string, string | null | { tags: string[] }>;
  query?: Record<string, string | number>;
  body?: Record<string, any>;
};

export async function fetchQuery(url: string, { method, query, headers, body }: FetchQueryOptions) {
  const params = Object.entries(query || {}).reduce((acc, [key, value], index) => {
    if (value && value !== undefined) {
      const queryLength = Object.values(query || {}).filter(i => !!i).length;
      acc += `${key}=${value}${index + 1 <= queryLength ? '&' : ''}`;
    }
    return acc;
  }, '');

  const requestUrl = `${MEDUSA_BACKEND_URL}${url}${params && `?${params}`}`;

  // Story 1.6 (AC3) defense-in-depth contract. This callsite ALWAYS targets
  // the Medusa backend (`requestUrl` is `${MEDUSA_BACKEND_URL}${url}`), so the
  // strip is a guaranteed no-op here and `x-publishable-api-key` keeps flowing
  // — zero market-isolation impact. The guard is wired in as a forward-looking
  // contract: any FUTURE callsite that points fetchQuery at a Stripe host
  // cannot leak internal multi-tenant headers.
  const safeHeaders = stripInternalHeadersForThirdParty(
    requestUrl,
    await withLocaleHeader({
      'Content-Type': 'application/json',
      'x-publishable-api-key': process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY as string,
      ...headers
    })
  );

  const res = await fetch(requestUrl, {
    method,
    headers: safeHeaders as Record<string, string>,
    body: body ? JSON.stringify(body) : null
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { message: res.statusText || 'Unknown error' };
  }

  return {
    ok: res.ok,
    status: res.status,
    error: res.ok ? null : { message: data?.message },
    data: res.ok ? data : null
  };
}
