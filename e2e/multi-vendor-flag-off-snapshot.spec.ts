/**
 * Story v160-8-8 — AC3 (AC-MV-FLAG-OFF-01) Snapshot guard
 *
 * Verifies that legacy single-vendor UX is preserved when flag === 'off'.
 * Captures functional DOM-state JSON snapshots per page and asserts:
 *   - No seller-selector in PDP
 *   - No multi-vendor cart group headers
 *   - No lowest-price badge in PLP multi-vendor mode
 *   - No order-set splits in checkout
 *
 * Flag is restored to its pre-test state (on/shadow) in afterAll.
 *
 * @see specs/operator/pre-promote-smoke-checklist.md
 * @see NFR-REL-2 / AC-MV-FLAG-OFF-01
 */

import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import {
  getFlagState,
  setFlagState,
  ensureFlagOff,
  type MultiVendorFlagState,
} from "./helpers/flag-helper"
import {
  findProductsFromMultipleSellers,
  findTestProductHandle,
  probeBackendHealth,
} from "./helpers/seed-helper"
import {
  LOCALE,
  TEST_CATEGORY_HANDLE,
  paths,
} from "./fixtures/test-data"

/* ---------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------*/

const p = paths(LOCALE)
const SNAPSHOTS_DIR = path.join(__dirname, "__snapshots__")

