import { expect, test } from '@playwright/test';

import { BREAKPOINTS, LOCALES, BASE_URL, setViewport } from './setup';

const ACTIVE_CODE = 'E2E-RECIPIENT-ACTIVE-001';
const DESKTOP_STATES = [
  { name: 'active', code: ACTIVE_CODE },
  { name: 'expired', code: 'E2E-RECIPIENT-EXPIRED-001' },
  { name: 'redeemed', code: 'E2E-RECIPIENT-REDEEMED-001' },
] as const;

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

for (const locale of LOCALES) {
  test(`W2-14 voucher recipient desktop state smoke — ${locale}`, async ({ page }) => {
    const desktop = BREAKPOINTS.find((bp) => bp.name === 'desktop') ?? BREAKPOINTS[BREAKPOINTS.length - 1];
    await setViewport(page, desktop);

    for (const state of DESKTOP_STATES) {
      await page.goto(`${BASE_URL}/${locale}/voucher/${state.code}`);
      await page.waitForSelector('[data-testid="voucher-recipient-page"]', { timeout: 15_000 });
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveScreenshot(`w2-14-voucher-recipient-${state.name}-${locale}-desktop.png`, {
        maxDiffPixelRatio: 0.03,
        fullPage: false,
        clip: { x: 0, y: 0, width: desktop.width, height: desktop.height },
      });
    }
  });
}
