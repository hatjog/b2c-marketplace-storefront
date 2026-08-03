import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { getPageImageUrl } = await import('../../src/lib/blog.ts');

describe('blog media helpers', () => {
  test('prefers page.image for blog cards by default', () => {
    const imageUrl = getPageImageUrl(
      {
        image: { url: 'https://cdn.example.com/cards/post-card.jpg' },
        hero_image: { url: 'https://cdn.example.com/hero/post-hero.jpg' }
      },
      0
    );

    assert.equal(imageUrl, 'https://cdn.example.com/cards/post-card.jpg');
  });

  test('can prefer hero_image for article hero rendering', () => {
    const imageUrl = getPageImageUrl(
      {
        image: { url: 'https://cdn.example.com/cards/post-card.jpg' },
        hero_image: { url: 'https://cdn.example.com/hero/post-hero.jpg' }
      },
      0,
      { preferHeroImage: true }
    );

    assert.equal(imageUrl, 'https://cdn.example.com/hero/post-hero.jpg');
  });

  test('falls back to stock image when page has no declared media', () => {
    const imageUrl = getPageImageUrl({}, 0);

    assert.equal(imageUrl, '/images/blog/post-1.jpg');
  });
});