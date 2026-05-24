/**
 * E2E-C / Suite C8 — Persona J2 Karolina returning + wishlist (v1.9.0 Wave F4)
 *
 * J2 journey:
 *   - Returning customer login
 *   - Wishlist add + view
 *   - Editorial dark band visible on home discovery
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:3002"

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..")
const FIXTURE_PATH = path.join(
  REPO_ROOT,
  "GP",
  "e2e",
  "fixtures",
  "personas",
  "j-numbering-canonical.json"
)

type Fixture = {
  personas: Record<string, { id: string; label: string; spec: string }>
}

function loadFixture(): Fixture {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as Fixture
}

async function probe(url: string) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3_000) })
    return r.status >= 200 && r.status < 500
  } catch {
    return false
  }
}

let fixture: Fixture
let storefrontReachable = false
let skipReason = ""

test.describe("Suite C8 @persona @v190-e2e-c @needs-stack — J2 Karolina (F4)", () => {
  test.beforeAll(async () => {
    fixture = loadFixture()
    storefrontReachable = await probe(STOREFRONT_URL)
    if (!storefrontReachable) {
      skipReason = `Suite C8 live runtime gate not satisfied: STOREFRONT_URL (${STOREFRONT_URL}) unreachable.`
    }
  })

  test.describe("fixture contract", () => {
    test("J2 anchor matches UX §8 canonical numbering", () => {
      expect(fixture.personas.J2.id).toBe("j2_karolina")
      expect(fixture.personas.J2.label).toMatch(/Karolina|wishlist|returning/i)
    })
  })

  test.describe("J2 live storefront", () => {
    test("home discovery exposes editorial dark band + wishlist entry", async ({
      page,
    }) => {
      test.skip(!storefrontReachable, skipReason || "storefront not available")

      const home = await page.goto(`${STOREFRONT_URL}/pl`, {
        waitUntil: "domcontentloaded",
      })
      expect(home?.status(), "home discovery status").toBeLessThan(400)

      const darkBand = page.locator(
        '[data-section="editorial-dark"], [data-testid="editorial-band"], [class*="editorial"][class*="dark"]'
      )
      await expect(
        darkBand.first(),
        "J2 editorial dark band must render on home discovery"
      ).toBeVisible({ timeout: 10_000 })

      const wishlistEntry = page.locator(
        '[data-testid="wishlist-entry"], [aria-label*="wishlist" i], [aria-label*="ulubione" i]'
      )
      const count = await wishlistEntry.count()
      expect(count, "J2 must expose a wishlist entry").toBeGreaterThanOrEqual(1)
    })

    test("returning-customer login surface present", async ({ page }) => {
      test.skip(!storefrontReachable, skipReason || "storefront not available")

      const url = `${STOREFRONT_URL}/pl/user`
      const r = await page.goto(url, { waitUntil: "domcontentloaded" })
      // Page may redirect to /login or render an account hub; either is OK
      // as long as the surface is reachable (not 5xx, not endless redirect).
      expect(r?.status(), `${url} reachable`).toBeLessThan(500)
    })
  })
})
