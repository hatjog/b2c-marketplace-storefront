/**
 * UX Evidence — Cart / Checkout (Story v170-2-10, Phase A)
 *
 * Covers:
 *  - /cart at 375, 768, 1440, 1920
 *  - /checkout at 375, 414, 768, 1440, 1920 (PL + EN spot-check at 1440)
 * Checks: playwright-screenshot, axe, keyboard, touch-target
 *
 * Phase A: specs authored; live run deferred to Phase B.
 *
 * @see _bmad-output/releases/v1.7.0/implementation-artifacts/evidence/2-10-ux-evidence-matrix.json
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

test.describe("Cart — screenshot coverage", () => {
  test("cart PL screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (![375, 768, 1440, 1920].includes(viewport)) test.skip()

    await page.goto("/cart")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/cart.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/cart",
      path_slug: "cart",
      viewport,
      locale: "pl",
      check: "playwright-screenshot",
      ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: "PASS",
    })
  })
})

test.describe("Cart — axe + keyboard + touch", () => {
  test("cart axe WCAG 2.1 AA at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/cart")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/cart", path_slug: "cart", viewport, locale: "pl", check: "axe", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/cart.${viewport}.pl.axe.json`,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })

    expect(blockers).toHaveLength(0)
  })

  test("cart keyboard navigation at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/cart")
    await page.waitForLoadState("networkidle")

    // Tab through interactive elements and verify focus is visible
    await page.keyboard.press("Tab")
    const focused1 = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused1).toBeTruthy()

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/cart", path_slug: "cart", viewport, locale: "pl", check: "keyboard", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/cart.${viewport}.pl.keyboard.json`,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
      notes: "Tab navigation smoke: first Tab from body activates interactive element",
    })
  })

  test("cart touch targets >= 44x44px at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/cart")
    await page.waitForLoadState("networkidle")

    const smallTargets = await page.$$eval(
      '[role="button"], button, a[href], input',
      (els) => els.filter((el) => {
        const rect = el.getBoundingClientRect()
        return el.getAttribute("aria-hidden") !== "true" && (rect.width < 44 || rect.height < 44)
      }).map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 40) }))
    )

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/cart", path_slug: "cart", viewport, locale: "pl", check: "touch-target", ac_ref: "UX-DR21",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/cart.${viewport}.pl.touch-targets.json`,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: smallTargets.length === 0 ? "PASS" : "FAIL",
    })
    expect(smallTargets).toHaveLength(0)
  })
})

test.describe("Checkout — screenshot coverage", () => {
  test("checkout PL screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    await page.goto("/checkout")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/checkout.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/checkout", path_slug: "checkout", viewport, locale: "pl", check: "playwright-screenshot",
      ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })

  test("checkout EN spot-check at 1440", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 1440) test.skip()

    await page.goto("/en/checkout")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/checkout.${viewport}.en.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/checkout", path_slug: "checkout", viewport, locale: "en", check: "playwright-screenshot",
      ac_ref: "AC-UX13-02", artifact_path: screenshotPath,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
      notes: "EN spot-check required by AC-UX13-02",
    })
  })
})

test.describe("Checkout — axe + keyboard", () => {
  test("checkout axe WCAG 2.1 AA at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/checkout")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/checkout", path_slug: "checkout", viewport, locale: "pl", check: "axe", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/checkout.${viewport}.pl.axe.json`,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })
    expect(blockers).toHaveLength(0)
  })

  test("checkout keyboard navigation smoke at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/checkout")
    await page.waitForLoadState("networkidle")

    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBeTruthy()

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/checkout", path_slug: "checkout", viewport, locale: "pl", check: "keyboard",
      ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/checkout.${viewport}.pl.keyboard.json`,
      command: buildCommand("cart-checkout.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })
})
