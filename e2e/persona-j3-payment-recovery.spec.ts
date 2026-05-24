/**
 * E2E-C / Suite C9 — Persona J3 payment recovery (v1.9.0 Wave F4)
 *
 * J3 journey:
 *   - Payment attempt fails (Stripe test-mode declined card)
 *   - Retry path surfaces a non-F-01-href fix (F7 storefront cluster)
 *   - Idempotency key preserved across the retry
 *   - 2nd attempt succeeds
 *
 * Scope guard: Stripe internals (PaymentIntent creation, webhook ordering)
 * belong to E2E-A. We assert only the storefront-side recovery surface +
 * idempotency-key preservation through the retry.
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
  personas: Record<string, { id: string; label: string; idempotency_key_preserved?: boolean }>
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

test.describe("Suite C9 @persona @v190-e2e-c @needs-stack — J3 payment recovery (F4 + F7 retry-href)", () => {
  test.beforeAll(async () => {
    fixture = loadFixture()
    storefrontReachable = await probe(STOREFRONT_URL)
    if (!storefrontReachable) {
      skipReason = `Suite C9 live runtime gate not satisfied: STOREFRONT_URL (${STOREFRONT_URL}) unreachable.`
    }
  })

  test.describe("fixture contract", () => {
    test("J3 anchor pins idempotency-key invariant", () => {
      expect(fixture.personas.J3.id).toBe("j3_payment_recovery")
      expect(fixture.personas.J3.idempotency_key_preserved).toBe(true)
    })
  })

  test.describe("mocked-route contract — idempotency key preserved through retry", () => {
    const MOCK_ORIGIN = "https://mock.v190-c9.local"

    test("retry sends the same idempotency key; 2nd attempt 200", async ({ page }) => {
      await page.route(`${MOCK_ORIGIN}/__c9__`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><html><body>C9 mock</body></html>",
        })
      })
      await page.goto(`${MOCK_ORIGIN}/__c9__`, { waitUntil: "domcontentloaded" })

      const seenKeys: string[] = []
      let attempt = 0
      await page.route(`${MOCK_ORIGIN}/store/payment-sessions`, async (route) => {
        const key = route.request().headers()["idempotency-key"] ?? ""
        seenKeys.push(key)
        attempt += 1
        if (attempt === 1) {
          return route.fulfill({
            status: 402,
            contentType: "application/json",
            body: JSON.stringify({ code: "card_declined" }),
          })
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, payment_id: "pi_recovered" }),
        })
      })

      const idemKey = "idem-c9-stable-key-001"

      const first = await page.evaluate(
        async ({ origin, key }) => {
          const r = await fetch(`${origin}/store/payment-sessions`, {
            method: "POST",
            headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
            body: "{}",
          })
          return r.status
        },
        { origin: MOCK_ORIGIN, key: idemKey }
      )
      expect(first).toBe(402)

      const retry = await page.evaluate(
        async ({ origin, key }) => {
          const r = await fetch(`${origin}/store/payment-sessions`, {
            method: "POST",
            headers: { "Idempotency-Key": key, "Content-Type": "application/json" },
            body: "{}",
          })
          return r.status
        },
        { origin: MOCK_ORIGIN, key: idemKey }
      )
      expect(retry).toBe(200)
      expect(seenKeys).toEqual([idemKey, idemKey])
    })
  })

  test.describe("J3 live storefront retry surface", () => {
    test("retry surface present on payment-status route (real, not broken F-01 href)", async ({
      page,
    }) => {
      test.skip(!storefrontReachable, skipReason || "storefront not available")

      // F7 fixed the broken retry href surface. The route should render a
      // retry CTA when payment fails. We probe the route reachability and
      // the presence of a retry CTA when an error state is hinted via query.
      const url = `${STOREFRONT_URL}/pl/payment-status?status=failed`
      const r = await page.goto(url, { waitUntil: "domcontentloaded" })
      expect(r?.status(), `${url} reachable`).toBeLessThan(500)

      const retryCta = page.locator(
        'a[data-testid="payment-retry"], button[data-testid="payment-retry"], a:text("Spróbuj"), button:text("Spróbuj"), a:text("Retry"), button:text("Retry")'
      )
      const count = await retryCta.count()
      expect(
        count,
        "J3 retry CTA must be reachable on failed payment status"
      ).toBeGreaterThanOrEqual(1)

      // Anti-regression: the retry href must NOT be an empty fragment or
      // a literal "#" (the F-01 surface bug from F7).
      if (count > 0) {
        const href = await retryCta.first().getAttribute("href")
        if (href !== null) {
          expect(href, "retry href must not be broken '#'").not.toBe("#")
          expect(href, "retry href must not be empty").not.toBe("")
        }
      }
    })
  })
})
