import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import type { Page, Response } from "@playwright/test"

const REQUIRE_PREVIEW_HARNESS =
  process.env.WAVE6_REQUIRE_PREVIEW_HARNESS === "1"

const WAVE6_A11Y_CASES = [
  { id: "w6-03-newsletter", variant: "inline-body" },
  { id: "w6-04-cookie-banner", variant: "default-3-CTA" },
  { id: "w6-05-modal-patterns", variant: "detailed-info" },
  { id: "w6-06-toast-alert", variant: "info" },
  { id: "w6-08-mini-cart", variant: "many" },
  { id: "w6-09-search-overlay", variant: "desktop" },
] as const

function previewPath(component: string, variant: string): string {
  return `/pl/__preview/${component}?variant=${encodeURIComponent(variant)}`
}

async function safeGoto(page: Page, path: string): Promise<Response | null> {
  try {
    return await page.goto(path, { waitUntil: "domcontentloaded", timeout: 5_000 })
  } catch {
    return null
  }
}

test.describe("Wave 6 chrome — axe accessibility", () => {
  test("preview harness availability contract", async ({ page }) => {
    const response = await safeGoto(page, previewPath("w6-03-newsletter", "inline-body"))

    if (!response || !response.ok()) {
      if (REQUIRE_PREVIEW_HARNESS) {
        throw new Error(
          "Wave 6 preview harness unavailable in required mode (CI/WAVE6_REQUIRE_PREVIEW_HARNESS=1)."
        )
      }
      test.skip(true, "Preview harness unavailable — local run without hard gate")
    }
  })

  for (const item of WAVE6_A11Y_CASES) {
    test(`axe serious/critical = 0 for ${item.id} (${item.variant})`, async ({ page }, testInfo) => {
      const viewport = testInfo.project.use.viewport?.width ?? 0
      if (viewport !== 375) {
        test.skip(true, "Wave 6 axe gate runs on canonical mobile viewport 375")
      }

      const response = await safeGoto(page, previewPath(item.id, item.variant))

      if (!response || !response.ok()) {
        if (REQUIRE_PREVIEW_HARNESS) {
          throw new Error(
            `Preview route missing for ${item.id}/${item.variant} in required mode.`
          )
        }
        test.skip(true, `Preview route unavailable for ${item.id}/${item.variant}`)
      }
      await page.waitForLoadState("networkidle")

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze()

      const blockers = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical"
      )

      expect(
        blockers,
        `axe blockers for ${item.id}/${item.variant}: ${blockers.map((v) => `${v.id}(${v.impact})`).join(", ")}`
      ).toHaveLength(0)
    })
  }
})
