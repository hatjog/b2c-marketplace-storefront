import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

// Dynamic import required: static ESM linking runs before tsx transforms .ts files (Node 22)
const { resolveCategoryImage, CATEGORY_IMAGE_PLACEHOLDER } =
  await import('../src/lib/category-images.ts');

const MARKET = 'bonbeauty';
const RUNTIME_PREFIX = `/api/runtime-market-assets/${MARKET}/`;

describe('resolveCategoryImage — normative fallback order (AD-10)', () => {
  test('picks the single is_primary element with its own alt', () => {
    const image = resolveCategoryImage(
      'twarz',
      {
        photo_url: 'assets/envato_images/cover.jpg',
        gp: {
          images: [
            { url: 'assets/envato_images/first.jpg', alt: 'First alt' },
            { url: 'assets/envato_images/primary.jpg', alt: 'Primary alt', is_primary: true }
          ]
        }
      },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/envato_images/primary.jpg`);
    assert.equal(image.alt, 'Primary alt');
  });

  test('no is_primary falls back to gp.images[0] with its alt', () => {
    const image = resolveCategoryImage(
      'twarz',
      {
        gp: {
          images: [
            { url: 'assets/a.jpg', alt: 'A' },
            { url: 'assets/b.jpg', alt: 'B' }
          ]
        }
      },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/a.jpg`);
    assert.equal(image.alt, 'A');
  });

  test('empty gp.images falls back to top-level photo_url (alt null)', () => {
    const image = resolveCategoryImage(
      'twarz',
      { photo_url: 'assets/cover.jpg', gp: { images: [] } },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/cover.jpg`);
    assert.equal(image.alt, null);
  });

  test('top-level photo_url has priority over gp.photo_url', () => {
    const image = resolveCategoryImage(
      'twarz',
      { photo_url: 'assets/top.jpg', gp: { photo_url: 'assets/gp.jpg' } },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/top.jpg`);
  });

  test('missing photo_url falls back to gp.photo_url', () => {
    const image = resolveCategoryImage('twarz', { gp: { photo_url: 'assets/gp.jpg' } }, MARKET);

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/gp.jpg`);
    assert.equal(image.alt, null);
  });

  test('no sources at all → placeholder for unknown handle', () => {
    const image = resolveCategoryImage('twarz', {}, MARKET);

    assert.equal(image.src, CATEGORY_IMAGE_PLACEHOLDER);
    assert.equal(image.alt, null);
  });

  test('no sources at all → bundled image for a known handle', () => {
    const image = resolveCategoryImage('sneakers', {}, MARKET);

    assert.equal(image.src, '/images/categories/sneakers.png');
  });
});

describe('resolveCategoryImage — url form resolution (T2, ADR-159)', () => {
  test('absolute https url is kept as-is', () => {
    const image = resolveCategoryImage(
      'twarz',
      { gp: { images: [{ url: 'https://cdn.example.com/twarz.jpg', alt: 'CDN' }] } },
      MARKET
    );

    assert.equal(image.src, 'https://cdn.example.com/twarz.jpg');
    assert.equal(image.alt, 'CDN');
  });

  test('root-relative url is kept as-is', () => {
    const image = resolveCategoryImage(
      'twarz',
      { gp: { images: [{ url: '/uploads/twarz.jpg' }] } },
      MARKET
    );

    assert.equal(image.src, '/uploads/twarz.jpg');
  });

  test('relative asset ref resolves through the same-origin runtime-market-assets route', () => {
    const image = resolveCategoryImage(
      'twarz',
      { gp: { images: [{ url: 'assets/envato_images/spa.jpg' }] } },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/envato_images/spa.jpg`);
  });

  test('relative asset ref without marketId is unresolvable and degrades to next step', () => {
    const image = resolveCategoryImage(
      'unknown-handle',
      { photo_url: 'https://cdn.example.com/cover.jpg', gp: { images: [{ url: 'assets/a.jpg' }] } },
      ''
    );

    assert.equal(image.src, 'https://cdn.example.com/cover.jpg');
  });

  test('untrusted bundled-convention photo_url is rejected (seeds set paths that 404)', () => {
    const unknown = resolveCategoryImage(
      'twarz',
      { photo_url: '/images/categories/twarz.png' },
      MARKET
    );
    assert.equal(unknown.src, CATEGORY_IMAGE_PLACEHOLDER);

    const known = resolveCategoryImage(
      'sport',
      { photo_url: '/images/categories/sport.png' },
      MARKET
    );
    assert.equal(known.src, '/images/categories/sport.png');
  });

  test('a legitimate resolved url that merely CONTAINS the /images/categories/ segment is accepted, not rejected as bundled-convention (3-1-F3)', () => {
    // Source asset ref lives under an "images/categories" subfolder of the
    // market assets bucket — resolves through runtime-market-assets, which
    // is NOT the bundled convention path and must not be gated out by a
    // substring match on the resolved URL.
    const image = resolveCategoryImage(
      'twarz',
      { gp: { images: [{ url: 'assets/images/categories/twarz.jpg', is_primary: true }] } },
      MARKET
    );
    assert.equal(image.src, `${RUNTIME_PREFIX}assets/images/categories/twarz.jpg`);

    const absolute = resolveCategoryImage(
      'twarz',
      {
        gp: {
          images: [{ url: 'https://cdn.example.com/images/categories/twarz.jpg', is_primary: true }]
        }
      },
      MARKET
    );
    assert.equal(absolute.src, 'https://cdn.example.com/images/categories/twarz.jpg');
  });
});

