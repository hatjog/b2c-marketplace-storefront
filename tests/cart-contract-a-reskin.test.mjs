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

test('per-seller grouping remains grouped and re-skinned', () => {
  const grouped = read('src/components/organisms/CartGroupedBySeller/CartGroupedBySeller.tsx');
  const cartItems = read('src/components/organisms/CartItems/CartItems.tsx');

  assert.match(cartItems, /<CartGroupedBySeller cart=\{cart\} \/>/);
  assert.match(grouped, /data-testid="vendor-cart-group"/);
  assert.match(grouped, /data-testid="vendor-group-header"/);
  assert.match(grouped, /data-testid="vendor-group-total"/);
  assert.doesNotMatch(grouped, /flatMap|reduce\(/);
});
