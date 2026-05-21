import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { BASE_URL, LOCALES } from './setup';

const PDP_HANDLE = process.env.PDP_TEST_HANDLE ?? 'test-product';

for (const locale of LOCALES) {
  test(`W1-04 PDP a11y — ${locale}`, async ({ page }) => {
    await page.goto(`${BASE_URL}/${locale}/products/${PDP_HANDLE}`);
    await page.waitForSelector('[data-testid="product-details-page"]', { timeout: 15_000 });
    await page.waitForSelector('[data-testid="pdp-tabs"]', { timeout: 15_000 });

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    const criticalViolations = accessibilityScanResults.violations.filter(
      violation => violation.impact === 'critical'
    );

    expect(criticalViolations).toEqual([]);
  });
}
