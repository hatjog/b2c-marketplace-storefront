/**
 * Stripe E2E helpers — v1.9.0 Phase 4, Wave E2E-A.
 *
 * Shared helpers for Suites A1/A2/A3/A9 (storefront-side Playwright tests).
 * Test mode ONLY — uses Stripe published test card numbers (NOT live cards).
 * Robert approved 2026-05-24: test keys + test cards are safe to commit.
 *
 * @see https://stripe.com/docs/testing#cards
 * @see /home/robsz/prj/GP/GP/storefront/src/lib/constants.ts STRIPE_PROVIDER_ID
 */

import type { Page, Response } from "@playwright/test"

/**
 * Stripe published test cards — public values (NOT real credentials).
 * @see https://docs.stripe.com/testing#cards
 */
export const STRIPE_TEST_CARDS = {
  /** Visa success — no authentication required. */
  visa_success: { number: "4242424242424242", exp: "12 / 34", cvc: "123", zip: "00001" },
  /** Visa requiring 3DS Authenticate challenge. */
  visa_3ds_required: { number: "4000000000000341", exp: "12 / 34", cvc: "123", zip: "00001" },
  /** Visa decline — generic. */
  visa_decline_generic: { number: "4000000000009995", exp: "12 / 34", cvc: "123", zip: "00001" },
  /** Visa refund-pending — refund is created but stays in pending state. */
  visa_refund_pending: { number: "4000000000009987", exp: "12 / 34", cvc: "123", zip: "00001" },
} as const

export type StripeTestCard = (typeof STRIPE_TEST_CARDS)[keyof typeof STRIPE_TEST_CARDS]

/**
 * Backend + storefront base URLs (env-driven, matching the conventions in
 * `GP/e2e/playwright.config.ts` + `GP/storefront/e2e/fixtures/test-data.ts`).
 */
export const BONBEAUTY_URL = process.env.BONBEAUTY_URL ?? "http://localhost:3002"
export const STOREFRONT_URL =
  process.env.STOREFRONT_BASE_URL ?? process.env.BONBEAUTY_URL ?? "http://localhost:8000"
export const MEDUSA_URL = process.env.MEDUSA_URL ?? "http://localhost:9002"
export const PUBLISHABLE_KEY =
  process.env.E2E_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
  "pk_73cc512f8b76b8aed24c0dbf855b19388347822946480b8e6207684769ceb0f9"

export const STORE_HEADERS: Record<string, string> = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "x-publishable-api-key": PUBLISHABLE_KEY,
}

/** Probe a URL — used to detect when the stack is down (skip-with-reason pattern). */
export async function probe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) })
    return response.status < 500
  } catch {
    return false
  }
}

export type StackProbeResult = {
  storefrontReachable: boolean
  backendReachable: boolean
  blockers: string[]
}

/** Pre-flight: storefront + backend health probes. */
export async function probeStack(): Promise<StackProbeResult> {
  const [storefront, backend] = await Promise.all([
    probe(new URL("/pl", STOREFRONT_URL).toString()),
    probe(new URL("/health", MEDUSA_URL).toString()),
  ])
  const blockers: string[] = []
  if (!storefront) blockers.push(`storefront unreachable at ${STOREFRONT_URL}/pl`)
  if (!backend) blockers.push(`Medusa backend health unreachable at ${MEDUSA_URL}/health`)
  return { storefrontReachable: storefront, backendReachable: backend, blockers }
}

/**
 * Fill the Stripe PaymentElement iframe with a test card.
 *
 * PaymentElement renders its fields inside one or more nested iframes named
 * `__privateStripeFrame*`. Field roles inside the iframe carry stable
 * `data-elements-stable-field-name` attributes (`cardNumber`, `cardExpiry`,
 * `cardCvc`, `postalCode`) that Stripe documents as the integration contract.
 *
 * This helper is iframe-aware: it walks all Stripe frames on the page until
 * it finds one with the requested field.
 */
export async function fillStripeCard(page: Page, card: StripeTestCard): Promise<void> {
  // Wait for any Stripe iframe to mount.
  await page.waitForSelector("iframe[name^='__privateStripeFrame'], iframe[src*='stripe.com']", {
    timeout: 20_000,
  })

  // Try to find the PaymentElement card form in any Stripe frame.
  const fillField = async (fieldName: string, value: string) => {
    const frames = page.frames().filter((f) => {
      const url = f.url()
      return url.includes("stripe.com") || url.includes("__privateStripeFrame")
    })
    for (const frame of frames) {
      const input = frame.locator(`input[name='${fieldName}'], input[autocomplete='${fieldName}']`)
      if ((await input.count()) > 0) {
        await input.first().fill(value)
        return true
      }
    }
    return false
  }

  // Stripe uses different input names depending on render mode:
  //   • Mode "tabs" / unified PaymentElement: input names are `number`, `expiry`, `cvc`,
  //     `postalCode` — distinguished from other inputs by `data-elements-stable-field-name`.
  //   • Legacy CardElement: input names are `cardnumber`, `exp-date`, `cvc`, `postal`.
  // We try unified names first, then fall back.
  const filledNumber =
    (await fillField("number", card.number)) ||
    (await fillField("cardnumber", card.number)) ||
    (await fillField("cardNumber", card.number))
  const filledExpiry =
    (await fillField("expiry", card.exp)) ||
    (await fillField("exp-date", card.exp)) ||
    (await fillField("cardExpiry", card.exp))
  const filledCvc =
    (await fillField("cvc", card.cvc)) || (await fillField("cardCvc", card.cvc))

  if (!filledNumber || !filledExpiry || !filledCvc) {
    throw new Error(
      `[stripe-helpers] Could not locate Stripe card inputs (number=${filledNumber}, expiry=${filledExpiry}, cvc=${filledCvc}). ` +
        `Available frames: ${page
          .frames()
          .map((f) => f.url())
          .join(" | ")}`,
    )
  }

  // Postal code field is conditional on country; best-effort.
  await fillField("postalCode", card.zip)
}

