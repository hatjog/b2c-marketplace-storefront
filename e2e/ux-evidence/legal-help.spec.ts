/**
 * UX Evidence — Legal / Help / Withdrawal (Story v170-2-10, Phase A)
 *
 * Covers: /regulamin, /zasady, /polityka-prywatnosci, /pomoc at 375
 * Checks: playwright-screenshot
 *
 * Routes added by Story 2.9. Phase A: specs authored; live run deferred to Phase B.
 */
import { test, expect } from "@playwright/test"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

const LEGAL_ROUTES = [
  { path: "/regulamin", slug: "regulamin" },
  { path: "/zasady", slug: "zasady" },
  { path: "/polityka-prywatnosci", slug: "polityka-prywatnosci" },
  { path: "/pomoc", slug: "pomoc" },
] as const

test.describe("Legal/Help — screenshot coverage at 375", () => {
  for (const route of LEGAL_ROUTES) {
    test(`${route.slug} screenshot at 375`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440
      if (viewport !== 375) test.skip()

      await page.goto(route.path)
      await page.waitForLoadState("networkidle")

      const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/${route.slug}.${viewport}.pl.png`
      await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

      emitMeta({
        release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
        path: route.path, path_slug: route.slug, viewport, locale: "pl",
        check: "playwright-screenshot", ac_ref: "AC-UX13-01",
        artifact_path: screenshotPath,
        command: buildCommand("legal-help.spec.ts", testInfo.project.name),
        timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
      })
    })
  }
})
