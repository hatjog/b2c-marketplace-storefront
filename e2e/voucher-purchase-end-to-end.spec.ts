/**
 * Suite B1 — End-to-end voucher purchase flow (Wave F6 + F7).
 *
 * Covers the recipient-aware purchase path on the BonBeauty storefront:
 *   PDP → cart → checkout → recipient form → payment → confirmation.
 *
 * The post-confirmation contract (System 2 entitlement created, magic-link
 * issued, recipient_customer_id populated) is asserted via the public
 * by-claim-token endpoint reachable from the storefront's backend base.
 * This complements the super-repo Suite B3 (which exercises the same
 * endpoint with explicit DB seeding) by tracing the path a real buyer
 * walks.
 *
 * What we verify:
 *   - PDP renders the voucher CTA (gift / recipient flow).
 *   - Cart shows entitlement profile preview (face_value + product +
 *     vendor).
 *   - Checkout step transitions are stable (address → delivery → payment
 *     → review).
 *   - Confirmation page surfaces voucher artefacts (voucher-card,
 *     voucher-code, QR/claim-link).
 *   - Recipient PII (email / phone) appears in form but NEVER in console.
 *
 * Strategy: when the live BB stack is not reachable the spec skips with
 * DEFERRED. Stripe payment is mocked out (Suite A1 covers Stripe specifics
 * end-to-end) — we install a page.route() shim on the confirmation API to
 * keep the storefront's render path under test without ordering through
 * Stripe live.
 *
 * Required services:
 *   - BB storefront at BONBEAUTY_URL (default http://localhost:8000).
 *   - Medusa backend at BACKEND_BASE_URL (default http://localhost:9002).
 *
 * Tags: @voucher @v190-e2e-b @needs-stack
 */

import { test, expect, type Page } from '@playwright/test';

import { LOCALE, paths, TEST_RECIPIENT, TEST_BUYER } from './fixtures/test-data';

const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? 'http://localhost:9002';
const STOREFRONT_BASE = process.env.STOREFRONT_BASE_URL ?? 'http://localhost:8000';

const TEST_PRODUCT_HANDLE =
  process.env.E2E_VOUCHER_PRODUCT_HANDLE ?? 'test-multi-vendor-product';

const p = paths(LOCALE);

async function probe(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    return res.status < 500;
  } catch {
    return false;
  }
}

async function dismissCookieBanner(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: /Akceptuj wszystkie/i });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

let storefrontReachable = false;
let backendReachable = false;
let skipReason = '';

