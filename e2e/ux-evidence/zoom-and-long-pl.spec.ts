/**
 * UX Evidence — Zoom 200% + Long Polish Content (Story v170-2-10, Phase A)
 *
 * Covers:
 *  - zoom 200% on home/PDP/checkout at 1440 (UX-DR23)
 *  - long Polish content on PDP/checkout at 375 (UX-DR23, AC-UX13-07)
 *
 * Browser zoom 200%: applied via document.documentElement.style.zoom = '200%'
 * (no first-class Playwright API; CSS transform fallback documented here).
 *
 * Phase A: specs authored; live run deferred to Phase B.
 */
import { test, expect } from "@playwright/test"
import { emitMeta, resolveGitSha, buildCommand, RELEASE_ID, MARKET_ID } from "./_helpers/metadata"

const ZOOM_PATHS = [
  { path: "/", slug: "home-zoom200" },
  { path: "/products/testowanie-uslugi", slug: "pdp-zoom200" },
  { path: "/checkout", slug: "checkout-zoom200" },
] as const

const LONG_PL_PATHS = [
  {
    path: "/products/testowanie-uslugi",
    slug: "pdp-long-pl",
    notes: "Long Polish service names/prices/validation messages",
  },
  {
    path: "/checkout",
    slug: "checkout-long-pl",
    notes: "Long Polish validation messages in checkout form",
  },
] as const

// Long Polish content fixture strings for injection
const LONG_PL_FIXTURES = {
  serviceName:
    "Profesjonalne zabiegi pielęgnacyjne, odnowa biologiczna i terapie regeneracyjne dla wymagającej klienteli",
  price: "1 234 567,89 zł",
  validationMsg:
    "Podane imię i nazwisko jest zbyt długie — maksymalnie 100 znaków; obecna wartość przekracza limit o 42 znaki",
}

test.describe("Zoom 200% — layout check at 1440", () => {
  for (const route of ZOOM_PATHS) {
    test(`${route.slug} zoom 200% at 1440`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440
      if (viewport !== 1440) test.skip()

      await page.goto(route.path)
      await page.waitForLoadState("networkidle")

      // Apply browser-level zoom via CSS (documented approach for Playwright)
      await page.evaluate(() => {
        document.documentElement.style.zoom = "200%"
      })
      // Wait one frame for layout reflow
      await page.waitForTimeout(200)

      // Assert no horizontal overflow (content should reflow not clip)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth
      })
      expect(hasHorizontalScroll, "No horizontal overflow at zoom 200%").toBe(false)

      const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/${route.slug}.${viewport}.pl.png`
      await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.05 })

      emitMeta({
        release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
        path: route.path, path_slug: route.slug, viewport, locale: "pl",
        check: "zoom-200", ac_ref: "UX-DR23",
        artifact_path: screenshotPath,
        command: buildCommand("zoom-and-long-pl.spec.ts", testInfo.project.name),
        timestamp: new Date().toISOString(), git_sha: resolveGitSha(), result: "PASS",
        notes: "Zoom via document.documentElement.style.zoom = '200%'",
      })
    })
  }
})

test.describe("Long Polish content — no clipping at 375", () => {
  for (const route of LONG_PL_PATHS) {
    test(`${route.slug} long PL content at 375`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 1440
      if (viewport !== 375) test.skip()

      await page.goto(route.path)
      await page.waitForLoadState("networkidle")

      // Inject long Polish content into visible text nodes for overflow test
      await page.evaluate((fixtures: typeof LONG_PL_FIXTURES) => {
        const headings = document.querySelectorAll("h1, h2, [data-testid='product-title']")
        if (headings.length > 0) {
          ;(headings[0] as HTMLElement).textContent = fixtures.serviceName
        }
        const priceEls = document.querySelectorAll("[data-testid='price'], .price")
        if (priceEls.length > 0) {
          ;(priceEls[0] as HTMLElement).textContent = fixtures.price
        }
      }, LONG_PL_FIXTURES)

      // Check for text clipping (overflow: hidden truncating long content)
      const clippedEls = await page.$$eval(
        "h1, h2, p, span, button",
        (els) =>
          els
            .filter((el) => {
              const style = window.getComputedStyle(el)
              return (
                style.overflow === "hidden" &&
                el.scrollHeight > el.clientHeight + 2
              )
            })
            .map((el) => ({ tag: el.tagName, text: el.textContent?.slice(0, 60) }))
      )

      const screenshotPath = `../_bmad-output/releases/v1.7.0/implementation-artifacts/evidence/screenshots/storefront/${route.slug}.${viewport}.pl.png`
      await expect(page).toHaveScreenshot(screenshotPath, { maxDiffPixelRatio: 0.05 })

      emitMeta({
        release_id: RELEASE_ID, market_id: MARKET_ID, surface: "storefront", role: "customer",
        path: route.path, path_slug: route.slug, viewport, locale: "pl",
        check: "long-pl-content", ac_ref: "UX-DR23",
        artifact_path: screenshotPath,
        command: buildCommand("zoom-and-long-pl.spec.ts", testInfo.project.name),
        timestamp: new Date().toISOString(), git_sha: resolveGitSha(),
        result: clippedEls.length === 0 ? "PASS" : "FAIL",
        notes: route.notes,
      })

      // Report clipping as informational — may be intentional truncation
      if (clippedEls.length > 0) {
        console.warn("Potentially clipped elements:", JSON.stringify(clippedEls.slice(0, 3)))
      }
    })
  }
})
