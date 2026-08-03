/**
 * v1.8.0 Story 1.10.1 — catalog → checkout entitlement_profile propagation
 * bridge (storefront-side write per Q1 architectural default; investigation
 * finding `_bmad-output/releases/v1.8.0/planning-artifacts/
 * 1-10-1-investigation-finding-2026-05-23.md`).
 *
 * Backend `gp-config-sync-catalog.ts` writes the per-product profile triad to
 * `product.metadata.gp.entitlement_profile` (embedded form `{ profile_id,
 * entitlement_type, policy }`) sourced from the market.yaml
 * `entitlement_profiles[]` section + the (new) `products[].entitlement_profile_id`
 * cross-ref. This helper reads that embedded form and produces a line_item
 * metadata payload that the backend `resolveEntitlementProfile()` accepts
 * out of the box (GP/backend voucher issue-entitlement.ts:118-166).
 *
 * Why storefront-side (Q1 default) and not a backend cart subscriber: the
 * profile is already resolved at catalog ingest, so the cart write is a pure
 * echo of `product.metadata` — no extra fetch, no extra service. A backend
 * subscriber on `cart.line_item.created/updated` would be cleaner separation
 * (option C in the finding) but adds a hop without changing the contract;
 * defer to v1.10.0+ if the storefront-side echo proves brittle.
 *
 * The shape we write matches the embedded form that
 * `resolveEntitlementProfile()` short-circuits on (issue-entitlement.ts:123-128)
 * so the backend does NOT need to scan the order_line metadata triad branch.
 */

import type { HttpTypes } from '@medusajs/types';

/**
 * Embedded entitlement profile shape stored on `product.metadata.gp.entitlement_profile`
 * by `gp-config-sync-catalog.ts`. Mirrors the backend `EntitlementProfilePayload`
 * type so the storefront and backend cannot drift in the embedded-form branch.
 */
export interface ProductEntitlementProfile {
  profile_id: string;
  entitlement_type: string;
  policy: Record<string, unknown>;
  /** ISO-4217 (e.g. "PLN"); falls back to cart currency on backend if absent. */
  currency?: string;
  /** Per-line minor amount (e.g. 18000 for 180.00 PLN); falls back to cart amount. */
  amount_minor?: number;
}

/**
 * Line-item metadata fragment carrying the embedded entitlement_profile.
 *
 * v1.9.0 wf5 H-7 / CC-1 F-CC1-009 (ra-E2): authoritative shape contract is
 * `specs/contracts/config/schemas/entitlement-line-item-metadata.v1.schema.json`.
 * Storefront writes + backend reads MUST agree on the shape; the schema is the
 * single source of truth and is loaded by CI (validate_event_contracts.py
 * equivalent for config schemas) to enforce parity.
 *
 * Backend `resolveEntitlementProfile()` reads either:
 *   - the embedded `metadata.entitlement_profile` (short-circuit, recommended);
 *   - or the destructured triad `metadata.entitlement_profile_id` /
 *     `metadata.entitlement_type` / `metadata.entitlement_policy`.
 *
 * We write BOTH so any reader that scans the triad form (e.g. analytics) also
 * sees the keys. The embedded form is the source of truth.
 */
export type EntitlementLineItemMetadata = {
  entitlement_profile: ProductEntitlementProfile;
  entitlement_profile_id: string;
  entitlement_type: string;
  entitlement_policy: Record<string, unknown>;
  currency?: string;
  amount_minor?: number;
};

/**
 * Build the entitlement metadata fragment for a cart line_item given a product
 * whose backend metadata carries `gp.entitlement_profile`. Returns `undefined`
 * when the product is not voucher-bearing (no entitlement_profile augmented
 * during catalog sync) — preserves backward-compat (non-voucher SKUs stay
 * plain, no metadata noise).
 *
 * The optional `amountMinor` arg is the unit price in minor units; the caller
 * usually has this via `getProductPrice(...).variantPrice.calculated_price_number`.
 * When absent, backend `resolveEntitlementProfile()` falls back to payload
 * `amount_minor` (the captured Stripe payment amount).
 */
export function buildEntitlementLineItemMetadata(
  product: HttpTypes.StoreProduct | null | undefined,
  amountMinor?: number | null
): EntitlementLineItemMetadata | undefined {
  const metadata = product?.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;

  const gp = (metadata as Record<string, unknown>).gp;
  if (!gp || typeof gp !== 'object') return undefined;

  const profile = (gp as Record<string, unknown>).entitlement_profile;
  if (!isProductEntitlementProfile(profile)) return undefined;

  const fragment: EntitlementLineItemMetadata = {
    entitlement_profile: {
      profile_id: profile.profile_id,
      entitlement_type: profile.entitlement_type,
      policy: profile.policy,
      ...(profile.currency ? { currency: profile.currency } : {}),
      ...(typeof amountMinor === 'number' && Number.isFinite(amountMinor)
        ? { amount_minor: amountMinor }
        : typeof profile.amount_minor === 'number'
          ? { amount_minor: profile.amount_minor }
          : {}),
    },
    entitlement_profile_id: profile.profile_id,
    entitlement_type: profile.entitlement_type,
    entitlement_policy: profile.policy,
    ...(profile.currency ? { currency: profile.currency } : {}),
    ...(typeof amountMinor === 'number' && Number.isFinite(amountMinor)
      ? { amount_minor: amountMinor }
      : typeof profile.amount_minor === 'number'
        ? { amount_minor: profile.amount_minor }
        : {}),
  };

  return fragment;
}

function isProductEntitlementProfile(
  value: unknown
): value is ProductEntitlementProfile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.profile_id === 'string' &&
    v.profile_id.trim().length > 0 &&
    typeof v.entitlement_type === 'string' &&
    v.entitlement_type.trim().length > 0 &&
    typeof v.policy === 'object' &&
    v.policy !== null &&
    !Array.isArray(v.policy)
  );
}
