/**
 * Test fixtures for E2E specs — Story v160-8-8
 *
 * These are configuration defaults for the BB market test environment.
 * Override via environment variables when running in different environments.
 */

/** BB market locale prefix */
export const LOCALE = process.env.E2E_LOCALE ?? "pl"

/**
 * Category handle used for PLP tests.
 * Should contain products from >= 2 sellers in BB market.
 */
export const TEST_CATEGORY_HANDLE =
  process.env.E2E_CATEGORY_HANDLE ?? "twarz"

/**
 * Product handle for PDP seller-selector test.
 * Should be available from >= 2 sellers.
 */
export const TEST_PRODUCT_HANDLE =
  process.env.E2E_PRODUCT_HANDLE ?? "peeling-kwasami"

/**
 * Recipient test data for checkout + claim flow.
 */
export const TEST_RECIPIENT = {
  firstName: process.env.E2E_RECIPIENT_FIRST_NAME ?? "Anna",
  lastName: process.env.E2E_RECIPIENT_LAST_NAME ?? "Testowa",
  email: process.env.E2E_RECIPIENT_EMAIL ?? "e2e-recipient@test.bonbeauty.pl",
  phone: process.env.E2E_RECIPIENT_PHONE ?? "+48100000001",
}

/**
 * Buyer test data for checkout.
 */
export const TEST_BUYER = {
  firstName: process.env.E2E_BUYER_FIRST_NAME ?? "Jan",
  lastName: process.env.E2E_BUYER_LAST_NAME ?? "Testowy",
  email: process.env.E2E_BUYER_EMAIL ?? "e2e-buyer@test.bonbeauty.pl",
  phone: process.env.E2E_BUYER_PHONE ?? "+48100000002",
  address: {
    line1: "ul. Testowa 1",
    city: "Warszawa",
    postalCode: "00-001",
    country: "PL",
  },
}

/**
 * Stripe test card for mock payment in staging.
 * These are Stripe's published test-only values (NOT real credentials).
 * @see https://stripe.com/docs/testing#cards
 */
export const TEST_STRIPE_CARD = {
  // Stripe published test card — not a real card number
  number: "4242424242424242",
  expiry: "12/26",
  cvc: "123",
}

/**
 * Backend and storefront URLs.
 */
export const BACKEND_BASE = process.env.BACKEND_BASE_URL ?? "http://localhost:9002"
export const STOREFRONT_BASE = process.env.STOREFRONT_BASE_URL ?? "http://localhost:8000"

/**
 * Page paths (locale-aware).
 */
export function paths(locale = LOCALE) {
  return {
    home: `/${locale}`,
    sellers: `/${locale}/sellers`,
    category: (handle: string) => `/${locale}/categories/${handle}`,
    product: (handle: string) => `/${locale}/products/${handle}`,
    cart: `/${locale}/cart`,
    checkout: `/${locale}/checkout`,
    order: (orderId: string) => `/${locale}/order/${orderId}/confirmed`,
    voucher: (claimToken: string) => `/${locale}/voucher/${claimToken}`,
  }
}
