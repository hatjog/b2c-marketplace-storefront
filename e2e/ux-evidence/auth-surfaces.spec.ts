import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const locales = ['pl', 'en', 'ua', 'de'] as const;
const breakpoints = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 900 }
] as const;

const surfaces = [
  { id: 'login', path: '/login' },
  { id: 'register', path: '/register' },
  { id: 'forgot-password', path: '/forgot-password' },
  { id: 'reset-password', path: '/reset-password?token=sample-reset-token' },
  {
    id: 'user-register',
    path: '/user/register?email=anna.k%40example.com&order=BB-2026-04-3201'
  }
] as const;

test.describe('Wave 3 auth surfaces', () => {
  for (const locale of locales) {
    for (const surface of surfaces) {
      for (const breakpoint of breakpoints) {
        test(`${surface.id} ${locale} ${breakpoint.name}`, async ({ page }) => {
          await page.setViewportSize({
            width: breakpoint.width,
            height: breakpoint.height
          });
          await page.goto(`/${locale}${surface.path}`, { waitUntil: 'networkidle' });

          await expect(page.locator('main')).toBeVisible();

          const axe = await new AxeBuilder({ page }).analyze();
          expect(axe.violations.filter(item => item.impact === 'critical')).toEqual([]);

          await expect(page).toHaveScreenshot(
            `auth-${surface.id}-${locale}-${breakpoint.name}.png`,
            {
              fullPage: true,
              maxDiffPixelRatio: 0.03
            }
          );
        });
      }
    }
  }
});
