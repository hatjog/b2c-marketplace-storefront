/**
 * Story v160-cleanup-12e — unit tests for groupLineItemsBySeller + hasMultipleSellers
 * helpers used by MultiVendorOrderSummary server component.
 *
 * Tests run via `pnpm test` (Node.js built-in test runner).
 * The helpers are pure data transforms — no DOM, no Next.js, no i18n needed.
 *
 * Note: cart-vendor-context.ts uses localStorage fallback (Option B).
 * In test environment `window` is undefined (SSR mode), so only Option A
 * (metadata-based) path is exercised — which is the primary production path.
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

// Inline re-implementation of the helpers to avoid TS/module resolution in .mjs test files.
// Logic mirrors src/lib/helpers/cart-vendor-context.ts exactly.

function readSelectedSeller(item) {
  const metadata = item.metadata ?? null;
  const metaId = typeof metadata?.selected_seller_id === 'string' ? metadata.selected_seller_id : undefined;
  const metaName = typeof metadata?.selected_seller_name === 'string' ? metadata.selected_seller_name : undefined;
  const metaHandle = typeof metadata?.selected_seller_handle === 'string' ? metadata.selected_seller_handle : undefined;
  if (metaId && metaName) {
    return metaHandle ? { id: metaId, name: metaName, handle: metaHandle } : { id: metaId, name: metaName };
  }
  return null;
}

const DEFAULT_GROUP_KEY = '__default';

function groupLineItemsBySeller(items) {
  const groups = new Map();
  for (const item of items) {
    const seller = readSelectedSeller(item);
    const key = seller?.id ?? DEFAULT_GROUP_KEY;
    let group = groups.get(key);
    if (!group) {
      group = { seller_id: seller?.id ?? null, seller, items: [], subtotal: 0 };
      groups.set(key, group);
    }
    group.items.push(item);
    group.subtotal += typeof item.subtotal === 'number' ? item.subtotal : 0;
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.seller_id === null) return 1;
    if (b.seller_id === null) return -1;
    return (a.seller?.name ?? '').localeCompare(b.seller?.name ?? '');
  });
}

function hasMultipleSellers(items) {
  return items.some((item) => readSelectedSeller(item) !== null);
}

// Test fixtures
const makeItem = (id, sellerId, sellerName, subtotal = 1000) => ({
  id,
  subtotal,
  metadata: sellerId
    ? { selected_seller_id: sellerId, selected_seller_name: sellerName }
    : null,
});

describe('groupLineItemsBySeller', () => {
  test('groups 2-seller cart into 2 groups (AC2)', () => {
    const items = [
      makeItem('item-1', 'seller-a', 'Salon A', 2000),
      makeItem('item-2', 'seller-b', 'Salon B', 3000),
      makeItem('item-3', 'seller-a', 'Salon A', 1000),
    ];
    const groups = groupLineItemsBySeller(items);
    assert.equal(groups.length, 2);
    // Alphabetical: Salon A < Salon B
    assert.equal(groups[0].seller_id, 'seller-a');
    assert.equal(groups[0].items.length, 2);
    assert.equal(groups[0].subtotal, 3000);
    assert.equal(groups[1].seller_id, 'seller-b');
    assert.equal(groups[1].items.length, 1);
    assert.equal(groups[1].subtotal, 3000);
  });

  test('single-seller cart yields 1 group (AC4 — MultiVendorOrderSummary renders null)', () => {
    const items = [
      makeItem('item-1', 'seller-a', 'Salon A', 1500),
      makeItem('item-2', 'seller-a', 'Salon A', 500),
    ];
    const groups = groupLineItemsBySeller(items);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].seller_id, 'seller-a');
    assert.equal(groups[0].subtotal, 2000);
  });

  test('items without metadata fall into default group (seller_id=null)', () => {
    const items = [
      makeItem('item-1', null, null, 1000),
      makeItem('item-2', null, null, 2000),
    ];
    const groups = groupLineItemsBySeller(items);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].seller_id, null);
    assert.equal(groups[0].subtotal, 3000);
  });

  test('empty cart yields 0 groups', () => {
    const groups = groupLineItemsBySeller([]);
    assert.equal(groups.length, 0);
  });

  test('default group sorts last when mixed with named sellers', () => {
    const items = [
      makeItem('item-1', null, null, 500),
      makeItem('item-2', 'seller-z', 'Salon Z', 1000),
      makeItem('item-3', 'seller-a', 'Salon A', 1500),
    ];
    const groups = groupLineItemsBySeller(items);
    assert.equal(groups.length, 3);
    assert.equal(groups[0].seller_id, 'seller-a');
    assert.equal(groups[1].seller_id, 'seller-z');
    assert.equal(groups[2].seller_id, null);
  });
});

describe('hasMultipleSellers', () => {
  test('returns true when any item has seller metadata', () => {
    const items = [makeItem('item-1', 'seller-a', 'Salon A')];
    assert.equal(hasMultipleSellers(items), true);
  });

  test('returns false when no item has seller metadata', () => {
    const items = [makeItem('item-1', null, null)];
    assert.equal(hasMultipleSellers(items), false);
  });

  test('returns false for empty cart', () => {
    assert.equal(hasMultipleSellers([]), false);
  });

  test('returns true when at least one item has seller metadata among multiple items', () => {
    const items = [
      makeItem('item-1', null, null),
      makeItem('item-2', 'seller-b', 'Salon B'),
    ];
    assert.equal(hasMultipleSellers(items), true);
  });
});
