import { expect, test } from '@playwright/test';

type Win = typeof window & { __fontSwapCls: number; __fontObserver?: PerformanceObserver };

test('body computes to Funnel Display with zero CLS after font readiness', async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    (window as Win).__fontSwapCls = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutShift = entry as LayoutShift;
        if (!layoutShift.hadRecentInput) {
          (window as Win).__fontSwapCls += layoutShift.value;
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });
    // Expose observer so we can call takeRecords() before reading the accumulator.
    (window as Win).__fontObserver = observer;
  });

  const baseUrl =
    process.env.STOREFRONT_E2E_BASE_URL ?? testInfo.project.use.baseURL ?? 'http://localhost:8000';
  const route = process.env.FONT_CASCADE_ROUTE ?? '/pl';

  const response = await page.goto(new URL(route, baseUrl).toString(), { waitUntil: 'networkidle' });
  // Require a proper 2xx — a 404 would still render the root layout with body-font
  // set and CLS=0, producing a false-positive measurement.
  expect(response?.ok()).toBeTruthy();

  await page.evaluate(() => document.fonts.ready);

  // PerformanceObserver delivers layout-shift entries in a separate task, potentially
  // after document.fonts.ready resolves. Flush the observer queue and wait two
  // animation frames so all post-swap layout-shift reports are counted before we read.
  await page.evaluate(() => {
    const w = window as Win;
    w.__fontObserver?.takeRecords().forEach((e) => {
      const ls = e as LayoutShift;
      if (!ls.hadRecentInput) w.__fontSwapCls += ls.value;
    });
    return new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });

  const bodyFontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  // document.fonts.check proves the .ttf actually loaded, not just that the CSS stack
  // declares "Funnel Display" as the first name (which would pass even on fallback).
  const fontLoaded = await page.evaluate(() => document.fonts.check("16px 'Funnel Display'"));
  const cls = await page.evaluate(
    () => (window as Win).__fontSwapCls,
  );

  expect(fontLoaded).toBe(true);
  expect(bodyFontFamily).toContain('Funnel Display');
  expect(cls).toBe(0);
});

type LayoutShift = PerformanceEntry & {
  value: number;
  hadRecentInput: boolean;
};
