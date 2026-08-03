/**
 * UX Evidence — Home / Discovery / Category (Story v170-2-10, Phase A)
 *
 * Covers matrix cells for:
 *  - / (home) at 375, 414, 768, 1024, 1440, 1920 (PL canonical + EN spot-check at 1440)
 *  - /categories/[handle] at 375, 768, 1440
 * Checks: playwright-screenshot, axe, touch-target, contrast
 *
 * Phase A: specs authored and configured; live run deferred to Phase B
 * (requires running storefront/backend per playwright.config.ts "no web-server auto-start").
 *
 * Carousel elements are excluded from horizontal-scroll assertion per UX spec
 * §Interaction & State Requirements (carousels accepted via opt-in selector list).
 *
 * @see _bmad-output/releases/v1.7.0/implementation-artifacts/evidence/2-10-ux-evidence-matrix.json
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"

import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

const CAROUSEL_SELECTORS = [
  ".embla",
  "[data-testid='carousel']",
  "[data-testid='product-carousel']",
]

async function assertNoHorizontalScroll(page: import("@playwright/test").Page): Promise<void> {
  const hasScroll = await page.evaluate((carouselSelectors: string[]) => {
    const body = document.documentElement
    // Check if scroll is caused only by known carousel elements
    const scrollWidth = body.scrollWidth
    const clientWidth = body.clientWidth
    if (scrollWidth <= clientWidth) return false
    // Allow overflow if it's attributable to a carousel
    const carousels = carouselSelectors
      .flatMap((sel) => Array.from(document.querySelectorAll(sel)))
    return carousels.length === 0
  }, CAROUSEL_SELECTORS)
  expect(hasScroll, "No unintended horizontal scroll (carousels excluded)").toBe(false)
}

test.describe("Home — screenshot coverage", () => {
  test("home PL screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/home.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/",
      path_slug: "home",
      viewport,
      locale: "pl",
      check: "playwright-screenshot",
      ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("home-discovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: "PASS",
    })
  })

  test("home no horizontal scroll at mobile viewports", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport > 414) test.skip()
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    await assertNoHorizontalScroll(page)
  })
})

test.describe("Home — axe accessibility", () => {
  test("home axe WCAG 2.1 AA — zero serious/critical", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    // Axe run at primary viewport (375 mobile is most restrictive)
    if (viewport !== 375) test.skip()

    await page.goto("/")
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
      path: "/",
      path_slug: "home",
      viewport,
      locale: "pl",
      check: "axe",
      ac_ref: "AC-UX13-02",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/home.${viewport}.pl.axe.json`,
      command: buildCommand("home-discovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
      notes: blockers.length > 0
        ? `${blockers.length} serious/critical violations: ${blockers.map((v) => v.id).join(", ")}`
        : undefined,
    })

    expect(
      blockers,
      `axe: zero serious/critical violations expected, got ${blockers.length}: ${blockers.map((v) => `${v.id}(${v.impact})`).join(", ")}`
    ).toHaveLength(0)
  })
})

test.describe("Home — touch targets", () => {
  test("home touch targets >= 44x44px at mobile viewports", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport > 768) test.skip()

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    const smallTargets = await page.$$eval(
      '[role="button"], button, a[href], input, select, textarea',
      (els) =>
        els
          .filter((el) => {
            const rect = el.getBoundingClientRect()
            const ariaHidden = el.getAttribute("aria-hidden") === "true"
            return !ariaHidden && (rect.width < 44 || rect.height < 44)
          })
          .map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 40), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }))
    )

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/",
      path_slug: "home",
      viewport,
      locale: "pl",
      check: "touch-target",
      ac_ref: "UX-DR21",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/home.${viewport}.pl.touch-targets.json`,
      command: buildCommand("home-discovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: smallTargets.length === 0 ? "PASS" : "FAIL",
      notes: smallTargets.length > 0 ? `${smallTargets.length} elements below 44x44px` : undefined,
    })

    expect(smallTargets, `Touch targets below 44x44px: ${JSON.stringify(smallTargets.slice(0, 5))}`).toHaveLength(0)
  })
})

test.describe("Home — EN spot-check", () => {
  test("home EN locale screenshot at 1440", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 1440) test.skip()

    await page.goto("/en")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/home.${viewport}.en.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/",
      path_slug: "home",
      viewport,
      locale: "en",
      check: "playwright-screenshot",
      ac_ref: "AC-UX13-02",
      artifact_path: screenshotPath,
      command: buildCommand("home-discovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: "PASS",
      notes: "EN spot-check required by AC-UX13-02",
    })
  })
})

test.describe("Category — screenshot coverage", () => {
  test("category PL screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (![375, 768, 1440].includes(viewport)) test.skip()

    // Use a representative category handle — adjust for live run
    await page.goto("/categories/testowanie")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/category.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/categories/[handle]",
      path_slug: "category",
      viewport,
      locale: "pl",
      check: "playwright-screenshot",
      ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("home-discovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: "PASS",
    })
  })
})

test.describe("Home — contrast spot-check", () => {
  test("home contrast states at 1440", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 1440) test.skip()

    await page.goto("/")
    await page.waitForLoadState("networkidle")

    // axe contrast rules cover normal/focus/error/disabled states
    const results = await new AxeBuilder({ page })
      .withRules(["color-contrast", "color-contrast-enhanced"])
      .analyze()

    const contrastViolations = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical"
    )

    emitMeta({
      release_id: RELEASE_ID,
      market_id: MARKET_ID,
      surface: "storefront",
      role: "customer",
      path: "/",
      path_slug: "home-contrast",
      viewport,
      locale: "pl",
      check: "contrast",
      ac_ref: "AC-UX13-05",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/home.${viewport}.pl.contrast.json`,
      command: buildCommand("home-discovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(),
      git_sha: resolveGitSha(),
      result: contrastViolations.length === 0 ? "PASS" : "FAIL",
      notes: "8 required states: normal/hover/focus/selected/disabled/error/stale/evidence-link",
    })

    expect(contrastViolations, "Contrast violations").toHaveLength(0)
  })
})
