import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('checkout page exposes contract-A header, four numbered steps and order-summary trust markers', () => {
  const page = read('src/app/[locale]/(checkout)/checkout/page.tsx');
  const address = read('src/components/sections/CartAddressSection/CartAddressSection.tsx');
  const delivery = read('src/components/sections/CartShippingMethodsSection/CartShippingMethodsSection.tsx');
  const purchaseMode = read('src/components/sections/CheckoutPurchaseMode/CheckoutPurchaseMode.tsx');
  const payment = read('src/components/sections/CartPaymentSection/CartPaymentSection.tsx');
  const checkoutSurface = [page, address, delivery, purchaseMode, payment].join('\n');
  const plMessages = JSON.parse(read('messages/pl.json'));

  assert.match(page, /className="checkout-header/);
  assert.match(page, /className="secure-pill/);
  assert.match(page, /checkout_header_secure/);
  assert.match(page, /checkout_header_phone/);

  assert.match(checkoutSurface, /step-num/);
  assert.match(checkoutSurface, /step-head/);
  assert.match(checkoutSurface, /checkout_step_contact/);
  assert.match(checkoutSurface, /checkout_step_delivery/);
  assert.match(checkoutSurface, /checkout_step_invoice/);
  assert.match(checkoutSurface, /checkout_step_payment/);
  assert.match(checkoutSurface, /is-done/);
  assert.match(purchaseMode, /checkout_step_invoice/);

  assert.equal(plMessages.checkout.checkout_step_contact, 'Kontakt');
  assert.equal(plMessages.checkout.checkout_step_delivery, 'Dostawa vouchera');
  assert.equal(plMessages.checkout.checkout_step_invoice, 'Faktura VAT');
  assert.equal(plMessages.checkout.checkout_step_payment, 'Płatność');
  assert.equal(plMessages.checkout.checkout_header_secure, 'Bezpieczna płatność');
  assert.equal(plMessages.checkout.checkout_header_phone, '+48 22 555 41 22');

  assert.match(page, /os-method-badge/);
  assert.match(page, /os-trust-row/);
  assert.equal(plMessages.checkout.order_summary_method_badge, 'Voucher PDF · email');
  assert.deepEqual(plMessages.checkout.order_summary_trust_tokens, [
    'Stripe',
    'SSL',
    '30 dni zwrot'
  ]);
});

test('payment step exposes pm-grid, consent-block and gold loading spinner markers without adding providers', () => {
  const payment = read('src/components/sections/CartPaymentSection/CartPaymentSection.tsx');
  const stripe = read('src/components/sections/CartPaymentSection/StripePaymentElement.tsx');
  const paymentWrapper = read('src/components/organisms/PaymentContainer/PaymentWrapper.tsx');
  const plMessages = JSON.parse(read('messages/pl.json'));

  assert.match(payment, /pm-grid/);
  assert.match(payment, /pmchip/);
  assert.match(payment, /is-active/);
  assert.match(payment, /consent-block/);
  assert.match(payment, /consent-row/);
  assert.match(payment, /req-mark/);
  assert.match(payment, /availablePaymentMethods/);
  assert.doesNotMatch(payment, /provider_id:\s*['"]pp_/);

  assert.deepEqual(plMessages.checkout.payment_method_chips, [
    'Karta',
    'BLIK',
    'Przelewy24',
    'Apple Pay',
    'Google Pay'
  ]);
  assert.equal(
    plMessages.checkout.payment_consent_required,
    'Akceptuję regulamin BonBeauty i politykę vouchera.'
  );

  assert.match(payment, /checkout-spinner-gold/);
  assert.match(stripe, /checkout-spinner-gold/);
  assert.match(paymentWrapper, /s\.status ===\s*'pending'/);
});
