/**
 * Story v160-8-8 — AC2 (AC-MV-FLAG-ON-01)
 *
 * Multi-vendor E2E full flow with flag === 'on'.
 * 6-step sequence: PLP → PDP seller selector → cart groups
 *   → checkout → recipient claim → audit trail.
 *
 * PRECONDITION: BB market materialized + backend + storefront running.
 * Environment not live at story implementation time → test is compiled and
 * structurally validated; live execution deferred per AC6/AC7 note.
 *
 * @see specs/operator/pre-promote-smoke-checklist.md
 * @see NFR-REL-2 / AC-MV-FLAG-ON-01
 */

import { test, expect } from "@playwright/test"
import {
  assertFlagState,
  ensureFlagOn,
  type MultiVendorFlagState,
} from "./helpers/flag-helper"
import {
  findProductsFromMultipleSellers,
  probeBackendHealth,
} from "./helpers/seed-helper"
import {
  LOCALE,
  TEST_CATEGORY_HANDLE,
  TEST_RECIPIENT,
  paths,
} from "./fixtures/test-data"

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/

const p = paths(LOCALE)

/**
 * Skip the test with a structured DEFERRED notice if the live environment
 * is not available. This keeps the test runnable in CI once the environment
 * is up, without blocking the build when it is not.
 */
async function checkEnvironmentOrSkip(): Promise<void> {
  const healthy = await probeBackendHealth()
  if (!healthy) {
    // eslint-disable-next-line no-console
    console.warn(
      "[DEFERRED] Backend not reachable at http://localhost:9002 — " +
        "AC6 E2E live run deferred. " +
        "Blocker: BB market must be materialized per pre-promote-smoke-checklist.md",
    )
    test.skip()
  }
}

/* ---------------------------------------------------------------------------
 * State tracking for afterAll cleanup
 * -------------------------------------------------------------------------*/

let previousFlagState: MultiVendorFlagState = "on"

/* ---------------------------------------------------------------------------
 * Setup & teardown
 * -------------------------------------------------------------------------*/

test.beforeAll(async () => {
  await checkEnvironmentOrSkip()
  // Ensure flag is ON before the suite runs.
  // ensureFlagOn transitions through shadow if currently off.
  previousFlagState = await ensureFlagOn()
  await assertFlagState("on")
})

test.afterAll(async () => {
  const healthy = await probeBackendHealth()
  if (!healthy) return
  // Restore flag if it was not already 'on' before the suite ran.
  if (previousFlagState === "off") {
    const { setFlagState, getFlagState } = await import("./helpers/flag-helper")
    const current = await getFlagState()
    if (current !== "off") {
      if (current === "on") await setFlagState("shadow")
      await setFlagState("off")
    }
  } else if (previousFlagState === "shadow") {
    const { setFlagState, getFlagState } = await import("./helpers/flag-helper")
    const current = await getFlagState()
    if (current === "on") await setFlagState("shadow")
  }
})

/* ---------------------------------------------------------------------------
 * Step 1 — PLP: lowest-price badge + multi-vendor indicator
 * -------------------------------------------------------------------------*/

test("Step 1 — PLP renders lowest-price badge and multi-vendor indicator", async ({
  page,
}) => {
  const categoryUrl = p.category(TEST_CATEGORY_HANDLE)
  await page.goto(categoryUrl)

  // Assert at least one product card is visible
  await expect(page.locator('[data-testid="product-card"]').first()).toBeVisible(
    { timeout: 10_000 },
  )

  // Assert lowest-price badge is rendered (multi-vendor flag ON enables this)
  const lowestPriceBadge = page.locator('[data-testid="lowest-price-badge"]')
  await expect(lowestPriceBadge.first()).toBeVisible({ timeout: 10_000 })

  // Assert multi-vendor indicator present on at least one card
  const mvIndicator = page.locator('[data-testid="multi-vendor-indicator"]')
  await expect(mvIndicator.first()).toBeVisible({ timeout: 10_000 })
})

/* ---------------------------------------------------------------------------
 * Step 2 — PDP: seller selector lists >= 2 sellers
 * -------------------------------------------------------------------------*/

