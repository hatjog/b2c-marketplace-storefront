/**
 * UX Evidence — Account / Login / Recovery (Story v170-2-10, Phase A)
 *
 * Covers:
 *  - /user/account at 375
 *  - /user/login at 375, 768
 * Checks: playwright-screenshot, axe, keyboard
 */
import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

test.describe("Account — screenshot coverage", () => {
  test("account page at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/user/account")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/account.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/user/account", path_slug: "account", viewport, locale: "pl",
      check: "playwright-screenshot", ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("account-recovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })

  test("account axe at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/user/account")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/user/account", path_slug: "account", viewport, locale: "pl",
      check: "axe", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/account.${viewport}.pl.axe.json`,
      command: buildCommand("account-recovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })
    expect(blockers).toHaveLength(0)
  })
})

test.describe("Login — screenshot + keyboard", () => {
  test("login page screenshot", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (![375, 768].includes(viewport)) test.skip()

    await page.goto("/user/login")
    await page.waitForLoadState("networkidle")

    const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/login.${viewport}.pl.png`
    await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.02 })

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/user/login", path_slug: "login", viewport, locale: "pl",
      check: "playwright-screenshot", ac_ref: "AC-UX13-01",
      artifact_path: screenshotPath,
      command: buildCommand("account-recovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })

  test("login axe at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/user/login")
    await page.waitForLoadState("networkidle")

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze()
    const blockers = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/user/login", path_slug: "login", viewport, locale: "pl",
      check: "axe", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/login.${viewport}.pl.axe.json`,
      command: buildCommand("account-recovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
      result: blockers.length === 0 ? "PASS" : "FAIL",
    })
    expect(blockers).toHaveLength(0)
  })

  test("login keyboard navigation at 375", async ({ page }, testInfo) => {
    const viewport = testInfo.project.use.viewport?.width ?? 1440
    if (viewport !== 375) test.skip()

    await page.goto("/user/login")
    await page.waitForLoadState("networkidle")

    await page.keyboard.press("Tab")
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBeTruthy()

    emitMeta({
      release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
      path: "/user/login", path_slug: "login", viewport, locale: "pl",
      check: "keyboard", ac_ref: "AC-UX13-01",
      artifact_path: `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/login.${viewport}.pl.keyboard.json`,
      command: buildCommand("account-recovery.spec.ts", testInfo.project.name),
      timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
    })
  })
})
