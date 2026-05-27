import { describe, expect, it, vi } from 'vitest';

import {
  applyLocaleInterceptor,
  headersToRecord,
  localePath,
  normalizeToCanonicalLocale,
  withLocaleHeader
} from '../locale-interceptor';

describe('locale interceptor', () => {
  it.each([
    ['pl', 'pl-PL'],
    ['en', 'en-US'],
    ['ua', 'uk-UA'],
    ['uk', 'uk-UA'],
    ['de', 'de-DE']
  ])('normalizuje %s do canonical BCP 47 %s', (input, expected) => {
    expect(normalizeToCanonicalLocale(input)).toBe(expected);
  });

  it.each(['pl-PL', 'en-US', 'uk-UA', 'de-DE'] as const)(
    'dodaje x-medusa-locale do sdk.client.fetch dla %s',
    async locale => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      const sdk = { client: { fetch: fetchMock } };

      applyLocaleInterceptor(sdk, async () => locale);

      await sdk.client.fetch('/store/products', {
        method: 'GET',
        headers: { authorization: 'Bearer token' }
      });

      expect(fetchMock).toHaveBeenCalledWith('/store/products', {
        method: 'GET',
        headers: {
          authorization: 'Bearer token',
          'x-medusa-locale': locale
        }
      });
    }
  );

  it('dodaje x-medusa-locale do query.graph call', async () => {
    const graphMock = vi.fn().mockResolvedValue({ data: [] });
    const sdk = { query: { graph: graphMock } };

    applyLocaleInterceptor(sdk, async () => 'de-DE');

    await sdk.query.graph({ entity: 'product', fields: ['id'] } as never);

    expect(graphMock).toHaveBeenCalledWith({
      entity: 'product',
      fields: ['id'],
      headers: { 'x-medusa-locale': 'de-DE' }
    });
  });

  it('fallback client-component bierze document.documentElement.lang', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        documentElement: { lang: 'ua' },
        cookie: ''
      },
      configurable: true
    });

    await expect(withLocaleHeader()).resolves.toMatchObject({
      'x-medusa-locale': 'uk-UA'
    });

    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('localePath generuje locale-prefixed path z canonical locale', async () => {
    await expect(localePath('/user/orders', 'en-US')).resolves.toBe('/en/user/orders');
  });

  it('konwertuje Headers na plain record bez utraty x-medusa-locale', () => {
    expect(headersToRecord(new Headers({ 'x-medusa-locale': 'pl-PL' }))).toEqual({
      'x-medusa-locale': 'pl-PL'
    });
  });
});
