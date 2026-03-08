import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { getCollectionPhotoUrl } = await import('../src/lib/collection-media.ts');

describe('collection media helpers', () => {
  test('returns collection metadata.photo_url when present', () => {
    const photoUrl = getCollectionPhotoUrl({
      metadata: {
        photo_url: 'https://cdn.example.com/gp/bonbeauty/collections/premium-core/cover.jpg'
      }
    });

    assert.equal(photoUrl, 'https://cdn.example.com/gp/bonbeauty/collections/premium-core/cover.jpg');
  });

  test('falls back to metadata.gp.photo_url when root metadata.photo_url is absent', () => {
    const photoUrl = getCollectionPhotoUrl({
      metadata: {
        gp: {
          photo_url: 'https://cdn.example.com/gp/bonbeauty/collections/standard/cover.jpg'
        }
      }
    });

    assert.equal(photoUrl, 'https://cdn.example.com/gp/bonbeauty/collections/standard/cover.jpg');
  });
});