/**
 * Wait for `<PaymentElement>` to actually mount inside the Stripe iframe.
 * Use BEFORE calling fillStripeCard.
 */
export async function waitForStripeReady(page: Page, timeoutMs = 20_000): Promise<void> {
  await page.getByTestId("stripe-payment-element").waitFor({ timeout: timeoutMs })
  await page
    .locator("iframe[name^='__privateStripeFrame'], iframe[src*='stripe.com']")
    .first()
    .waitFor({ timeout: timeoutMs })
}

/**
 * Submit the Stripe payment via the storefront "Pay now" button (data-testid
 * `stripe-payment-element-submit` per `StripePaymentElement.tsx`).
 */
export async function submitStripePayment(page: Page): Promise<void> {
  await page.getByTestId("stripe-payment-element-submit").click()
}

/**
 * Capture an error message rendered by the Stripe PaymentElement
 * (data-testid `stripe-payment-element-error`).
 */
export async function readStripeError(page: Page): Promise<string | null> {
  const error = page.getByTestId("stripe-payment-element-error")
  if ((await error.count()) === 0) return null
  return ((await error.textContent()) ?? "").trim() || null
}

/** Open a fresh BonBeauty cart via the store API (no cookie state). */
export async function createBonbeautyCartViaApi(args: {
  productIds: string[]
  quantity?: number
}): Promise<{ cartId: string; lineItemIds: string[] }> {
  // 1) Resolve a region for PL.
  const regionsResp = await fetch(`${MEDUSA_URL}/store/regions`, { headers: STORE_HEADERS })
  if (!regionsResp.ok) throw new Error(`region fetch failed: ${regionsResp.status}`)
  const regions = (await regionsResp.json()) as { regions?: Array<{ id: string; countries?: Array<{ iso_2?: string }> }> }
  const region = regions.regions?.find((r) => (r.countries ?? []).some((c) => c.iso_2 === "pl"))
  if (!region) throw new Error("No PL region returned by /store/regions")

  // 2) Create cart.
  const cartResp = await fetch(`${MEDUSA_URL}/store/carts`, {
    method: "POST",
    headers: STORE_HEADERS,
    body: JSON.stringify({ region_id: region.id }),
  })
  if (!cartResp.ok) throw new Error(`cart create failed: ${cartResp.status}`)
  const { cart } = (await cartResp.json()) as { cart: { id: string } }

  // 3) For each product, fetch first variant and add to cart.
  const lineItemIds: string[] = []
  for (const productId of args.productIds) {
    const prodResp = await fetch(
      `${MEDUSA_URL}/store/products/${encodeURIComponent(productId)}?fields=id,variants.id`,
      { headers: STORE_HEADERS },
    )
    if (!prodResp.ok) throw new Error(`product fetch ${productId} failed: ${prodResp.status}`)
    const { product } = (await prodResp.json()) as { product: { variants?: Array<{ id: string }> } }
    const variantId = product.variants?.[0]?.id
    if (!variantId) throw new Error(`product ${productId} has no variant`)

    const addResp = await fetch(`${MEDUSA_URL}/store/carts/${cart.id}/line-items`, {
      method: "POST",
      headers: STORE_HEADERS,
      body: JSON.stringify({ variant_id: variantId, quantity: args.quantity ?? 1 }),
    })
    if (!addResp.ok) throw new Error(`line-item add failed: ${addResp.status}`)
    const { cart: updated } = (await addResp.json()) as {
      cart: { items?: Array<{ id: string; variant_id: string }> }
    }
    const newest = (updated.items ?? []).find((i) => i.variant_id === variantId)
    if (newest) lineItemIds.push(newest.id)
  }

  return { cartId: cart.id, lineItemIds }
}

/** Convenience: assert CSP headers from a navigation response. */
export function parseCspHeader(response: Response): string {
  const headers = response.headers()
  return headers["content-security-policy"] ?? headers["content-security-policy-report-only"] ?? ""
}

export function cspDirective(csp: string, directive: string): string {
  const segment = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === directive || part.startsWith(`${directive} `))
  return segment ?? ""
}