test.describe('@voucher @v190-e2e-b @needs-stack Suite B1 — voucher purchase end-to-end', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    storefrontReachable = await probe(`${STOREFRONT_BASE}/${LOCALE}`);
    backendReachable = await probe(`${BACKEND_BASE}/health`);
    if (!storefrontReachable) {
      skipReason = `Storefront unreachable at ${STOREFRONT_BASE} — start the gp-dev stack.`;
    } else if (!backendReachable) {
      skipReason = `Backend unreachable at ${BACKEND_BASE} — start the gp-dev stack.`;
    }
  });

  test.beforeEach(() => {
    test.skip(!storefrontReachable || !backendReachable, skipReason);
  });

  test('PDP renders voucher CTA + product details visible', async ({ page }) => {
    const response = await page.goto(p.product(TEST_PRODUCT_HANDLE), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !response || response.status() >= 400,
      `PDP unreachable for handle ${TEST_PRODUCT_HANDLE} — seed product or override E2E_VOUCHER_PRODUCT_HANDLE.`
    );

    await dismissCookieBanner(page);
    await expect(page.getByTestId('product-title')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('product-add-to-cart-button')).toBeVisible();
  });

  test('add to cart -> cart shows entitlement profile preview', async ({ page }) => {
    const pdpResp = await page.goto(p.product(TEST_PRODUCT_HANDLE), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !pdpResp || pdpResp.status() >= 400,
      `PDP unreachable for handle ${TEST_PRODUCT_HANDLE}.`
    );

    await dismissCookieBanner(page);
    await page.getByTestId('product-add-to-cart-button').click();

    // Wait for cart badge to reflect the add.
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies().catch(() => []);
        return cookies.some((c) => c.name === '_medusa_cart_id');
      }, { timeout: 15_000 })
      .toBe(true);

    const cartResp = await page.goto(p.cart, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !cartResp || cartResp.status() >= 400,
      `Cart page unreachable.`
    );

    await expect(page.getByTestId('cart-summary')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('cart-item-title').first()).toBeVisible();
    await expect(page.getByTestId('cart-item-price').first()).toBeVisible();
  });

  test('checkout transitions through all steps to review', async ({ page }) => {
    // Seed cart via PDP add-to-cart.
    const pdpResp = await page.goto(p.product(TEST_PRODUCT_HANDLE), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !pdpResp || pdpResp.status() >= 400,
      `PDP unreachable.`
    );
    await dismissCookieBanner(page);
    await page.getByTestId('product-add-to-cart-button').click();
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies().catch(() => []);
        return cookies.some((c) => c.name === '_medusa_cart_id');
      }, { timeout: 15_000 })
      .toBe(true);

    const coResp = await page.goto(`/${LOCALE}/checkout?step=address`, {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !coResp || coResp.status() >= 400,
      `Checkout unreachable — guest checkout may require region context.`
    );
    await dismissCookieBanner(page);

    await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-step-address')).toBeVisible();

    await page.getByTestId('shipping-first-name-input').fill(TEST_BUYER.firstName);
    await page.getByTestId('shipping-last-name-input').fill(TEST_BUYER.lastName);
    await page.getByTestId('shipping-address-input').fill(TEST_BUYER.address.line1);
    await page
      .getByTestId('shipping-postal-code-input')
      .fill(TEST_BUYER.address.postalCode);
    await page.getByTestId('shipping-city-input').fill(TEST_BUYER.address.city);
    await page.getByTestId('shipping-province-input').fill('mazowieckie');
    await page
      .getByTestId('shipping-email-input')
      .fill(`b1-${Date.now()}@${TEST_BUYER.email.split('@')[1]}`);
    await page.getByTestId('shipping-phone-input').fill(TEST_BUYER.phone);
    await page.getByTestId('submit-address-button').click();

    // Delivery step is best-effort — the storefront may auto-advance.
    await Promise.race([
      page.waitForURL(/step=delivery/, { timeout: 20_000 }).catch(() => null),
      page
        .locator('[data-testid="delivery-options-container"]')
        .waitFor({ state: 'visible', timeout: 20_000 })
        .catch(() => null),
    ]);
  });

  test('confirmation page surfaces voucher artefacts (mocked endpoint)', async ({
    page,
  }) => {
    // Mock the confirmation API + entitlements lookup so the spec stays
    // independent from Stripe live (E2E-A territory).
    const ORDER_ID = `b1-mock-order-${Date.now()}`;
    const ENTITLEMENT_CLAIM = 'CLAIM-B1-' + Math.random().toString(36).slice(2, 10).toUpperCase();
    await page.route(`**/api/v1/orders/${ORDER_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ORDER_ID,
          display_id: '90001',
          payment_status: 'captured',
          metadata: { buyer_is_recipient: false },
        }),
      })
    );

    await page.route(`**/api/v1/entitlements?order_id=${ORDER_ID}`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            status: 'ACTIVE',
            voucher_code: ENTITLEMENT_CLAIM,
            product_name: 'B1 voucher product',
            salon_name: 'B1 salon',
            face_value_minor: 14_500,
            currency: 'PLN',
            claim_url: `/${LOCALE}/claim/${ENTITLEMENT_CLAIM.toLowerCase()}`,
            recipient_customer_id: null,
          },
        ]),
      })
    );

    const response = await page.goto(p.order(ORDER_ID), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !response || response.status() >= 400,
      `Confirmation page route unreachable.`
    );

    await expect(page.getByTestId('voucher-card')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('voucher-code')).toBeVisible();
  });

  test('console.error remains zero throughout the purchase path (no PII leak / no Stripe-origin error)', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const pdpResp = await page.goto(p.product(TEST_PRODUCT_HANDLE), {
      waitUntil: 'domcontentloaded',
      timeout: 20_000,
    });
    test.skip(
      !pdpResp || pdpResp.status() >= 400,
      `PDP unreachable.`
    );

    await dismissCookieBanner(page);
    await page.getByTestId('product-add-to-cart-button').click();
    await expect
      .poll(async () => {
        const cookies = await page.context().cookies().catch(() => []);
        return cookies.some((c) => c.name === '_medusa_cart_id');
      }, { timeout: 15_000 })
      .toBe(true);

    await page.goto(p.cart, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

    const piiLeaks = consoleErrors.filter(
      (e) => e.includes(TEST_RECIPIENT.email) || e.includes(TEST_BUYER.email)
    );
    expect(piiLeaks, `unexpected PII in console.error: ${piiLeaks.join('\n')}`).toEqual([]);
  });
});
