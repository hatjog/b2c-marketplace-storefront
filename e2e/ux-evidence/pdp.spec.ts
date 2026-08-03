/**
 * UX Evidence — PDP / oferta (Story v170-2-10, Phase A)
 *
 * Covers: /products/[handle] at 375, 414, 768, 1440, 1920 (PL + EN spot-check at 1440)
 * Checks: playwright-screenshot, axe, touch-target
 *
 * Phase A: specs authored; live run deferred to Phase B.
 *
 * @see _bmad-output/releases/v1.7.0/implementation-artifacts/evidence/2-10-ux-evidence-matrix.json
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

const REPRESENTATIVE_PRODUCT = "testowanie-uslugi"

test.describe("PDP — screenshot coverage", () => {
  test("PDP PL screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    await page.goto(`/products/${REPRESENTATIVE_PRODUCT}`)
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/pdp.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/products/[handle]",
      path_slug: "pdp",
      viewport,
      locale: "pl",
      check: "playwright-screenshot",
      ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("pdp.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: "PASS",
    })
  })

  test("PDP EN spot-check at 1440", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 1440) test.skip()

    await page.goto(`/en/products/${REPRESENTATIVE_PRODUCT}`)
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/pdp.${viewport}.en.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/products/[handle]",
      path_slug: "pdp",
      viewport,
      locale: "en",
      check: "playwright-screenshot",
      ac_ref: "AC-UX13-02",
      artifact_path: screenshotPath,
      command: buildCommand("pdp.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: "PASS",
      notes: "EN spot-check required by AC-UX13-02",
    })
  })
})

test.describe("PDP — axe accessibility", () => {
  test("PDP axe WCAG 2.1 AA — zero serious/critical at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto(`/products/${REPRESENTATIVE_PRODUCT}`)
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()

    const blockers = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    )

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/products/[handle]",
      path_slug: "pdp",
      viewport,
      locale: "pl",
      check: "axe",
      ac_ref: "AC-UX13-02",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/pdp.${viewport}.pl.axe.json`,
      command: buildCommand("pdp.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })

    expect(blockers, `axe serious/critical on PDP: ${blockers.map((v) => v.id).join(", ")}`).toHaveLength(0)
  })
})

test.describe("PDP — touch targets", () => {
  test("PDP touch targets >= 44x44px at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto(`/products/${REPRESENTATIVE_PRODUCT}`)
    await page.waitForLoadState("networkidle")

    const smallTargets = await page.$$eval(
      '[role="button"], button, a[href], input',
      (els) =>
        els
          .filter((el) => {
            const rect = el.getBoundingClientRect()
            return el.getAttribute("aria-hidden") !== "true" && (rect.width < 44 || rect.height < 44)
          })
          .map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 40) }))
    )

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/products/[handle]",
      path_slug: "pdp",
      viewport,
      locale: "pl",
      check: "touch-target",
      ac_ref: "UX-DR21",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/pdp.${viewport}.pl.touch-targets.json`,
      command: buildCommand("pdp.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: smallTargets.length === 0 ? "PASS" : "FAIL",
    })

    expect(smallTargets, `Touch targets below 44x44px on PDP: ${JSON.stringify(smallTargets.slice(0, 5))}`).toHaveLength(0)
  })
})
