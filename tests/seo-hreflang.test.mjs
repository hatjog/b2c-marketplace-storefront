import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

const { buildLocaleSeoAlternates, buildLocaleSocialMetadata } =
  await import('../src/lib/seo/hreflang.ts');

describe('SEO hreflang matrix', () => {
  test('builds category alternates with four BCP 47 locales and x-default', () => {
    const alternates = buildLocaleSeoAlternates(
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

  test('preserves PDP handle while swapping locale prefix', () => {
    const alternates = buildLocaleSeoAlternates(
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

  test('preserves seller handle while swapping locale prefix', () => {
    const alternates = buildLocaleSeoAlternates(
      'https://bonbeauty.test',
      'ua',
      'sellers',
      'salon-anna'
    );

    assert.equal(alternates.canonical, 'https://bonbeauty.test/ua/sellers/salon-anna');
    assert.equal(alternates.languages['uk-UA'], 'https://bonbeauty.test/ua/sellers/salon-anna');
    assert.equal(alternates.languages['pl-PL'], 'https://bonbeauty.test/pl/sellers/salon-anna');
  });

  test('builds Open Graph locale alternates and Twitter language', () => {
    const social = buildLocaleSocialMetadata('de');

    assert.deepEqual(social.openGraph, {
      locale: 'de-DE',
      alternateLocale: ['pl-PL', 'en-US', 'uk-UA']
    });
    assert.deepEqual(social.other, {
      'twitter:lang': 'de'
    });
  });
});
