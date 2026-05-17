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
export const WAVE6_REQUIRE_PREVIEW_HARNESS =
  process.env.WAVE6_REQUIRE_PREVIEW_HARNESS === '1';

export async function setViewport(page: Page, breakpoint: typeof BREAKPOINTS[number]) {
  await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
}

export function surfaceUrl(locale: string, surface: 'home' | 'pdp', pdpHandle?: string): string {
  if (surface === 'home') {
    return `${BASE_URL}/${locale}`;
  }
  return `${BASE_URL}/${locale}/products/${pdpHandle ?? 'test-product'}`;
}

// --- v1.8.0 Story 3.1 — Wave 6 chrome full impl VR matrix ---------------
// 6 components × variants × 3 breakpoints × 4 locales. Baseline capture wymaga
// component preview harness (Storybook / CI preview route) — patrz NOTE w
// Story 3.1 T9. Bez harnessu specs SKIP (Sprint 2 mid-checkpoint sample-aware,
// per R-V180-EPICS-3 / finding #3.3) — nie hard-fail jak Story 3.0 NOTE.

export const WAVE6_COMPONENTS = {
  'w6-03-newsletter': ['inline-body', 'inline-footer', 'modal-popup', 'success'],
  'w6-04-cookie-banner': ['default-3-CTA', 'dostosuj-sub-modal'],
  'w6-05-modal-patterns': [
    'auth-required',
    'age-verify',
    'consent',
    'confirm-destructive',
    'detailed-info',
  ],
  'w6-06-toast-alert': ['info', 'success', 'warning', 'error'],
  'w6-08-mini-cart': ['empty', 'one-item', 'many', 'with-discount-applied'],
  'w6-09-search-overlay': ['desktop', 'tablet', 'mobile'],
} as const;

export type Wave6ComponentId = keyof typeof WAVE6_COMPONENTS;

// Component preview harness URL convention. The preview route is provided by
// the CI Storybook/preview build (Story 3.1 T9 NOTE); locally it 404s and the
// spec SKIPs. Story 3.10 baseline-index.yaml owns subset strategy
// (D-V180-ARCH-11: PL primary full + EN/UA/DE persona floors).
export function componentPreviewUrl(
  component: Wave6ComponentId,
  variant: string,
  locale: string
): string {
  return `${BASE_URL}/${locale}/__preview/${component}?variant=${encodeURIComponent(variant)}`;
}

export async function previewHarnessAvailable(
  page: Page,
  component: Wave6ComponentId
): Promise<boolean> {
  try {
    const res = await page.goto(componentPreviewUrl(component, 'default', 'pl'), {
      waitUntil: 'domcontentloaded',
      timeout: 5_000,
    });
    return Boolean(res && res.ok());
  } catch {
    return false;
  }
}
