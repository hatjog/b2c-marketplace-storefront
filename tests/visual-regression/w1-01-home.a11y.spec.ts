import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

import { BASE_URL, LOCALES } from './setup';

for (const locale of LOCALES) {
  test(`W1-01 home v3 a11y — ${locale}`, async ({ page }) => {
    await page.goto(`${BASE_URL}/${locale}`);
    await page.waitForSelector('[data-testid="home-search-widget"]', { timeout: 10_000 });
    await page.waitForSelector('[data-testid="trust-strip"]', { timeout: 10_000 });

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    const criticalViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.impact === 'critical'
    );

    expect(criticalViolations).toEqual([]);
  });
}
