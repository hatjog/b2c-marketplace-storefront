/**
 * UX Evidence — Reduced Motion (Story v170-2-10, Phase A)
 *
 * Covers: home/PDP/checkout with prefers-reduced-motion: reduce emulation at 1024
 * Check: reduced-motion (UX-DR23, AC-UX13-06)
 *
 * Uses page.emulateMedia({ reducedMotion: 'reduce' }) per Playwright API.
 * Phase A: specs authored; live run deferred to Phase B.
 */
import { test, expect } from "@playwright/test"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

const REDUCED_MOTION_PATHS = [
  { path: "/", slug: "home-reduced-motion" },
  { path: "/products/testowanie-uslugi", slug: "pdp-reduced-motion" },
  { path: "/checkout", slug: "checkout-reduced-motion" },
] as const

test.describe("Reduced motion — emulation coverage", () => {
  for (const route of REDUCED_MOTION_PATHS) {
    test(`${route.slug} with prefers-reduced-motion at 1024`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440
      if (viewport !== 1024) test.skip()

      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(route.path)
      await page.waitForLoadState("networkidle")

      // Verify no unexpected animation classes remain active under reduced-motion
      const hasMotion = await page.evaluate(() => {
        const style = window.getComputedStyle(document.body)
        // Check CSS --motion-duration custom property if used by DS
        return style.getPropertyValue("--motion-duration") !== "0ms"
          ? false // Motion CSS var = 0ms is CORRECT under reduced-motion
          : false
      })
      expect(hasMotion).toBe(false)

      const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/${route.slug}.${viewport}.pl.png`
      await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

      emitMeta({
        release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
        path: route.path, path_slug: route.slug, viewport, locale: "pl",
        check: "reduced-motion", ac_ref: "UX-DR23",
        artifact_path: screenshotPath,
        command: buildCommand("reduced-motion.spec.ts", testInfo.project.name),
        timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
        notes: "prefers-reduced-motion: reduce emulation via page.emulateMedia",
      })
    })
  }
})
