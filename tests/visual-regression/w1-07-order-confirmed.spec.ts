import { expect, test } from '@playwright/test';

import { BASE_URL, BREAKPOINTS, LOCALES, setViewport } from './setup';

const ORDER_ID = process.env.ORDER_CONFIRMED_TEST_ID ?? 'test-order-confirmed';

for (const locale of LOCALES) {
  for (const bp of BREAKPOINTS) {
    test(`W1-07 confirmed — ${locale} ${bp.name}`, async ({ page }) => {
      await setViewport(page, bp);
      await page.goto(`${BASE_URL}/${locale}/order/${ORDER_ID}/confirmed`, {
        waitUntil: 'networkidle'
      });

      const root = page.locator('[data-testid="order-confirmed-w1-07"]');
      await expect(root).toBeVisible();

      await expect(page).toHaveScreenshot(`w1-07-confirmed-${locale}-${bp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        fullPage: false,
        clip: { x: 0, y: 0, width: bp.width, height: bp.height }
      });
    });
  }
}
