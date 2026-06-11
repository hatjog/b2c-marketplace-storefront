import { expect, test } from '@playwright/test';

test('body computes to Funnel Display with zero CLS after font readiness', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    (window as typeof window & { __fontSwapCls: number }).__fontSwapCls = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as LayoutShift;
        if (!layoutShift.hadRecentInput) {
          (window as typeof window & { __fontSwapCls: number }).__fontSwapCls += layoutShift.value;
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  });

  const baseUrl =
    process.env.STOREFRONT_E2E_BASE_URL ?? testInfo.project.use.baseURL ?? 'http://localhost:8000';
  const route = process.env.FONT_CASCADE_ROUTE ?? '/pl';

  const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'networkidle' });
  expect(response?.status()).toBeLessThan(500);
  await page.evaluate(() => document.fonts.ready);

  const bodyFontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const cls = await page.evaluate(() => (window as typeof window & { __fontSwapCls: number }).__fontSwapCls);

  expect(bodyFontFamily).toContain('Funnel Display');
  expect(cls).toBe(0);
});

type LayoutShift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};
