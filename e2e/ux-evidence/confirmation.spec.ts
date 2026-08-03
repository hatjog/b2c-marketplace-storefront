/**
 * UX Evidence — Order Confirmation / Handoff (Story v170-2-10, Phase A)
 *
 * Covers: /order/confirmation/[id] at 375, 768, 1440
 * Checks: playwright-screenshot, axe
 *
 * Phase A: specs authored; live run deferred to Phase B.
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

const CONFIRMATION_PATH = "/order/confirmation/test-order-id"

test.describe("Confirmation — screenshot coverage", () => {
  test("confirmation PL screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (![375, 768, 1440].includes(viewport)) test.skip()

    await page.goto(CONFIRMATION_PATH)
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/confirmation.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/order/confirmation/[id]", path_slug: "confirmation", viewport, locale: "pl",
      check: "playwright-screenshot", ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("confirmation.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })

  test("confirmation axe at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto(CONFIRMATION_PATH)
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/order/confirmation/[id]", path_slug: "confirmation", viewport, locale: "pl",
      check: "axe", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/confirmation.${viewport}.pl.axe.json`,
      command: buildCommand("confirmation.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })
    expect(blockers).toHaveLength(0)
  })
})
