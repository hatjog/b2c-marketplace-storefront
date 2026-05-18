import { expect, test } from '@playwright/test';

import { BREAKPOINTS, LOCALES, BASE_URL, setViewport } from './setup';

const ACTIVE_CODE = 'E2E-RECIPIENT-ACTIVE-001';

for (const locale of LOCALES) {
  for (const bp of BREAKPOINTS) {
    test(`W2-14 voucher recipient active smoke — ${locale} ${bp.name}`, async ({ page }) => {
      await setViewport(page, bp);
      await page.goto(`${BASE_URL}/${locale}/voucher/${ACTIVE_CODE}`);

      await page.waitForSelector('[data-testid="voucher-recipient-page"]', { timeout: 15_000 });
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('button', { hasText: /copy|kopiuj|скопіювати|kopieren/i })).toBeVisible();

      await expect(page).toHaveScreenshot(`w2-14-voucher-recipient-active-${locale}-${bp.name}.png`, {
        maxDiffPixelRatio: 0.03,
        fullPage: false,
        clip: { x: 0, y: 0, width: bp.width, height: bp.height },
      });
    });
  }
}
