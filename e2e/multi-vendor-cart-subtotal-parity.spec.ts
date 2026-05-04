import { test, expect } from '@playwright/test';

import { ensureFlagOn, getFlagState, setFlagState, type MultiVendorFlagState } from './helpers/flag-helper';
import { findProductsFromMultipleSellers, probeBackendHealth } from './helpers/seed-helper';
import { LOCALE, paths } from './fixtures/test-data';

const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? 'http://localhost:9002';
const PUBLISHABLE_KEY =
  process.env.E2E_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
  'pk_73cc512f8b76b8aed24c0dbf855b19388347822946480b8e6207684769ceb0f9';

const p = paths(LOCALE);

function formatMinorAmount(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount / 100);
}

async function getCartIdFromCookies(page: Parameters<typeof test>[0]['page']): Promise<string | null> {
  const cookies = await page.context().cookies();
  return cookies.find((cookie) => cookie.name === '_medusa_cart_id')?.value ?? null;
}

async function fetchOrderSetSplits(cartId: string) {
  const res = await fetch(`${BACKEND_BASE}/store/carts/${cartId}/order-sets`, {
    headers: {
      Accept: 'application/json',
      'x-publishable-api-key': PUBLISHABLE_KEY,
    },
  });

  if (!res.ok) {
    throw new Error(`order-sets fetch failed: ${res.status} ${res.statusText}`);
  }

  const body = (await res.json()) as {
    order_set_splits?: Array<{
      seller_id: string;
      subtotal: number;
    }>;
  };

  return body.order_set_splits ?? [];
}

let previousFlagState: MultiVendorFlagState = 'on';

test.beforeAll(async () => {
  const healthy = await probeBackendHealth();
  if (!healthy) {
    console.warn('[DEFERRED] Backend not reachable — cart subtotal parity E2E deferred.');
    test.skip();
    return;
  }

  previousFlagState = await ensureFlagOn();
});

test.afterAll(async () => {
  const healthy = await probeBackendHealth();
  if (!healthy) return;

  if (previousFlagState === 'off') {
    const current = await getFlagState();
    if (current !== 'off') {
      if (current === 'on') {
        await setFlagState('shadow');
      }
      await setFlagState('off');
    }
  } else if (previousFlagState === 'shadow') {
    const current = await getFlagState();
    if (current === 'on') {
      await setFlagState('shadow');
    }
  }
});

test('Cart page vendor subtotals mirror backend order-set splits', async ({ page }) => {
  const seedResult = await findProductsFromMultipleSellers(2);
  if (!seedResult || seedResult.productHandles.length < 2) {
    console.warn('[DEFERRED] Not enough multi-seller products for subtotal parity E2E.');
    test.skip();
    return;
  }

  for (const handle of seedResult.productHandles.slice(0, 2)) {
    await page.goto(p.product(handle));

    const addToCartButton = page.locator(
      '[data-testid="add-to-cart"], button:has-text("Dodaj do koszyka")',
    );
    await expect(addToCartButton).toBeVisible({ timeout: 10_000 });
    await addToCartButton.click();
  }

  await page.goto(p.cart);

  const cartId = await getCartIdFromCookies(page);
  expect(cartId).toBeTruthy();

  const splits = await fetchOrderSetSplits(cartId as string);
  expect(splits.length).toBeGreaterThanOrEqual(2);

  const vendorGroups = page.locator('[data-testid="vendor-cart-group"]');
  await expect(vendorGroups).toHaveCount(splits.length);

  for (const split of splits) {
    const group = page.locator(`[data-testid="vendor-cart-group"][data-seller-id="${split.seller_id}"]`);
    await expect(group).toBeVisible({ timeout: 10_000 });

    const total = group.locator('[data-testid="vendor-group-total"]');
    await expect(total).toContainText(formatMinorAmount(split.subtotal, 'PLN'));
  }
});