// Shared Wave 6 chrome VR spec body — Story 3.1 T9.
// Each w6-0x-*.spec.ts calls defineWave6Spec() so the variants × 3 breakpoints
// × 4 locales matrix is generated consistently. Sprint 2 mid-checkpoint sample
// MUST include these (per R-V180-EPICS-3 / finding #3.3) — the suite is
// enumerated even when the preview harness is absent (tests SKIP, not fail).

import { test, expect } from '@playwright/test';

import {
  BREAKPOINTS,
  LOCALES,
  WAVE6_COMPONENTS,
  componentPreviewUrl,
  previewHarnessAvailable,
  setViewport,
  type Wave6ComponentId,
} from './setup';

export function defineWave6Spec(component: Wave6ComponentId) {
  const variants = WAVE6_COMPONENTS[component];

  test.describe(`Wave 6 chrome — ${component}`, () => {
    let harnessUp = false;

    test.beforeAll(async ({ browser }) => {
      const page = await browser.newPage();
      harnessUp = await previewHarnessAvailable(page, component);
      await page.close();
    });

    for (const variant of variants) {
      for (const locale of LOCALES) {
        for (const bp of BREAKPOINTS) {
          test(`${component} — ${variant} — ${locale} ${bp.name}`, async ({
            page,
          }) => {
            test.skip(
              !harnessUp,
              `Preview harness unavailable — baseline capture deferred to CI ` +
                `post-deploy (Story 3.1 T9 NOTE). Matrix cell enumerated for ` +
                `Sprint 2 mid-checkpoint sample.`
            );

            await setViewport(page, bp);
            await page.goto(componentPreviewUrl(component, variant, locale), {
              waitUntil: 'networkidle',
            });

            // Chrome root testid is `<feature-root>` per component contract;
            // fall back to the generic preview container.
            const root = page.locator('[data-testid$="-overlay"], [data-testid]').first();
            await expect(root).toBeVisible();

            await expect(page).toHaveScreenshot(
              `${component}-${variant}-${locale}-${bp.name}.png`,
              {
                maxDiffPixelRatio: 0.02,
                fullPage: false,
                clip: { x: 0, y: 0, width: bp.width, height: bp.height },
              }
            );
          });
        }
      }
    }
  });
}
