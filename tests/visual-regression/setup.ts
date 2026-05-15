// Visual regression baseline setup — Story 3.0 Sprint 1 thin slice gate.
// 24 baselines: 2 surfaces (W1-01 home v3, W1-04 PDP) × 3 breakpoints × 4 locales.
// Usage: requires running storefront (pnpm dev or staging URL).
// Baseline capture: playwright test --update-snapshots

import type { Page } from '@playwright/test';

export const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

export const LOCALES = ['pl', 'en', 'ua', 'de'] as const;

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

export async function setViewport(page: Page, breakpoint: typeof BREAKPOINTS[number]) {
  await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
}

export function surfaceUrl(locale: string, surface: 'home' | 'pdp', pdpHandle?: string): string {
  if (surface === 'home') {
    return `${BASE_URL}/${locale}`;
  }
  return `${BASE_URL}/${locale}/products/${pdpHandle ?? 'test-product'}`;
}
