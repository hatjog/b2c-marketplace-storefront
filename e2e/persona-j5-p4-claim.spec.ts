/**
 * E2E-C / Suite C11 — Persona J5 P4 claim (v1.9.0 Wave F4)
 *
 * J5 sub-scenarios (P4 recipient claim):
 *   - J5a: magic-link refresh
 *   - J5b: minor consent / KYC
 *   - J5c: brand intro block
 *   - J5d: locale auto-detect + cross-market gracious fallback
 *
 * Persona-proxy refs:
 *   - specs/releases/v1.9.0/persona-proxy/e2e-persona-p4-recipient-report.md
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:3002"
const CLAIM_PAGE_URL = process.env.CLAIM_PAGE_URL ?? STOREFRONT_URL

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
    { id: string; label: string; sub_scenarios?: string[] }
  >
  persona_proxy_artifacts: string[]
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
let claimReachable = false
let skipReason = ""

test.describe("Suite C11 @persona @v190-e2e-c @needs-stack — J5 P4 claim (F4)", () => {
  test.beforeAll(async () => {
    fixture = loadFixture()
    storefrontReachable = await probe(STOREFRONT_URL)
    claimReachable = await probe(CLAIM_PAGE_URL)
    if (!storefrontReachable || !claimReachable) {
      const missing: string[] = []
      if (!storefrontReachable) missing.push(`STOREFRONT_URL (${STOREFRONT_URL})`)
      if (!claimReachable) missing.push(`CLAIM_PAGE_URL (${CLAIM_PAGE_URL})`)
      skipReason = `Suite C11 live runtime gate not satisfied: missing ${missing.join(", ")}.`
    }
  })

  test.describe("fixture contract (J5 sub-scenarios)", () => {
    test("J5 anchor pins 4 P4 sub-scenarios", () => {
      expect(fixture.personas.J5.id).toBe("j5_p4_claim")
      expect(fixture.personas.J5.sub_scenarios).toEqual(
        expect.arrayContaining([
          "magic_link_refresh",
          "minor_consent_KYC",
          "brand_intro_block",
          "locale_auto_detect_cross_market_fallback",
        ])
      )
    })

    test("persona-proxy P4 recipient report is referenced", () => {
      expect(
        fixture.persona_proxy_artifacts.some((p) =>
          p.includes("e2e-persona-p4-recipient-report")
        )
      ).toBe(true)
    })
  })

  test.describe("J5 live claim surfaces", () => {
    test("J5a magic-link refresh surface reachable", async ({ page }) => {
      test.skip(!storefrontReachable || !claimReachable, skipReason)

      // Claim surface base — exact URL is product-specific, we probe a
      // canonical magic-link expired/refresh surface if env is provided.
      const refreshUrl =
        process.env.E2E_C11_REFRESH_URL ?? `${CLAIM_PAGE_URL}/pl/claim?status=expired`
      const r = await page.goto(refreshUrl, { waitUntil: "domcontentloaded" })
      expect(r?.status(), `${refreshUrl} reachable`).toBeLessThan(500)

      const refreshCta = page.locator(
        'a[data-testid="magic-link-refresh"], button[data-testid="magic-link-refresh"], a:text("nowy link"), button:text("Wyślij ponownie"), a:text("resend")'
      )
      const count = await refreshCta.count()
      expect(count, "J5a magic-link refresh CTA").toBeGreaterThanOrEqual(1)
    })

    test("J5b minor consent / KYC surface present", async ({ page }) => {
      test.skip(!storefrontReachable || !claimReachable, skipReason)

      const url = process.env.E2E_C11_KYC_URL ?? `${CLAIM_PAGE_URL}/pl/claim?kyc=minor`
      const r = await page.goto(url, { waitUntil: "domcontentloaded" })
      expect(r?.status(), `${url} reachable`).toBeLessThan(500)

      const consentText = page.locator(
        ':text("zgoda"), :text("opiekun"), :text("consent"), :text("guardian"), :text("KYC")'
      )
      const count = await consentText.count()
      expect(count, "J5b minor consent / KYC surface").toBeGreaterThanOrEqual(1)
    })

    test("J5c brand intro block visible on claim landing", async ({ page }) => {
      test.skip(!storefrontReachable || !claimReachable, skipReason)

      const url = process.env.E2E_C11_CLAIM_URL ?? `${CLAIM_PAGE_URL}/pl/claim`
      const r = await page.goto(url, { waitUntil: "domcontentloaded" })
      expect(r?.status(), `${url} reachable`).toBeLessThan(500)

      const brandBlock = page.locator(
        '[data-testid="brand-intro"], [data-section="brand-intro"], header [data-brand], h1, [role="banner"] img[alt*="logo" i]'
      )
      const count = await brandBlock.count()
      expect(count, "J5c brand intro block").toBeGreaterThanOrEqual(1)
    })

    test("J5d locale auto-detect — cross-market fallback is gracious", async ({
      page,
    }) => {
      test.skip(!storefrontReachable || !claimReachable, skipReason)

      // Hit the claim URL with a non-default locale; cross-market gracious
      // fallback must not 5xx and must surface a locale-switch affordance.
      const url = process.env.E2E_C11_CROSS_LOCALE_URL ?? `${CLAIM_PAGE_URL}/de/claim`
      const r = await page.goto(url, { waitUntil: "domcontentloaded" })
      expect(r?.status(), `${url} reachable`).toBeLessThan(500)

      const switcher = page.locator(
        '[data-testid="locale-switcher"], [aria-label*="language" i], [aria-label*="język" i]'
      )
      await expect(
        switcher.first(),
        "J5d locale switcher must be reachable on cross-market claim"
      ).toBeVisible({ timeout: 10_000 })
    })
  })
})
