// Visual regression spec — W1-01 Home v3 baseline.
// Story 3.0 Sprint 1 thin slice gate.
// 12 baselines: 3 breakpoints × 4 locales.
// Run: playwright test tests/visual-regression/w1-01-home.spec.ts --update-snapshots
// NOTE: requires running storefront (pnpm dev) at PLAYWRIGHT_BASE_URL (default: http://localhost:3000)

import { test, expect } from '@playwright/test';
import { BREAKPOINTS, LOCALES, BASE_URL, setViewport } from './setup';

for (const locale of LOCALES) {
  for (const bp of BREAKPOINTS) {
    test(`W1-01 home v3 — ${locale} ${bp.name}`, async ({ page }) => {
      await setViewport(page, bp);
      await page.goto(`${BASE_URL}/${locale}`);

      // Wait for editorial sections to render
      await page.waitForSelector('[data-testid="trust-strip"]', { timeout: 10_000 });

      // Trust Invariant #1: verified mark present
      const verifiedMark = page.locator('[data-testid="home-verified-mark"]');
      await expect(verifiedMark).toBeVisible();

      // Visual regression snapshot
      await expect(page).toHaveScreenshot(
        `w1-01-home-${locale}-${bp.name}.png`,
        {
          maxDiffPixelRatio: 0.02,
          fullPage: false,
          clip: { x: 0, y: 0, width: bp.width, height: bp.height },
        }
      );
    });
  }
}
