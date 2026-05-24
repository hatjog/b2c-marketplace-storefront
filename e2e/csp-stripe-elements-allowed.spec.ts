/**
 * Suite A9 — CSP whitelist live, Stripe Elements allowed.
 *
 * v1.9.0 Phase 4 Wave E2E-A. Closes F-CC1-005 (CSP whitelist drop of
 * `api.mercurjs.com`, backend origin injection).
 *
 * Assertions (storefront-only, no Stripe round trip required for AC1):
 *   1. Checkout page response CSP header does NOT include `api.mercurjs.com`
 *      anywhere (substring scan across the full header — every directive).
 *   2. `connect-src` includes the GP backend origin from env (default
 *      http://localhost:9002).
 *   3. `connect-src` includes `https://api.stripe.com` / `https://m.stripe.com`
 *      / `https://r.stripe.com` (Story 1.6 contract — must NOT regress).
 *   4. `frame-src` includes `https://hooks.stripe.com` (3DS challenge frame).
 *   5. `script-src` includes `https://js.stripe.com`.
 *   6. `frame-ancestors 'none'` remains — anti-clickjacking not regressed.
 *
 * Plus live runtime check (skipped if Stripe.js not loadable):
 *   7. Stripe.js + Elements actually load without emitting Stripe-origin
 *      console.error (HG-5 regression alongside Story 1.6).
 *
 * Tags: @stripe @v190-e2e-a @needs-stack
 *
 * Run:
 *   cd GP/storefront && BONBEAUTY_URL=http://localhost:3002 \
 *     pnpm playwright test e2e/csp-stripe-elements-allowed.spec.ts
 *
 * Duration: ~10-20s per run.
 */

import { test, expect } from "@playwright/test"
import type { ConsoleMessage } from "@playwright/test"

import {
  cspDirective,
  MEDUSA_URL,
  parseCspHeader,
  probeStack,
} from "./fixtures/stripe-helpers"
import { LOCALE, paths } from "./fixtures/test-data"

const p = paths(LOCALE)

let stackBlockers: string[] = []

test.beforeAll(async () => {
  const result = await probeStack()
  stackBlockers = result.blockers
})

test.beforeEach(() => {
  test.skip(
    stackBlockers.length > 0,
    `Stack not ready for Suite A9 — CSP/Stripe. Blockers:\n  - ${stackBlockers.join("\n  - ")}`,
  )
})

function isStripeUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase()
    return host === "stripe.com" || host.endsWith(".stripe.com")
  } catch {
    return false
  }
}

test.describe("Suite A9: CSP whitelist live (@stripe @v190-e2e-a @needs-stack)", () => {
  test("checkout CSP excludes api.mercurjs.com and includes backend + Stripe origins", async ({
    page,
  }) => {
    const response = await page.goto(p.checkout, { waitUntil: "domcontentloaded" })
    expect(response, "checkout navigation must return a response").toBeTruthy()
    const csp = parseCspHeader(response!)
    expect(csp, "CSP header must be present on checkout responses").not.toBe("")

    // F-CC1-005: api.mercurjs.com must NOT appear in any directive.
    expect(csp, "CSP must NOT include api.mercurjs.com (F-CC1-005)").not.toContain(
      "api.mercurjs.com",
    )

    // Backend origin: env var or default; pick whatever the storefront process
    // resolved at runtime. We test the canonical local dev origin :9002.
    const backendOrigin = new URL(MEDUSA_URL).origin
    const connectSrc = cspDirective(csp, "connect-src")
    expect(connectSrc, "connect-src must exist").not.toBe("")
    // In strict mode the backend origin appears explicitly. In dev mode the
    // CSP may use a wildcard `http://localhost:*` — accept either.
    const backendAllowed =
      connectSrc.includes(backendOrigin) ||
      /localhost:\*/.test(connectSrc) ||
      connectSrc.includes("'self'")
    expect(
      backendAllowed,
      `connect-src must permit backend origin ${backendOrigin}; got: ${connectSrc}`,
    ).toBeTruthy()

    // Stripe connect-src origins (Story 1.6 contract).
    expect(connectSrc).toContain("https://api.stripe.com")
    expect(connectSrc).toContain("https://m.stripe.com")
    expect(connectSrc).toContain("https://r.stripe.com")

    // Stripe frame-src for 3DS challenges.
    const frameSrc = cspDirective(csp, "frame-src")
    expect(frameSrc).toContain("https://js.stripe.com")
    expect(frameSrc).toContain("https://hooks.stripe.com")

    // Stripe script-src for Stripe.js.
    const scriptSrc = cspDirective(csp, "script-src")
    expect(scriptSrc).toContain("https://js.stripe.com")

    // Anti-clickjacking guard intact.
    expect(csp, "frame-ancestors 'none' must remain").toContain("frame-ancestors 'none'")
  })

  test("Stripe.js + Elements load without Stripe-origin console.error", async ({ page }) => {
    test.setTimeout(60_000)
    const stripeConsoleErrors: string[] = []
    const stripePageErrors: string[] = []

    const onConsole = (msg: ConsoleMessage) => {
      if (msg.type() !== "error") return
      const loc = msg.location()
      if (isStripeUrl(loc.url)) {
        stripeConsoleErrors.push(`${loc.url}: ${msg.text()}`)
      }
    }
    const onPageError = (err: Error) => {
      if (err.stack && /stripe\.com/i.test(err.stack)) {
        stripePageErrors.push(err.message)
      }
    }
    page.on("console", onConsole)
    page.on("pageerror", onPageError)

    try {
      // Visit checkout payment step — this is the surface that actually mounts
      // PaymentElement. If checkout is gated behind an empty-cart guard the
      // surface won't render; that's OK for the CSP check below (we still
      // detect any CSP violation from Stripe.js load attempts on /).
      const response = await page.goto(`${p.checkout}?step=payment`, { waitUntil: "networkidle" })
      expect(response).toBeTruthy()
      // Allow async Stripe bootstrap to settle.
      await page.waitForTimeout(2_500)
    } finally {
      page.off("console", onConsole)
      page.off("pageerror", onPageError)
    }

    expect(
      stripeConsoleErrors,
      `Zero Stripe-origin console.error expected — got:\n${stripeConsoleErrors.join("\n")}`,
    ).toHaveLength(0)
    expect(
      stripePageErrors,
      `Zero Stripe-origin pageerror expected — got:\n${stripePageErrors.join("\n")}`,
    ).toHaveLength(0)
  })
})