describe('resolveCategoryImage — graceful degradation, NEVER throws (AC2)', () => {
  test('missing/null/non-object metadata returns placeholder', () => {
    for (const metadata of [undefined, null, 'string', 42, ['array']]) {
      const image = resolveCategoryImage('twarz', metadata, MARKET);
      assert.equal(image.src, CATEGORY_IMAGE_PLACEHOLDER);
      assert.equal(image.alt, null);
    }
  });

  test('gp.images not an array degrades to photo_url', () => {
    const image = resolveCategoryImage(
      'twarz',
      { photo_url: 'assets/cover.jpg', gp: { images: 'not-an-array' } },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/cover.jpg`);
  });

  test('elements without usable url are skipped, first valid element wins', () => {
    const image = resolveCategoryImage(
      'twarz',
      {
        gp: {
          images: [null, { alt: 'no url' }, { url: '   ' }, { url: 'assets/ok.jpg', alt: 'OK' }]
        }
      },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/ok.jpg`);
    assert.equal(image.alt, 'OK');
  });

  test('multiple is_primary breaks the primary step and uses gp.images[0]', () => {
    const image = resolveCategoryImage(
      'twarz',
      {
        gp: {
          images: [
            { url: 'assets/first.jpg', alt: 'First' },
            { url: 'assets/p1.jpg', alt: 'P1', is_primary: true },
            { url: 'assets/p2.jpg', alt: 'P2', is_primary: true }
          ]
        }
      },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/first.jpg`);
    assert.equal(image.alt, 'First');
  });

  test('alt is always consistent with the chosen url, never taken from another element', () => {
    const image = resolveCategoryImage(
      'twarz',
      {
        gp: {
          images: [
            { url: 'assets/ok.jpg', alt: 'OK alt', is_primary: true },
            { url: '../escape.jpg', alt: 'Broken alt' }
          ]
        }
      },
      MARKET
    );

    assert.equal(image.src, `${RUNTIME_PREFIX}assets/ok.jpg`);
    assert.equal(image.alt, 'OK alt');
  });

  test('unresolvable gp.images candidate does NOT fall back to a second gp.images element — falls through the normative chain instead (3-1-F2)', () => {
    const image = resolveCategoryImage(
      'twarz',
      {
        gp: {
          images: [
            { url: '../escape.jpg', alt: 'Broken alt', is_primary: true },
            { url: 'assets/ok.jpg', alt: 'OK alt' }
          ]
        }
      },
      MARKET
    );

    // Strict AC2 order: gp.images[is_primary] unresolvable -> photo_url (absent)
    // -> gp.photo_url (absent) -> placeholder. gp.images[1] is never tried.
    assert.equal(image.src, CATEGORY_IMAGE_PLACEHOLDER);
    assert.equal(image.alt, null);
  });
});
