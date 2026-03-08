import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import required: static ESM linking runs before tsx transforms .ts files (Node 22)
const { filterByMarket, filterByMarketOrKeepUntagged, getMarketId, selectMarketScopedItem } = await import('../src/lib/helpers/market-filter.ts');

describe('market-filter utility', () => {
  test('filterByMarket: passes all items when marketId is empty (dev fallback)', () => {
    const items = [
      { metadata: { gp: { market_id: 'bonbeauty' } } },
      { metadata: { gp: { market_id: 'bonevent' } } }
    ];
    const result = filterByMarket(items, '');
    assert.equal(result.length, 2);
  });

  test('filterByMarket: keeps only items matching marketId', () => {
    const items = [
      { id: 1, metadata: { gp: { market_id: 'bonbeauty' } } },
      { id: 2, metadata: { gp: { market_id: 'bonevent' } } },
      { id: 3, metadata: { gp: { market_id: 'bonbeauty' } } }
    ];
    const result = filterByMarket(items, 'bonbeauty');
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(i => i.id), [1, 3]);
  });

  test('filterByMarket: removes items without metadata.gp.market_id', () => {
    const items = [
      { id: 1, metadata: { gp: { market_id: 'bonbeauty' } } },
      { id: 2, metadata: {} },
      { id: 3 }
    ];
    const result = filterByMarket(items, 'bonbeauty');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 1);
  });

  test('filterByMarket: returns empty array when no items match', () => {
    const items = [{ metadata: { gp: { market_id: 'bonevent' } } }];
    const result = filterByMarket(items, 'bonbeauty');
    assert.equal(result.length, 0);
  });

  test('filterByMarketOrKeepUntagged: returns original items when no gp market metadata exists', () => {
    const items = [
      { id: 1, metadata: {} },
      { id: 2 },
    ];
    const result = filterByMarketOrKeepUntagged(items, 'mercur');
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(i => i.id), [1, 2]);
  });

  test('filterByMarketOrKeepUntagged: keeps strict filtering when tagged items exist', () => {
    const items = [
      { id: 1, metadata: { gp: { market_id: 'bonevent' } } },
      { id: 2, metadata: { gp: { market_id: 'bonbeauty' } } },
    ];
    const result = filterByMarketOrKeepUntagged(items, 'mercur');
    assert.deepEqual(result, []);
  });

  test('filterByMarketOrKeepUntagged: returns matching tagged items when available', () => {
    const items = [
      { id: 1, metadata: { gp: { market_id: 'bonevent' } } },
      { id: 2, metadata: { gp: { market_id: 'mercur' } } },
      { id: 3 },
    ];
    const result = filterByMarketOrKeepUntagged(items, 'mercur');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 2);
  });

  test('filterByMarket: handles empty input array', () => {
    const result = filterByMarket([], 'bonbeauty');
    assert.deepEqual(result, []);
  });

  test('selectMarketScopedItem: prefers the item tagged for the active market', () => {
    const result = selectMarketScopedItem(
      [
        { id: 'foreign', metadata: { gp: { market_id: 'mercur' } } },
        { id: 'current', metadata: { gp: { market_id: 'bonbeauty' } } }
      ],
      'bonbeauty'
    );

    assert.equal(result?.id, 'current');
  });

  test('selectMarketScopedItem: falls back to an untagged item only when no tagged candidates exist', () => {
    const result = selectMarketScopedItem(
      [
        { id: 'untagged-1', metadata: {} },
        { id: 'untagged-2' }
      ],
      'bonbeauty'
    );

    assert.equal(result?.id, 'untagged-1');
  });

  test('selectMarketScopedItem: returns undefined when only foreign tagged items exist', () => {
    const result = selectMarketScopedItem(
      [
        { id: 'foreign-1', metadata: { gp: { market_id: 'mercur' } } },
        { id: 'foreign-2', metadata: { gp: { market_id: 'bonevent' } } }
      ],
      'bonbeauty'
    );

    assert.equal(result, undefined);
  });

  test('getMarketId: returns empty string when env var unset', () => {
    const original = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID;
    delete process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID;
    const result = getMarketId();
    assert.equal(result, '');
    if (original !== undefined) process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = original;
  });

  test('getMarketId: returns env var value when set', () => {
    process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'bonbeauty';
    const result = getMarketId();
    assert.equal(result, 'bonbeauty');
  });
});
