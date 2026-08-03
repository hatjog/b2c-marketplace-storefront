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

  test('returns null when metadata is undefined', () => {
    assert.equal(getCollectionPhotoUrl({}), null);
  });

  test('returns null when metadata is null', () => {
    assert.equal(getCollectionPhotoUrl({ metadata: null }), null);
  });

  test('returns null when metadata.gp exists but has no photo_url', () => {
    assert.equal(getCollectionPhotoUrl({ metadata: { gp: { market_id: 'bonbeauty' } } }), null);
  });

  test('returns null when metadata.gp is not an object', () => {
    assert.equal(getCollectionPhotoUrl({ metadata: { gp: 'string-value' } }), null);
  });

  test('returns null when photo_url is empty string', () => {
    assert.equal(getCollectionPhotoUrl({ metadata: { photo_url: '' } }), null);
  });

  test('returns null when photo_url is whitespace only', () => {
    assert.equal(getCollectionPhotoUrl({ metadata: { photo_url: '   ' } }), null);
  });

  test('prefers root metadata.photo_url over metadata.gp.photo_url', () => {
    const photoUrl = getCollectionPhotoUrl({
      metadata: {
        photo_url: 'https://cdn.example.com/root.jpg',
        gp: {
          photo_url: 'https://cdn.example.com/gp.jpg'
        }
      }
    });

    assert.equal(photoUrl, 'https://cdn.example.com/root.jpg');
  });
});
