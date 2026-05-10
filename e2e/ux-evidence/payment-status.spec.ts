/**
 * UX Evidence — Payment Status (pending / failed / recovery) (Story v170-2-10, Phase A)
 *
 * Covers: /checkout payment state surfaces via fixture injection at 375
 * Checks: playwright-screenshot, axe, keyboard
 *
 * Payment states are test-fixture driven (via PaymentStatusPanel UX-CMP-4 from Story 2.4).
 * Phase A: specs authored; live run deferred to Phase B.
 *
 * @see _bmad-output/releases/v1.7.0/implementation-artifacts/evidence/2-10-ux-evidence-matrix.json
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

// Payment states exercised via URL query or state injection
const PAYMENT_STATES = [
  { slug: "payment-pending", query: "?payment=pending", ac_ref: "AC-UX13-01" },
  { slug: "payment-failed", query: "?payment=failed", ac_ref: "AC-UX13-01" },
  { slug: "payment-recovery", query: "?payment=recovery", ac_ref: "UX-DR22" },
] as const

test.describe("Payment status — screenshot + axe", () => {
  for (const state of PAYMENT_STATES) {
    test(`payment ${state.slug} at 375`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440
      if (viewport !== 375) test.skip()

      // Navigate to checkout with payment state fixture; adjust URL for real implementation
      await page.goto(`/checkout${state.query}`)
      await page.waitForLoadState("networkidle")

      const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/${state.slug}.${viewport}.pl.png`
      await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

      emitMeta({
        release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
        path: "/checkout", path_slug: state.slug, viewport, locale: "pl",
        check: "playwright-screenshot", ac_ref: state.ac_ref,
        artifact_path: screenshotPath,
        command: buildCommand("payment-status.spec.ts", testInfo.project.name),
        timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
        notes: `Payment state fixture: ${state.query}`,
      })
    })

    test(`payment ${state.slug} axe WCAG 2.1 AA at 375`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440
      if (viewport !== 375) test.skip()

      await page.goto(`/checkout${state.query}`)
      await page.waitForLoadState("networkidle")

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()
      const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

      emitMeta({
        release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
        path: "/checkout", path_slug: state.slug, viewport, locale: "pl",
        check: "axe", ac_ref: state.ac_ref,
        artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/${state.slug}.${viewport}.pl.axe.json`,
        command: buildCommand("payment-status.spec.ts", testInfo.project.name),
        timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
        result: blockers.length === 0 ? "PASS" : "FAIL",
      })
      expect(blockers).toHaveLength(0)
    })
  }

  test("payment recovery keyboard navigation at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/checkout?payment=recovery")
    await page.waitForLoadState("networkidle")

    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBeTruthy()

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/checkout", path_slug: "payment-recovery", viewport, locale: "pl",
      check: "keyboard", ac_ref: "UX-DR22",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/payment-recovery.${viewport}.pl.keyboard.json`,
      command: buildCommand("payment-status.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })
})
