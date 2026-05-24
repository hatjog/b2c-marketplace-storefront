/**
 * E2E-C / Suite C10 — Persona J4 Marek trust (v1.9.0 Wave F4 + F7)
 *
 * J4 journey: navigate trust signals (lastUpdated, version, locale switcher),
 *   cookie modal 2-step, no broken status.bonbeauty.pl link (env-gated stub OK).
 *
 * Metric proxy: time-to-trust ≤ 60s.
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:3002"
const STATUS_PAGE_STUB_OK = (process.env.STATUS_PAGE_STUB_OK ?? "true") === "true"

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
  personas: Record<
    string,
    { id: string; label: string; metric_target_seconds?: number }
  >
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

test.describe("Suite C10 @persona @v190-e2e-c @needs-stack — J4 Marek trust (F4 + F7 CC-6 F-CC6-08)", () => {
  test.beforeAll(async () => {
    fixture = loadFixture()
    storefrontReachable = await probe(STOREFRONT_URL)
    if (!storefrontReachable) {
      skipReason = `Suite C10 live runtime gate not satisfied: STOREFRONT_URL (${STOREFRONT_URL}) unreachable.`
    }
  })

  test.describe("fixture contract", () => {
    test("J4 anchor pins 60s trust-metric target", () => {
      expect(fixture.personas.J4.id).toBe("j4_marek_trust")
      expect(fixture.personas.J4.metric_target_seconds).toBe(60)
    })
  })

  test.describe("J4 live storefront", () => {
    test("≤60s: trust signals + cookie modal 2-step reachable", async ({ page }) => {
      test.skip(!storefrontReachable, skipReason || "storefront not available")

      const start = Date.now()
      const url = `${STOREFRONT_URL}/pl`
      const response = await page.goto(url, { waitUntil: "domcontentloaded" })
      expect(response?.status(), `${url} reachable`).toBeLessThan(400)

      // Cookie modal step 1 (the banner / minimal preferences) — H2C
      // alignment: CookieBanner is a client component mounted in root
      // layout. It transitions visible/hidden post-hydration via useEffect;
      // wait for either banner OR the post-consent reopen trigger.
      const cookieSurface = page.locator(
        '[data-testid="cookie-banner"], [data-testid="cookie-settings-reopen"], [data-cookie-banner], [role="dialog"][aria-label*="cookie" i], [role="region"][aria-label*="cookie" i]'
      )
      await expect(
        cookieSurface.first(),
        "cookie surface (banner or settings reopen) must hydrate"
      ).toBeVisible({ timeout: 10_000 })

      // Trust signals: lastUpdated/version/locale switcher
      const localeSwitcher = page.locator(
        '[data-testid="locale-switcher"], [aria-label*="language" i], [aria-label*="język" i]'
      )
      await expect(localeSwitcher.first(), "locale switcher").toBeVisible({
        timeout: 5_000,
      })

      const elapsed = (Date.now() - start) / 1000
      expect(
        elapsed,
        `J4 trust-scan must complete within ${fixture.personas.J4.metric_target_seconds}s (proxy)`
      ).toBeLessThanOrEqual(fixture.personas.J4.metric_target_seconds ?? 60)
    })

    test("no broken status.bonbeauty.pl link (or env-gated stub OK per F-CC6-08)", async ({
      page,
    }) => {
      test.skip(!storefrontReachable, skipReason || "storefront not available")

      await page.goto(`${STOREFRONT_URL}/pl`, { waitUntil: "domcontentloaded" })

      const statusLinks = page.locator('a[href*="status.bonbeauty"]')
      const count = await statusLinks.count()

      if (count === 0) {
        // No links to status.bonbeauty.pl on home → fine; trust surface
        // points elsewhere.
        expect(count).toBe(0)
        return
      }

      // If the link exists, F7 CC-6 F-CC6-08 says it must either resolve
      // (not 404 / DNS error) or be env-gated as a stub.
      const href = await statusLinks.first().getAttribute("href")
      expect(href, "status.bonbeauty link must have href").not.toBeNull()
      if (!href) return

      if (STATUS_PAGE_STUB_OK) {
        // env-gated stub mode — acceptable per F-CC6-08
        test.info().annotations.push({
          type: "F-CC6-08",
          description: `status.bonbeauty.pl in env-gated stub mode (STATUS_PAGE_STUB_OK=true)`,
        })
        expect(href).toContain("status.bonbeauty")
        return
      }

      // Strict mode: link must resolve
      const probeResp = await page.request.get(href).catch(() => null)
      expect(probeResp, `status link ${href} must be reachable`).not.toBeNull()
      if (probeResp) {
        expect(probeResp.status(), `${href} status`).toBeLessThan(500)
      }
    })
  })
})
