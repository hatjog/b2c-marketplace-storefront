/**
 * UX Evidence — Empty / Loading / Error / Validation states (Story v170-2-10, Phase A)
 *
 * Covers NFR28 (accessible empty/loading/error states for screen readers).
 * Checks: playwright-screenshot, axe
 *
 * Phase A: specs authored; live run deferred to Phase B.
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

test.describe("State coverage — empty / loading / error", () => {
  test("empty state (no products category) screenshot at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    // Use a category with no products; adjust handle for live run
    await page.goto("/categories/empty-test-category")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/state-empty.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/categories/[handle]", path_slug: "state-empty", viewport, locale: "pl",
      check: "playwright-screenshot", ac_ref: "NFR28",
      artifact_path: screenshotPath,
      command: buildCommand("state-coverage.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
      notes: "Empty state (no products in category)",
    })
  })

  test("empty state axe at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/categories/empty-test-category")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/categories/[handle]", path_slug: "state-empty", viewport, locale: "pl",
      check: "axe", ac_ref: "NFR28",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/state-empty.${viewport}.pl.axe.json`,
      command: buildCommand("state-coverage.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })
    expect(blockers).toHaveLength(0)
  })

  test("loading state screenshot at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    // Capture loading state by intercepting slow response
    await page.route("**/store/products*", async (route) => {
      await new Promise((r) => setTimeout(r, 500))
      await route.continue()
    })
    await page.goto("/products/loading-test-product")
    // Screenshot during loading; don't wait for networkidle

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/state-loading.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.05 })

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/products/[handle]", path_slug: "state-loading", viewport, locale: "pl",
      check: "axe", ac_ref: "NFR28",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/state-loading.${viewport}.pl.axe.json`,
      command: buildCommand("state-coverage.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
      notes: "Loading state with aria-live/status",
    })
    expect(blockers).toHaveLength(0)
  })

  test("error state screenshot at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    // Force 404/error by navigating to a nonexistent product
    await page.goto("/products/this-product-does-not-exist-12345")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/state-error.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/products/[handle]", path_slug: "state-error", viewport, locale: "pl",
      check: "axe", ac_ref: "NFR28",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/state-error.${viewport}.pl.axe.json`,
      command: buildCommand("state-coverage.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
      notes: "Error state accessibility",
    })
    expect(blockers).toHaveLength(0)
  })
})