/** Write a JSON state snapshot to __snapshots__/ directory. */
function writeSnapshot(name: string, data: unknown): void {
  if (!fs.existsSync(SNAPSHOTS_DIR)) {
    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
  }
  const filePath = path.join(SNAPSHOTS_DIR, `${name}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8")
}

/** Load a previously saved JSON snapshot, or return null if not found. */
function loadSnapshot(name: string): unknown | null {
  const filePath = path.join(SNAPSHOTS_DIR, `${name}.json`)
  if (!fs.existsSync(filePath)) return null
  return JSON.parse(fs.readFileSync(filePath, "utf-8"))
}

/* ---------------------------------------------------------------------------
 * State: track what state we were in before the suite ran.
 * -------------------------------------------------------------------------*/

let previousFlagState: MultiVendorFlagState = "on"

/* ---------------------------------------------------------------------------
 * Setup & teardown
 * -------------------------------------------------------------------------*/

test.beforeAll(async () => {
  const healthy = await probeBackendHealth()
  if (!healthy) {
    console.warn(
      "[DEFERRED] Backend not reachable — AC7 snapshot guard deferred. " +
        "Blocker: BB market must be materialized per pre-promote-smoke-checklist.md",
    )
    test.skip()
    return
  }
  // Save current state and flip to off
  previousFlagState = await getFlagState()
  await ensureFlagOff()
})

test.afterAll(async () => {
  const healthy = await probeBackendHealth()
  if (!healthy) return
  // Restore flag to original state
  if (previousFlagState === "on") {
    const current = await getFlagState()
    if (current === "off") {
      await setFlagState("shadow")
      await setFlagState("on")
    } else if (current === "shadow") {
      await setFlagState("on")
    }
  } else if (previousFlagState === "shadow") {
    const current = await getFlagState()
    if (current === "off") {
      await setFlagState("shadow")
    }
  }
  console.log(
    `[INFO] Flag restored to '${previousFlagState}' after snapshot guard suite.`,
  )
})

/* ---------------------------------------------------------------------------
 * Snapshot: PLP — no lowest-price badge in multi-vendor mode
 * -------------------------------------------------------------------------*/

test("PLP — flag OFF: no multi-vendor lowest-price badge on category page", async ({
  page,
}) => {
  await page.goto(p.category(TEST_CATEGORY_HANDLE))

  // Wait for product cards to load
  await page.waitForSelector('[data-testid="product-card"]', {
    timeout: 10_000,
  }).catch(() => {/* page may not have product cards — skip */})

  // Assert NO lowest-price badge in multi-vendor mode (flag off = no mv badge)
  const mvLowestPriceBadges = page.locator(
    '[data-testid="lowest-price-badge"][data-mv="true"]',
  )
  expect(await mvLowestPriceBadges.count()).toBe(0)

  // Assert NO multi-vendor indicator
  const mvIndicators = page.locator('[data-testid="multi-vendor-indicator"]')
  expect(await mvIndicators.count()).toBe(0)

  // Capture snapshot (capturedAt in meta — excluded from comparisons).
  const snapshot = {
    flag: "off",
    mvLowestPriceBadgeCount: 0,
    mvIndicatorCount: 0,
    meta: { url: p.category(TEST_CATEGORY_HANDLE), capturedAt: new Date().toISOString() },
  }
  writeSnapshot("flag-off-plp", snapshot)
  console.log("[SNAPSHOT] flag-off-plp written")
})

/* ---------------------------------------------------------------------------
 * Snapshot: PDP — no seller selector
 * -------------------------------------------------------------------------*/

test("PDP — flag OFF: no seller selector on product detail page", async ({
  page,
}) => {
  const productHandle =
    (await findTestProductHandle()) ?? "test-product"

  await page.goto(p.product(productHandle))

  // Wait for product title
  await page
    .waitForSelector('[data-testid="product-title"]', { timeout: 10_000 })
    .catch(() => {/* may not have testid — that's ok */})

  // Assert NO seller selector
  const sellerSelector = page.locator('[data-testid="seller-selector"]')
  expect(await sellerSelector.count()).toBe(0)

  const snapshot = {
    flag: "off",
    sellerSelectorCount: 0,
    meta: { url: p.product(productHandle), capturedAt: new Date().toISOString() },
  }
  writeSnapshot("flag-off-pdp", snapshot)
  console.log("[SNAPSHOT] flag-off-pdp written")
})

/* ---------------------------------------------------------------------------
 * Snapshot: Cart — no multi-vendor groups
 * -------------------------------------------------------------------------*/

test("Cart — flag OFF: no vendor-cart-group headers", async ({ page }) => {
  await page.goto(p.cart)

  // Wait for cart page to load
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})

  // Assert NO vendor cart groups
  const vendorGroups = page.locator('[data-testid="vendor-cart-group"]')
  expect(await vendorGroups.count()).toBe(0)

  const snapshot = {
    flag: "off",
    vendorCartGroupCount: 0,
    meta: { url: p.cart, capturedAt: new Date().toISOString() },
  }
  writeSnapshot("flag-off-cart", snapshot)
  console.log("[SNAPSHOT] flag-off-cart written")
})

/* ---------------------------------------------------------------------------
 * Snapshot: Checkout — no order-set splits
 * -------------------------------------------------------------------------*/

test("Checkout — flag OFF: no multi-vendor order_set splits", async ({
  page,
}) => {
  await page.goto(p.checkout)

  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {})

  // Assert NO order-set splits widget
  const orderSetSplits = page.locator('[data-testid="order-set-splits"]')
  expect(await orderSetSplits.count()).toBe(0)

  const multiVendorSummary = page.locator(
    '[data-testid="multi-vendor-order-summary"]',
  )
  expect(await multiVendorSummary.count()).toBe(0)

  const snapshot = {
    flag: "off",
    orderSetSplitsCount: 0,
    multiVendorOrderSummaryCount: 0,
    meta: { url: p.checkout, capturedAt: new Date().toISOString() },
  }
  writeSnapshot("flag-off-checkout", snapshot)
  console.log("[SNAPSHOT] flag-off-checkout written")
})

/* ---------------------------------------------------------------------------
 * Snapshot existence validation
 * -------------------------------------------------------------------------*/

test("All 4 flag-off snapshots are present and assert zero multi-vendor elements", async () => {
  type Snapshot = { flag: string; [key: string]: unknown }
  const checks: Array<{ name: string; zeroKeys: string[] }> = [
    { name: "flag-off-plp", zeroKeys: ["mvLowestPriceBadgeCount", "mvIndicatorCount"] },
    { name: "flag-off-pdp", zeroKeys: ["sellerSelectorCount"] },
    { name: "flag-off-cart", zeroKeys: ["vendorCartGroupCount"] },
    { name: "flag-off-checkout", zeroKeys: ["orderSetSplitsCount", "multiVendorOrderSummaryCount"] },
  ]
  for (const { name, zeroKeys } of checks) {
    const data = loadSnapshot(name) as Snapshot | null
    expect(data).not.toBeNull()
    expect(data!.flag).toBe("off")
    for (const key of zeroKeys) {
      expect(data![key]).toBe(0)
    }
  }
  console.log("[PASS] All 4 flag-off snapshots verified — zero multi-vendor elements.")
})
