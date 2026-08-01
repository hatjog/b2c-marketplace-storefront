import assert from 'node:assert/strict';
import path from 'node:path';
import test, { describe } from 'node:test';
import { fileURLToPath } from 'node:url';

// Story 1.1 v1.14.0: builders consume the market-aware locale resolver —
// point GP_CONFIG_ROOT at the bonbeauty fixture (all 4 platform locales)
// BEFORE the module graph loads.
process.env.GP_CONFIG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/market-config'
);
process.env.GP_INSTANCE_ID = 'gp-dev';
process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'bonbeauty';

const { buildLocaleSeoAlternates, buildLocaleSocialMetadata } =
  await import('../../src/lib/seo/hreflang.ts');

describe('SEO hreflang matrix', () => {
  test('builds category alternates with four BCP 47 locales and x-default', async () => {
    const alternates = await buildLocaleSeoAlternates(
      'https://bonbeauty.test',
      'de',
      'categories',
      'face-care'
    );

    assert.equal(alternates.canonical, 'https://bonbeauty.test/de/categories/face-care');
    assert.deepEqual(alternates.languages, {
      'pl-PL': 'https://bonbeauty.test/pl/categories/face-care',
      'en-US': 'https://bonbeauty.test/en/categories/face-care',
      'uk-UA': 'https://bonbeauty.test/ua/categories/face-care',
      'de-DE': 'https://bonbeauty.test/de/categories/face-care',
      'x-default': 'https://bonbeauty.test/pl/categories/face-care'
    });
  });

  test('preserves PDP handle while swapping locale prefix', async () => {
    const alternates = await buildLocaleSeoAlternates(
      'https://bonbeauty.test',
      'en',
      'products',
      'voucher-spa'
    );

    assert.equal(alternates.canonical, 'https://bonbeauty.test/en/products/voucher-spa');
    assert.equal(alternates.languages['de-DE'], 'https://bonbeauty.test/de/products/voucher-spa');
    assert.equal(
      alternates.languages['x-default'],
      'https://bonbeauty.test/pl/products/voucher-spa'
    );
  });

  test('preserves seller handle while swapping locale prefix', async () => {
    const alternates = await buildLocaleSeoAlternates(
      'https://bonbeauty.test',
      'ua',
      'sellers',
      'salon-anna'
    );

    assert.equal(alternates.canonical, 'https://bonbeauty.test/ua/sellers/salon-anna');
    assert.equal(alternates.languages['uk-UA'], 'https://bonbeauty.test/ua/sellers/salon-anna');
    assert.equal(alternates.languages['pl-PL'], 'https://bonbeauty.test/pl/sellers/salon-anna');
  });

  test('builds Open Graph locale alternates and Twitter language', async () => {
    const social = await buildLocaleSocialMetadata('de');

    // Open Graph requires the underscore `language_TERRITORY` form (pl_PL);
    // crawlers ignore the hyphenated BCP-47 form. hreflang/twitter keep hyphens.
    assert.deepEqual(social.openGraph, {
      locale: 'de_DE',
      alternateLocale: ['pl_PL', 'en_US', 'uk_UA']
    });
    assert.deepEqual(social.other, {
      'twitter:lang': 'de-DE'
    });
  });
});
