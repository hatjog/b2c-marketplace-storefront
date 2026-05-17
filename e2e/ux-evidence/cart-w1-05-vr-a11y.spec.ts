import { test, expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

import { findTestProductHandle, probeBackendHealth } from '../helpers/seed-helper';
import { paths } from '../fixtures/test-data';

const LOCALES = ['pl', 'en', 'ua', 'de'] as const;
const BREAKPOINTS = [375, 768, 1280] as const;
const ADD_TO_CART_SELECTOR =
  '[data-testid="product-add-to-cart-button"], [data-testid="add-to-cart"], button:has-text("Dodaj do koszyka"), button:has-text("Add to cart")';
const PRIMARY_PROJECT = 'chromium-ux-mobile-375';

async function acceptCookieBanner(page: Page): Promise<void> {
  const consentValue = encodeURIComponent(
    JSON.stringify({
      version: 1,
      ts: new Date().toISOString(),
      preferences: true,
      analytics: true,
      marketing: true,
    }),
  );
  await page.context().addCookies([
    {
      name: '_gp_consent_v1',
      value: consentValue,
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
      expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
    },
  ]);
}

function ensureSingleProject(testInfo: TestInfo): void {
  if (testInfo.project.name !== PRIMARY_PROJECT) {
    test.skip(true, `W1-05 VR/a11y suite runs only in ${PRIMARY_PROJECT}.`);
  }
}

async function openEmptyCart(page: Page, locale: (typeof LOCALES)[number]): Promise<void> {
  await page.context().clearCookies();
  await acceptCookieBanner(page);
  await page.goto(paths(locale).cart);
  await page.waitForLoadState('networkidle');
}

async function openDefaultCart(page: Page, locale: (typeof LOCALES)[number]): Promise<boolean> {
  await page.context().clearCookies();
  await acceptCookieBanner(page);

  const productHandle = await findTestProductHandle();
  if (!productHandle) {
    return false;
  }

  await page.goto(paths(locale).product(productHandle));
  await page.waitForLoadState('networkidle');
  const addToCartButton = page.locator(ADD_TO_CART_SELECTOR).first();
  const buttonVisible = await addToCartButton.isVisible({ timeout: 7_000 }).catch(() => false);
  if (!buttonVisible) {
    return false;
  }
  await addToCartButton.click();
  await page.goto(paths(locale).cart);
  await page.waitForLoadState('networkidle');
  return true;
}

test.beforeAll(async () => {
  const healthy = await probeBackendHealth();
  if (!healthy) {
    console.warn('[DEFERRED] Backend not reachable — W1-05 cart VR/a11y smoke deferred.');
    test.skip();
  }
});

test.describe('W1-05 Cart VR matrix', () => {
  for (const locale of LOCALES) {
    for (const width of BREAKPOINTS) {
      test(`default state snapshot — ${locale} @ ${width}`, async ({ page }, testInfo) => {
        ensureSingleProject(testInfo);
        await page.setViewportSize({ width, height: 1200 });
        const defaultStateReady = await openDefaultCart(page, locale);
        if (!defaultStateReady) {
          test.skip(true, `Cannot prepare default cart state for locale=${locale}.`);
        }

        await expect(page).toHaveScreenshot(
          `w1-05-cart-default-${locale}-${width}.png`,
          { fullPage: true, maxDiffPixelRatio: 0.02 },
        );
      });

      test(`empty state snapshot — ${locale} @ ${width}`, async ({ page }, testInfo) => {
        ensureSingleProject(testInfo);
        await page.setViewportSize({ width, height: 1200 });
        await openEmptyCart(page, locale);

        await expect(page).toHaveScreenshot(
          `w1-05-cart-empty-${locale}-${width}.png`,
          { fullPage: true, maxDiffPixelRatio: 0.02 },
        );
      });
    }
  }
});

test.describe('W1-05 Cart a11y smoke', () => {
  for (const locale of LOCALES) {
    test(`axe no serious/critical — default ${locale}`, async ({ page }, testInfo) => {
      ensureSingleProject(testInfo);
      await page.setViewportSize({ width: 375, height: 812 });
      const defaultStateReady = await openDefaultCart(page, locale);
      if (!defaultStateReady) {
        test.skip(true, `Cannot prepare default cart state for locale=${locale}.`);
      }

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blockers = results.violations.filter(
        violation => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(blockers).toHaveLength(0);
    });

    test(`axe no serious/critical — empty ${locale}`, async ({ page }, testInfo) => {
      ensureSingleProject(testInfo);
      await page.setViewportSize({ width: 375, height: 812 });
      await openEmptyCart(page, locale);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const blockers = results.violations.filter(
        violation => violation.impact === 'serious' || violation.impact === 'critical',
      );
      expect(blockers).toHaveLength(0);
    });
  }
});
