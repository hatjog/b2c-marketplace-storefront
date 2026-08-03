/**
 * Suite A2 — Stripe Elements 3DS challenge path.
 *
 * v1.9.0 Phase 4 Wave E2E-A. Covers the authentication-required path: card
 * 4000 0000 0000 0341 triggers Stripe's hosted 3D Secure challenge in a
 * separate iframe; the storefront then receives `payment_intent.succeeded`
 * once the customer completes the challenge, and the order is finalized.
 *
 * Tags: @stripe @v190-e2e-a @needs-stack
 *
 * Required services (same as Suite A1):
 *   docker-compose up + Stripe CLI listen + STRIPE_*_BONBEAUTY env vars.
 *
 * IMPORTANT: 3DS challenge UI is fully owned by Stripe. We assert:
 *   1. The challenge iframe mounts (frame URL on hooks.stripe.com).
 *   2. Auto-confirm via Stripe's test "Complete authentication" button
 *      (data-testid `test-source-authorize-3ds`) — Stripe exposes this on
 *      test-mode challenges so headless tests can complete the flow.
 *   3. After confirm, storefront receives the same redirect as Suite A1.
 *
 * Run:
 *   cd GP/storefront && BONBEAUTY_URL=http://localhost:3002 \
 *     pnpm playwright test e2e/voucher-checkout-stripe-3ds.spec.ts
 *
 * Duration: ~60-90s per run (3DS popup adds ~10-20s).
 */

import { test, expect } from "@playwright/test"

import {
  fillStripeCard,
  MEDUSA_URL,
  probeStack,
  STORE_HEADERS,
  STRIPE_TEST_CARDS,
  submitStripePayment,
  waitForStripeReady,
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
    `Stack not ready for Suite A2 — Stripe 3DS path. Blockers:\n  - ${stackBlockers.join("\n  - ")}`,
  )
})

test.describe("Suite A2: Stripe Elements 3DS challenge (@stripe @v190-e2e-a @needs-stack)", () => {
  test("3DS-required card → challenge UI mounts → on completion order is finalized", async ({
    page,
  }) => {
    test.setTimeout(180_000)

    // 1. Pick first product.
    const prodResp = await page.request.get(
      `${MEDUSA_URL}/store/products?limit=1&country_code=pl&fields=id,handle`,
      { headers: STORE_HEADERS },
    )
    expect(prodResp.ok()).toBeTruthy()
    const { products = [] } = (await prodResp.json()) as { products?: Array<{ handle: string }> }
    test.skip(products.length === 0, "BonBeauty has no products seeded — DEFERRED")

    // 2. Add to cart + drive to payment step.
    await page.goto(p.product(products[0].handle), { waitUntil: "domcontentloaded" })
    await page
      .getByRole("button", { name: /dodaj do koszyka|add to cart|kup teraz/i })
      .first()
      .click({ timeout: 10_000 })
    await page.goto(`${p.checkout}?step=payment`, { waitUntil: "networkidle" })
    await waitForStripeReady(page)

    // 3. Fill 3DS-required card.
    await fillStripeCard(page, STRIPE_TEST_CARDS.visa_3ds_required)
    await submitStripePayment(page)

    // 4. Wait for the 3DS challenge iframe (hosted on hooks.stripe.com or a
    //    privateStripeFrame variant nested under it).
    const challengeFrame = await page.waitForFunction(
      () => {
        const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))
        return frames.some(
          (f) =>
            f.src.includes("hooks.stripe.com") ||
            f.src.includes("/3d_secure") ||
            f.name.includes("__privateStripeFrame") && f.src.includes("3d"),
        )
      },
      { timeout: 30_000 },
    )
    expect(challengeFrame, "3DS challenge iframe must mount within 30s").toBeTruthy()

    // 5. Click Stripe's test "Complete authentication" button. In test mode
    //    Stripe renders a deterministic challenge with a "Complete
    //    authentication" / "Authorize Test Payment" button identified by
    //    data-testid `test-source-authorize-3ds` (Stripe's documented test
    //    contract). Multiple frame layers may be involved.
    const completeChallenge = async (): Promise<boolean> => {
      for (const frame of page.frames()) {
        const buttons = frame.locator(
          "button#test-source-authorize-3ds, button[id*='test-source-authorize'], button:has-text('Complete authentication'), button:has-text('Complete')",
        )
        if ((await buttons.count()) > 0) {
          await buttons.first().click({ timeout: 5_000 }).catch(() => undefined)
          return true
        }
      }
      return false
    }

    // Retry for up to 20s while the challenge frame fully boots.
    let challengeCompleted = false
    for (let attempt = 0; attempt < 10 && !challengeCompleted; attempt++) {
      if (await completeChallenge()) {
        challengeCompleted = true
        break
      }
      await page.waitForTimeout(2_000)
    }
    expect(
      challengeCompleted,
      "Stripe test-mode 3DS Complete-Authentication button must be clickable",
    ).toBeTruthy()

    // 6. Post-challenge: storefront should redirect to payment-status/confirmed.
    await page.waitForURL(/\/order\/[^/]+\/(payment-status|confirmed)$/, { timeout: 60_000 })

    // 7. Validate the order id resolves a captured payment via store API.
    const match = page.url().match(/\/order\/([^/]+)\//)
    expect(match).toBeTruthy()
    const orderId = match![1]
    const orderResp = await page.request.get(
      `${MEDUSA_URL}/store/orders/${orderId}?fields=id,payment_collections.status`,
      { headers: STORE_HEADERS },
    )
    expect(orderResp.ok()).toBeTruthy()
    const { order } = (await orderResp.json()) as {
      order: { payment_collections?: Array<{ status?: string }> }
    }
    const statuses = (order.payment_collections ?? []).map((pc) => pc.status)
    expect(
      statuses.some((s) => s === "authorized" || s === "captured" || s === "completed"),
      `payment_collection must be authorized/captured post-3DS — got ${JSON.stringify(statuses)}`,
    ).toBeTruthy()
  })
})
