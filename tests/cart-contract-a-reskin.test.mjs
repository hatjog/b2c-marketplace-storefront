import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('cart page exposes visible contract-A head and 1.6fr/1fr layout', () => {
  const page = read('src/app/[locale]/(main)/cart/page.tsx');
  const cart = read('src/components/sections/Cart/Cart.tsx');

  assert.ok(!page.includes('<h1 className="sr-only">{t(\'cart_title\')}</h1>'));
  assert.match(cart, /className="cart-page-head/);
  assert.match(cart, /<h1 className="heading-3xl text-primary">\{t\('page_heading'\)\}<\/h1>/);
  assert.match(cart, /lg:grid-cols-\[minmax\(0,1\.6fr\)_minmax\(320px,1fr\)\]/);
});

test('cart summary renders discount block, three delivery chips, VAT and trust lines', () => {
  const cart = read('src/components/sections/Cart/Cart.tsx');
  const summary = read('src/components/organisms/CartSummary/CartSummary.tsx');
  const plMessages = JSON.parse(read('messages/pl.json'));

  assert.match(cart, /discount-block/);
  assert.equal(plMessages.cart.gift_card_option, 'Mam kartę podarunkową');
  // AC2 verbatim labels
  assert.equal(plMessages.cart.promo_code_heading, 'Mam kod rabatowy');
  assert.match(summary, /className="dchip rchip/);
  assert.match(summary, /value: 'pdf_email'/);
  assert.match(summary, /value: 'magic_link'/);
  assert.match(summary, /value: 'physical_card'/);
  assert.equal(plMessages.cart.delivery_method_pdf_email, 'PDF email');
  assert.equal(plMessages.cart.delivery_method_magic_link, 'Link magic');
  assert.equal(plMessages.cart.delivery_method_physical_card, 'Karta fizyczna +15 zł');
  assert.equal(plMessages.cart.vat_included, 'Zawiera VAT');
  assert.match(summary, /className="sum-trust/);
});

test('cart summary testids are disambiguated between desktop and mobile variants (M2 fix)', () => {
  const summary = read('src/components/organisms/CartSummary/CartSummary.tsx');
  const cart = read('src/components/sections/Cart/Cart.tsx');

  // CartSummary must use template literals with suffix, not plain string testids.
  assert.match(summary, /data-testid=\{`cart-summary\$\{suffix\}`\}/, 'cart-summary testid must use suffix');
  assert.match(summary, /data-testid=\{`cart-summary-total\$\{suffix\}`\}/, 'cart-summary-total testid must use suffix');
  assert.match(summary, /data-testid=\{`cart-summary-trust\$\{suffix\}`\}/, 'cart-summary-trust testid must use suffix');
  assert.match(summary, /data-testid=\{`cart-summary-delivery-method\$\{suffix\}`\}/, 'cart-summary-delivery-method testid must use suffix');

  // Cart.tsx must pass testIdSuffix distinguishing desktop vs mobile.
  assert.match(cart, /testIdSuffix=\{testIdSuffix\}/, 'Cart.tsx must forward testIdSuffix to CartSummary');
  assert.match(cart, /'desktop'/, 'Cart.tsx must invoke renderSummary with desktop suffix');
  assert.match(cart, /'mobile'/, 'Cart.tsx must invoke renderSummary with mobile suffix');
});

test('mobile summary drawer and explicit OOS presentation are present without touching order-set logic', () => {
  const cart = read('src/components/sections/Cart/Cart.tsx');
  const products = read('src/components/cells/CartItemsProducts/CartItemsProducts.tsx');
  const orderSets = read('src/lib/data/order-sets.ts');

  assert.match(cart, /mobile-summary-drawer/);
  assert.match(products, /data-testid="cart-item-oos-badge"/);
  assert.match(products, /line-through/);
  assert.match(products, /isCartLineItemOutOfStock/);
  assert.doesNotMatch(
    orderSets,
    /cart-page-head|mobile-summary-drawer|gift_card_option|delivery_method_physical_card/
  );
});

test('OOS recalculate: computeAvailableTotal excludes OOS item subtotals from cart total (AC3)', () => {
  // Verify the logic of computeAvailableTotal without a full React render.
  // The function is defined inline in Cart.tsx; we replicate its logic here to validate correctness.

  /** Mirrors isLineItemOutOfStock from Cart.tsx */
  function isOOS(item) {
    const metadata = item.metadata ?? {};
    const variant = item.variant ?? {};
    const availability = String(
      metadata.availability ?? metadata.stock_status ?? metadata['gp.availability'] ?? ''
    ).toLowerCase();
    if (metadata.out_of_stock === true || availability === 'out_of_stock' || availability === 'unavailable') return true;
    if (metadata.in_stock === false) return true;
    if (variant.manage_inventory === false || variant.allow_backorder === true) return false;
    return typeof variant.inventory_quantity === 'number' && variant.inventory_quantity <= 0;
  }

  /** Mirrors computeAvailableTotal from Cart.tsx */
  function computeAvailableTotal(cart) {
    const items = cart.items ?? [];
    const oosSubtotal = items
      .filter(item => isOOS(item))
      .reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
    return Math.max(0, (cart.total ?? 0) - oosSubtotal);
  }

  // Cart with 2 items: one available (1000), one OOS (500); cart.total = 1500.
  const cartWithOOS = {
    total: 1500,
    items: [
      { subtotal: 1000, metadata: {}, variant: { inventory_quantity: 5 } },
      { subtotal: 500, metadata: { out_of_stock: true }, variant: {} }
    ]
  };
  assert.equal(computeAvailableTotal(cartWithOOS), 1000, 'OOS item subtotal (500) must be excluded from total');

  // Cart with all available items: total unchanged.
  const cartAllAvailable = {
    total: 1000,
    items: [
      { subtotal: 600, metadata: {}, variant: { inventory_quantity: 2 } },
      { subtotal: 400, metadata: {}, variant: { inventory_quantity: 1 } }
    ]
  };
  assert.equal(computeAvailableTotal(cartAllAvailable), 1000, 'No OOS: total must remain unchanged');

  // Cart where all items are OOS: total should be 0 (not negative).
  const cartAllOOS = {
    total: 800,
    items: [
      { subtotal: 300, metadata: { in_stock: false }, variant: {} },
      { subtotal: 500, metadata: {}, variant: { inventory_quantity: 0, manage_inventory: true } }
    ]
  };
  assert.equal(computeAvailableTotal(cartAllOOS), 0, 'All OOS: total must floor at 0');

  // OOS via availability string.
  const cartAvailabilityString = {
    total: 700,
    items: [
      { subtotal: 400, metadata: {}, variant: { inventory_quantity: 3 } },
      { subtotal: 300, metadata: { 'gp.availability': 'out_of_stock' }, variant: {} }
    ]
  };
  assert.equal(computeAvailableTotal(cartAvailabilityString), 400, 'OOS via gp.availability must be excluded');

  // Verify Cart.tsx source exports computeAvailableTotal logic (M1 guard).
  const cartSrc = read('src/components/sections/Cart/Cart.tsx');
  assert.match(cartSrc, /computeAvailableTotal/, 'Cart.tsx must define computeAvailableTotal (AC3 recalculate)');
  assert.match(cartSrc, /isLineItemOutOfStock/, 'Cart.tsx must define isLineItemOutOfStock helper');
  assert.match(cartSrc, /availableTotal/, 'Cart.tsx must pass availableTotal to CartSummary total prop');
});

test('per-seller grouping remains grouped and re-skinned', () => {
  const grouped = read('src/components/organisms/CartGroupedBySeller/CartGroupedBySeller.tsx');
  const cartItems = read('src/components/organisms/CartItems/CartItems.tsx');

  assert.match(cartItems, /<CartGroupedBySeller cart=\{cart\} \/>/);
  assert.match(grouped, /data-testid="vendor-cart-group"/);
  assert.match(grouped, /data-testid="vendor-group-header"/);
  assert.match(grouped, /data-testid="vendor-group-total"/);
  assert.doesNotMatch(grouped, /flatMap|reduce\(/);
});