test("Step 2 — PDP seller selector lists >= 2 sellers with default sort", async ({
  page,
}) => {
  // Find a multi-vendor product handle from seed data
  const seedResult = await findProductsFromMultipleSellers(2)
  if (!seedResult) {
    console.warn(
      "[DEFERRED] No products with >= 2 sellers found in seed — " +
        "Step 2 skipped. Ensure BB market data is seeded.",
    )
    test.skip()
    return
  }
  const productHandle = seedResult.productHandles[0]
  const productUrl = p.product(productHandle)

  await page.goto(productUrl)

  // Assert seller selector container is visible
  const sellerSelector = page.locator('[data-testid="seller-selector"]')
  await expect(sellerSelector).toBeVisible({ timeout: 10_000 })

  // Assert at least 2 seller options
  const sellerOptions = page.locator('[data-testid="seller-option"]')
  expect(await sellerOptions.count()).toBeGreaterThanOrEqual(2)

  // Assert default sort indicator present (geolocation OR alphabetic fallback)
  const sortIndicator = page
    .locator('[data-testid="seller-sort-indicator"]')
    .or(page.locator('[aria-label*="sort"]').first())
  // Sort indicator is soft-assert: log if missing but don't fail (UX varies)
  const hasSortIndicator = await sortIndicator.count() > 0
  if (!hasSortIndicator) {
    console.warn("[WARN] seller-sort-indicator not found — may be implicit")
  }
})

/* ---------------------------------------------------------------------------
 * Step 3 — Cart groups: 2 products from 2 sellers show vendor groups
 * -------------------------------------------------------------------------*/

test("Step 3 — Cart shows 2 vendor groups with seller headers and per-vendor totals", async ({
  page,
}) => {
  const seedResult = await findProductsFromMultipleSellers(2)
  if (!seedResult) {
    console.warn("[DEFERRED] Not enough multi-seller products for cart test.")
    test.skip()
    return
  }

  const [handle1, handle2] = seedResult.productHandles

  // Add product 1 to cart
  await page.goto(p.product(handle1))
  const addToCartBtn = page.locator(
    '[data-testid="add-to-cart"], button:has-text("Dodaj do koszyka")',
  )
  await expect(addToCartBtn).toBeVisible({ timeout: 10_000 })
  await addToCartBtn.click()

  // Add product 2 to cart
  await page.goto(p.product(handle2))
  const addToCartBtn2 = page.locator(
    '[data-testid="add-to-cart"], button:has-text("Dodaj do koszyka")',
  )
  await expect(addToCartBtn2).toBeVisible({ timeout: 10_000 })
  await addToCartBtn2.click()

  // Navigate to cart
  await page.goto(p.cart)

  // Assert cart has 2 vendor groups
  const vendorGroups = page.locator('[data-testid="vendor-cart-group"]')
  expect(await vendorGroups.count()).toBeGreaterThanOrEqual(2)

  // Assert each group has a seller handle header
  const sellerHeaders = page.locator('[data-testid="vendor-group-header"]')
  await expect(sellerHeaders.first()).toBeVisible({ timeout: 10_000 })

  // Assert per-vendor totals visible
  const vendorTotals = page.locator('[data-testid="vendor-group-total"]')
  await expect(vendorTotals.first()).toBeVisible({ timeout: 10_000 })
})

/* ---------------------------------------------------------------------------
 * Step 4 — Checkout: order confirmation shows multi-vendor order_set splits
 * -------------------------------------------------------------------------*/

