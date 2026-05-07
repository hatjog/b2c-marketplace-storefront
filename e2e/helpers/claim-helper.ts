/**
 * Claim helper — Story v160-cleanup-12f (AC4)
 *
 * Provides `extractClaimToken(page)` — scrapes the recipient claim URL
 * from the order confirmation page after a multi-vendor checkout (Step 4).
 *
 * Strategy: the ConfirmationPageContent renders `[data-testid="transfer-cta"]`
 * with an `href` pointing to `/{locale}/voucher/{claimCode}` when
 * `entitlement.claim_url` is set (gift / ISSUED path). The token is the
 * last path segment of that URL.
 *
 * No external mail-bus or separate endpoint is required — the confirmation
 * page already surfaces the claim URL to the buyer in the gift path.
 *
 * Self-extraction removes the dependency on `process.env.E2E_CLAIM_TOKEN`
 * being pre-set, making Steps 5+6 self-contained after Step 4.
 *
 * @see e2e/multi-vendor-flag-on.spec.ts — Step 4 / Step 5
 */

import type { Page } from "@playwright/test"

/**
 * Extract the voucher claim token from the order confirmation page.
 *
 * The page must be the confirmation page rendered after a successful checkout.
 * Waits up to `timeoutMs` for the `[data-testid="transfer-cta"]` element to
 * appear (it is rendered by a client component after async data load).
 *
 * Returns the claim code (last URL segment) or `null` if the element is not
 * found within the timeout (deferred / non-gift path).
 */
export async function extractClaimToken(
  page: Page,
  timeoutMs = 15_000,
): Promise<string | null> {
  try {
    const ctaLocator = page.locator('[data-testid="transfer-cta"]')
    await ctaLocator.waitFor({ state: "visible", timeout: timeoutMs })

    const href = await ctaLocator.getAttribute("href")
    if (!href) return null

    // href shape: /{locale}/voucher/{claimCode}
    // The claim code is the last non-empty segment.
    const segments = href.split("/").filter(Boolean)
    const voucherIdx = segments.indexOf("voucher")
    if (voucherIdx !== -1 && voucherIdx + 1 < segments.length) {
      return segments[voucherIdx + 1]
    }

    // Fallback: last segment
    return segments[segments.length - 1] ?? null
  } catch {
    return null
  }
}
