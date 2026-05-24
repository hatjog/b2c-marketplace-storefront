/**
 * Suite A3 — Stripe Elements decline path.
 *
 * v1.9.0 Phase 4 Wave E2E-A. Covers the rejected-payment path: card
 * 4000 0000 0000 9995 returns `card_declined / generic_decline`. The
 * storefront must:
 *   1. Surface a localised decline error (NOT silent).
 *   2. Preserve the cart so the buyer can retry without re-adding items.
 *   3. Keep the PaymentElement enabled for a retry attempt.
 *
 * Tags: @stripe @v190-e2e-a @needs-stack
 *
 * Run:
 *   cd GP/storefront && BONBEAUTY_URL=http://localhost:3002 \
 *     pnpm playwright test e2e/voucher-checkout-stripe-decline.spec.ts
 *
 * Duration: ~30-60s per run.
 */

import { test, expect } from "@playwright/test"

import {
  fillStripeCard,
  MEDUSA_URL,
  probeStack,
  readStripeError,
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
    `Stack not ready for Suite A3 — Stripe decline path. Blockers:\n  - ${stackBlockers.join("\n  - ")}`,
  )
})

test.describe("Suite A3: Stripe Elements decline path (@stripe @v190-e2e-a @needs-stack)", () => {
  test("declined card → user-visible error, cart preserved, retry available", async ({ page }) => {
    test.setTimeout(120_000)

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

    // Capture the cart cookie BEFORE submitting; it must still be valid after decline.
    const cookiesBefore = await page.context().cookies()
    const cartIdBefore = cookiesBefore.find((c) => c.name === "_medusa_cart_id")?.value
    expect(cartIdBefore, "cart cookie must exist after add-to-cart").toBeTruthy()

    await page.goto(`${p.checkout}?step=payment`, { waitUntil: "networkidle" })
    await waitForStripeReady(page)

    // 3. Fill decline card and submit.
    await fillStripeCard(page, STRIPE_TEST_CARDS.visa_decline_generic)
    await submitStripePayment(page)

    // 4. Storefront must surface an error AND must NOT redirect to confirmation.
    //    Allow ~10s for the Stripe round trip + error render.
    await page.waitForTimeout(3_000)
    const errorText = await readStripeError(page)
    expect(errorText, "Stripe decline error must be rendered (no silent failure)").not.toBeNull()
    expect(
      page.url(),
      "decline must NOT redirect to /order/.../confirmed (cart must be preserved)",
    ).not.toMatch(/\/order\/[^/]+\/confirmed$/)

    // 5. Cart cookie must still be present and the cart still in store.
    const cookiesAfter = await page.context().cookies()
    const cartIdAfter = cookiesAfter.find((c) => c.name === "_medusa_cart_id")?.value
    expect(cartIdAfter, "cart cookie must persist after decline").toBe(cartIdBefore)

    const cartResp = await page.request.get(`${MEDUSA_URL}/store/carts/${cartIdBefore}`, {
      headers: STORE_HEADERS,
    })
    expect(cartResp.ok(), "cart must still be retrievable from store API after decline").toBeTruthy()
    const { cart } = (await cartResp.json()) as { cart: { items?: unknown[] } }
    expect((cart.items ?? []).length, "cart items must persist after decline").toBeGreaterThan(0)

    // 6. PaymentElement should still be mounted + interactive for a retry.
    await expect(page.getByTestId("stripe-payment-element")).toBeVisible()
    await expect(page.getByTestId("stripe-payment-element-submit")).toBeEnabled()
  })
})
