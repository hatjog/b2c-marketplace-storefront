import { expect, test } from '@playwright/test';

import { BASE_URL, BREAKPOINTS, LOCALES, setViewport } from './setup';

const ORDER_ID = 'vr-confirmation-order';

function mockConfirmationApis(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route(`**/api/v1/orders/${ORDER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: ORDER_ID,
          display_id: 'BB-2048',
          payment_status: 'paid',
          updated_at: '2026-05-18T10:00:00.000Z',
          metadata: { buyer_is_recipient: true },
        }),
      });
    }),
    page.route(`**/api/v1/entitlements?order_id=${ORDER_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            status: 'ACTIVE',
            voucher_code: 'ABCD1234EFGH',
            product_name: 'Voucher premium',
            salon_name: 'BonBeauty Atelier',
            face_value_minor: 29900,
            voucherRules: {
              validityMonths: 12,
              extension: {
                allowed: true,
                paid: true,
                feePct: 10,
                maxExtensionMonths: 3,
              },
              cancellation: 'Cancel directly with the salon at least 24h in advance.',
              refundChannel: 'Refund goes back to the original payment method.',
              noShow: 'A repeated no-show may close the voucher without refund.',
            },
          },
        ]),
      });
    }),
  ]);
}

for (const bp of BREAKPOINTS) {
  test(`W1-07 confirmation — pl ${bp.name}`, async ({ page }) => {
    await mockConfirmationApis(page);
    await setViewport(page, bp);
    await page.goto(`${BASE_URL}/pl/order/${ORDER_ID}/confirmed`);

    await page.waitForSelector('[data-testid="self-purchase-confirmed"]', { timeout: 15_000 });
    await expect(page.locator('[data-testid="confirmation-voucher-rules-card"]')).toBeVisible();

    await expect(page).toHaveScreenshot(`w1-07-confirmation-pl-${bp.name}.png`, {
      maxDiffPixelRatio: 0.02,
      fullPage: false,
      clip: { x: 0, y: 0, width: bp.width, height: bp.height },
    });
  });
}

for (const locale of LOCALES.filter((entry) => entry !== 'pl')) {
  test(`W1-07 confirmation smoke — ${locale}`, async ({ page }) => {
    await mockConfirmationApis(page);
    await setViewport(page, BREAKPOINTS[0]);
    await page.goto(`${BASE_URL}/${locale}/order/${ORDER_ID}/confirmed`);

    const card = page.locator('[data-testid="confirmation-voucher-rules-card"]');
    await expect(card).toBeVisible();
    await expect(card).toHaveCSS('overflow', 'visible');
  });
}
