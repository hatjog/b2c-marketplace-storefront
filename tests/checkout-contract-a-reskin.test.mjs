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

  // INFO-1 fix: checkout_step_contact / checkout_step_invoice are consumed from
  // seller.checkout namespace (CartAddressSection + CheckoutPurchaseMode use
  // useTranslations('seller.checkout')).  Assert against the correct namespace.
  assert.equal(plMessages['seller']['checkout'].checkout_step_contact, 'Kontakt');
  assert.equal(plMessages.checkout.checkout_step_delivery, 'Dostawa vouchera');
  assert.equal(plMessages['seller']['checkout'].checkout_step_invoice, 'Faktura VAT');
  assert.equal(plMessages.checkout.checkout_step_payment, 'Płatność');
  assert.equal(plMessages.checkout.checkout_header_secure, 'Bezpieczna płatność');
  assert.equal(plMessages.checkout.checkout_header_phone, '+48 22 555 41 22');

  assert.match(page, /os-method-badge/);
  assert.match(page, /os-trust-row/);
  assert.equal(plMessages.checkout.order_summary_method_badge, 'Voucher PDF · email');
  // INFO-1 fix: trust tokens are expressed as three individual keys consumed by code;
  // the array key is unused.  Assert individual keys that the code actually reads.
  assert.equal(plMessages.checkout.order_summary_trust_stripe, 'Stripe');
  assert.equal(plMessages.checkout.order_summary_trust_ssl, 'SSL');
  assert.equal(plMessages.checkout.order_summary_trust_return, '30 dni zwrot');
});

// DW-15-326: the standalone payment-method chips (pm-grid / pmchip / is-active)
// were removed on purpose in 86600d5f5 (2026-06-14): they duplicated the
// embedded Stripe PaymentElement, which is now the single method picker. The
// contract is inverted accordingly: no second picker, PaymentElement mounted,
// and method enablement still driven by Stripe payment_method_types.
test('payment step uses PaymentElement as the single method picker and keeps consent-block and gold loading spinner markers without adding providers', () => {
  const payment = read('src/components/sections/CartPaymentSection/CartPaymentSection.tsx');
  const stripe = read('src/components/sections/CartPaymentSection/StripePaymentElement.tsx');
  const paymentWrapper = read('src/components/organisms/PaymentContainer/PaymentWrapper.tsx');
  const plMessages = JSON.parse(read('messages/pl.json'));

  assert.doesNotMatch(payment, /pm-grid/);
  assert.doesNotMatch(payment, /pmchip/);
  assert.match(payment, /<StripePaymentElement\b/);
  assert.match(payment, /consent-block/);
  assert.match(payment, /consent-row/);
  assert.match(payment, /req-mark/);
  assert.match(payment, /availablePaymentMethods/);
  assert.doesNotMatch(payment, /provider_id:\s*['"]pp_/);

  // MEDIUM-1 fix: chips are visual indicators of Stripe payment_method_types;
  // no array key needed — assert individual chip label keys used by code.
  assert.equal(plMessages.checkout.payment_method_chip_card, 'Karta');
  assert.equal(plMessages.checkout.payment_method_chip_blik, 'BLIK');
  assert.equal(plMessages.checkout.payment_method_chip_p24, 'Przelewy24');
  assert.equal(plMessages.checkout.payment_method_chip_apple_pay, 'Apple Pay');
  assert.equal(plMessages.checkout.payment_method_chip_google_pay, 'Google Pay');

  assert.equal(
    plMessages.checkout.payment_consent_required,
    'Akceptuję regulamin BonBeauty i politykę vouchera.'
  );

  // MEDIUM-2 fix: consent-block must NOT pre-tick the required consent row.
  // Verify the is-checked class is absent from the required consent row in
  // source (pre-tick would violate GDPR Art. 7 active opt-in).
  assert.doesNotMatch(payment, /consent-row is-checked/);

  // LOW-2 fix (carried over): method enablement uses getEnabledPaymentMethodTypes
  // (Stripe payment_method_types), not matchPaymentProviderId (provider-ID
  // approach that always disabled BLIK/P24). It now lives in the PaymentElement.
  assert.match(stripe, /getEnabledPaymentMethodTypes\(\)/);
  assert.doesNotMatch(payment, /matchPaymentProviderId/);
  assert.doesNotMatch(stripe, /matchPaymentProviderId/);

  assert.match(payment, /checkout-spinner-gold/);
  assert.match(stripe, /checkout-spinner-gold/);
  assert.match(paymentWrapper, /s\.status ===\s*'pending'/);
});
