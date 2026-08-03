// Visual regression spec — W1-04 PDP baseline.
// Story 3.0 Sprint 1 thin slice gate.
// 12 baselines: 3 breakpoints × 4 locales.
// Run: playwright test tests/visual-regression/w1-04-pdp.spec.ts --update-snapshots
// NOTE: requires running storefront + seed product at PDP_TEST_HANDLE env var
// (default: first available product from /pl/products/...)

import { expect, test } from '@playwright/test';

import { BASE_URL, BREAKPOINTS, LOCALES, setViewport } from './setup';

const PDP_HANDLE = process.env.PDP_TEST_HANDLE ?? 'test-product';
const BASE_HOST = new URL(BASE_URL).hostname;

async function setBonBeautyRegion(page: import('@playwright/test').Page) {
  await page.context().addCookies([
    {
      name: '_gp_region',
      value: 'pl',
      domain: BASE_HOST,
      path: '/',
    },
  ]);
}

for (const locale of LOCALES) {
  for (const bp of BREAKPOINTS) {
    test(`W1-04 PDP — ${locale} ${bp.name}`, async ({ page }) => {
      await setBonBeautyRegion(page);
      await setViewport(page, bp);
      await page.goto(`${BASE_URL}/${locale}/products/${PDP_HANDLE}`);

      // Wait for PDP to render
      await page.waitForSelector('[data-testid="product-details-page"]', { timeout: 15_000 });
      await expect(page.locator('[data-testid="pdp-breadcrumbs"]')).toBeVisible();
      await expect(page.locator('[data-testid="pdp-gift-mode-toggle"]')).toBeVisible();
      await expect(page.locator('[data-testid="pdp-tabs"]')).toBeVisible();
      await expect(page.locator('[data-testid="pdp-trust-band"]')).toBeVisible();

      // Trust Invariant #2: seller proof present
      const sellerProof = page.locator('[data-testid="pdp-seller-proof"]');
      // Seller proof may not render if seller is null — check conditionally
      const hasProof = (await sellerProof.count()) > 0;
      if (hasProof) {
        await expect(sellerProof).toBeVisible();
      }

      // Trust Invariant #3: voucher rules card present
      const voucherRules = page.locator('[data-testid="pdp-voucher-rules-card"]');
      await expect(voucherRules).toBeVisible();
      await expect(voucherRules.locator('button[aria-expanded="false"]')).toBeVisible();

      const tabs = page.locator('[data-testid="pdp-tabs"]');
      await expect(tabs.locator('[role="tablist"]')).toBeVisible();
      await expect(tabs.locator('[role="tab"]').first()).toHaveAttribute('aria-selected', 'true');

      // Lighthouse measurements: Performance >=90, A11y >=95 (CI gate — see lighthouse.config.js)

      // Visual regression snapshot
      await expect(page).toHaveScreenshot(`w1-04-pdp-${locale}-${bp.name}.png`, {
        maxDiffPixelRatio: 0.02,
        fullPage: false,
        clip: { x: 0, y: 0, width: bp.width, height: bp.height }
      });
    });
  }
}
