/**
 * Locale header propagation test dla realnej funkcji z lib/data/* (Story 2.2, L-1).
 *
 * Pokrywa wording T5: „dla każdego z 4 canonical locales wymusza wywołanie typowej
 * funkcji z lib/data/* i asercja: outgoing request zawiera `x-medusa-locale` header”.
 * Test uderza w `listCategories()` (lib/data/categories.ts) — typowy call site
 * Medusa SDK przez singleton z applyLocaleInterceptor.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanonicalLocale } from '../../sdk/locale-interceptor';

const fetchMock = vi.fn();

vi.mock('../../config', () => ({
  sdk: {
    client: {
      fetch: fetchMock
    }
  }
}));

vi.mock('../../helpers/market-filter', () => ({
  filterByMarket: <T>(items: T[]) => items,
  getMarketId: () => 'bonbeauty'
}));

const resolveLocaleMock = vi.fn();
vi.mock('../../sdk/locale-interceptor', async () => {
  const actual = await vi.importActual<typeof import('../../sdk/locale-interceptor')>(
    '../../sdk/locale-interceptor'
  );
  return {
    ...actual,
    resolveStorefrontLocale: () => resolveLocaleMock()
  };
});

const { listCategories } = await import('../categories');
const { applyLocaleInterceptor } = await import('../../sdk/locale-interceptor');
const { sdk } = await import('../../config');

// Wrap test SDK przez applyLocaleInterceptor analogicznie jak production singleton.
applyLocaleInterceptor(sdk as unknown as { client: { fetch: typeof fetchMock } }, async () => {
  return (await resolveLocaleMock()) as CanonicalLocale;
});

describe('listCategories — x-medusa-locale header propagation (L-1)', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ product_categories: [] });
    resolveLocaleMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['pl-PL', 'en-US', 'uk-UA', 'de-DE'] as const)(
    'wysyła x-medusa-locale=%s na /store/product-categories',
    async locale => {
      resolveLocaleMock.mockResolvedValue(locale);

      await listCategories();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options.headers).toMatchObject({ 'x-medusa-locale': locale });
    }
  );
});