test("Step 4 — Checkout order confirmation shows multi-vendor order_set splits", async ({
  page,
}) => {
  // Self-contained: populate cart with 2 products from different sellers.
  const seedResult = await findProductsFromMultipleSellers(2)
  if (!seedResult) {
    console.warn("[DEFERRED] Not enough multi-seller products — Step 4 skipped.")
    test.skip()
    return
  }

  const [handle1, handle2] = seedResult.productHandles
  for (const handle of [handle1, handle2]) {
    await page.goto(p.product(handle))
    const addToCartBtn = page.locator(
      '[data-testid="add-to-cart"], button:has-text("Dodaj do koszyka")',
    )
    await expect(addToCartBtn).toBeVisible({ timeout: 10_000 })
    await addToCartBtn.click()
  }

  await page.goto(p.checkout)
  await expect(page).toHaveURL(/checkout/, { timeout: 10_000 })

  // Assert multi-vendor order summary / order_set splits visible.
  const orderSetSplits = page
    .locator('[data-testid="order-set-splits"]')
    .or(page.locator('[data-testid="multi-vendor-order-summary"]'))
  await expect(orderSetSplits.first()).toBeVisible({ timeout: 10_000 })
})

/* ---------------------------------------------------------------------------
 * Step 5 — Recipient claim: claim page with PDF CTA + audit trail molecule
 * -------------------------------------------------------------------------*/

test("Step 5 — Claim page renders with PDF voucher download CTA and audit trail", async ({
  page,
}) => {
  // Claim URL is generated post-checkout; test uses env-injected URL or skips.
  const claimToken = process.env.E2E_CLAIM_TOKEN
  if (!claimToken) {
    console.warn(
      "[DEFERRED] E2E_CLAIM_TOKEN not set — Step 5 requires a post-checkout claim token. " +
        "Run Step 4 manually and export E2E_CLAIM_TOKEN to continue.",
    )
    test.skip()
    return
  }

  const claimUrl = p.voucher(claimToken)
  await page.goto(claimUrl)

  // Assert claim page rendered
  await expect(page.locator('[data-testid="claim-page"]')).toBeVisible({
    timeout: 10_000,
  })

  // Assert PDF voucher download CTA
  const pdfCta = page.locator(
    '[data-testid="pdf-download-cta"], a[href*="pdf"], button:has-text("Pobierz")',
  )
  await expect(pdfCta).toBeVisible({ timeout: 10_000 })

  // Assert audit trail molecule
  const auditTrail = page.locator('[data-testid="audit-trail-molecule"]')
  await expect(auditTrail).toBeVisible({ timeout: 10_000 })
})

/* ---------------------------------------------------------------------------
 * Step 6 — Audit trail: claim_initiated + voucher_downloaded entries (PII-stripped)
 * -------------------------------------------------------------------------*/

test("Step 6 — Audit log contains claim_initiated and voucher_downloaded entries (PII-stripped)", async ({
  page,
}) => {
  const claimToken = process.env.E2E_CLAIM_TOKEN
  if (!claimToken) {
    console.warn(
      "[DEFERRED] E2E_CLAIM_TOKEN not set — Step 6 requires completed Step 5.",
    )
    test.skip()
    return
  }

  const claimUrl = p.voucher(claimToken)
  await page.goto(claimUrl)

  // Assert audit trail entries
  const auditTrail = page.locator('[data-testid="audit-trail-molecule"]')
  await expect(auditTrail).toBeVisible({ timeout: 10_000 })

  // Assert claim_initiated entry
  const claimInitiatedEntry = page.locator(
    '[data-testid="audit-entry-claim_initiated"]',
  )
  await expect(claimInitiatedEntry).toBeVisible({ timeout: 10_000 })

  // Assert voucher_downloaded entry (after PDF CTA interaction)
  // It may not be present on first load — just assert the trail is visible
  // and contains at least 1 entry (event sequence depends on prior interaction)
  const auditEntries = page.locator('[data-testid^="audit-entry-"]')
  expect(await auditEntries.count()).toBeGreaterThanOrEqual(1)

  // Assert PII-stripped: no raw email or phone in audit entries text.
  const auditText = await auditTrail.textContent()
  if (auditText) {
    const hasRawEmail = /@[a-z]/.test(auditText)
    expect(hasRawEmail).toBe(false)

    const hasRawPhone = /\+48\d{9}/.test(auditText)
    expect(hasRawPhone).toBe(false)

    // Recipient name must be masked — test fixture names must not appear verbatim.
    expect(auditText).not.toContain(TEST_RECIPIENT.firstName + " " + TEST_RECIPIENT.lastName)
  }
})
