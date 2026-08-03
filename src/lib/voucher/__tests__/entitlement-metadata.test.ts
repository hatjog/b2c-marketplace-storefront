/**
 * v1.8.0 Story 1.10.1 — `buildEntitlementLineItemMetadata` contract test
 * (storefront-side write per Q1 architectural default).
 *
 * The backend `resolveEntitlementProfile()` at
 * `GP/backend/packages/api/src/workflows/entitlements/issue-entitlement.ts:118-166`
 * has two acceptance branches:
 *
 *   1. Embedded form short-circuit (lines 123-128): metadata.entitlement_profile
 *      = { profile_id, entitlement_type, policy } satisfies the resolver
 *      WITHOUT an order_item DB scan.
 *   2. Destructured triad: metadata.entitlement_profile_id +
 *      metadata.entitlement_type + metadata.entitlement_policy.
 *
 * This helper emits BOTH forms so a future consumer that reads only the
 * triad (analytics, vendor dashboard, etc.) also sees the keys. The embedded
 * form is the resolver fast-path.
 */

import type { HttpTypes } from '@medusajs/types';
import { describe, expect, it } from 'vitest';

import { buildEntitlementLineItemMetadata } from '../entitlement-metadata';

function makeProductWithEntitlement(): HttpTypes.StoreProduct {
  return {
    id: 'prod_test_001',
    metadata: {
      gp: {
        market_id: 'bonbeauty',
        synced_by: 'gp-config-sync-catalog',
        fixture_id: 'srv_0101',
        entitlement_profile: {
          profile_id: 'voucher-kwotowy-365d',
          entitlement_type: 'VOUCHER_AMOUNT',
          policy: {
            validity_months: 12,
            extension: { allowed: true, paid: true, fee_pct: 10 }
          },
          currency: 'PLN'
        }
      }
    }
  } as unknown as HttpTypes.StoreProduct;
}

describe('buildEntitlementLineItemMetadata (Story 1.10.1)', () => {
  it('returns undefined when product is null/undefined', () => {
    expect(buildEntitlementLineItemMetadata(null)).toBeUndefined();
    expect(buildEntitlementLineItemMetadata(undefined)).toBeUndefined();
  });

  it('returns undefined when product has no metadata.gp', () => {
    const product = { id: 'p', metadata: {} } as unknown as HttpTypes.StoreProduct;
    expect(buildEntitlementLineItemMetadata(product)).toBeUndefined();
  });

  it('returns undefined when metadata.gp has no entitlement_profile (non-voucher SKU, legacy flow)', () => {
    const product = {
      id: 'p',
      metadata: { gp: { market_id: 'bonbeauty' } }
    } as unknown as HttpTypes.StoreProduct;
    expect(buildEntitlementLineItemMetadata(product)).toBeUndefined();
  });

  it('returns undefined when entitlement_profile lacks profile_id (malformed catalog sync)', () => {
    const product = {
      id: 'p',
      metadata: {
        gp: {
          entitlement_profile: {
            entitlement_type: 'VOUCHER_AMOUNT',
            policy: { validity_months: 12 }
          }
        }
      }
    } as unknown as HttpTypes.StoreProduct;
    expect(buildEntitlementLineItemMetadata(product)).toBeUndefined();
  });

  it('emits the embedded form + the destructured triad for a voucher-bearing product', () => {
    const product = makeProductWithEntitlement();
    const meta = buildEntitlementLineItemMetadata(product, 18000);
    expect(meta).toBeDefined();
    // Embedded form (the backend resolver fast-path at issue-entitlement.ts:123-128).
    expect(meta?.entitlement_profile).toMatchObject({
      profile_id: 'voucher-kwotowy-365d',
      entitlement_type: 'VOUCHER_AMOUNT',
      policy: { validity_months: 12 },
      currency: 'PLN',
      amount_minor: 18000
    });
    // Destructured triad (analytics / vendor dashboards read these directly).
    expect(meta?.entitlement_profile_id).toBe('voucher-kwotowy-365d');
    expect(meta?.entitlement_type).toBe('VOUCHER_AMOUNT');
    expect(meta?.entitlement_policy).toMatchObject({ validity_months: 12 });
    expect(meta?.currency).toBe('PLN');
    expect(meta?.amount_minor).toBe(18000);
  });

  it('omits amount_minor when no override + no profile-side default', () => {
    const product = {
      id: 'p',
      metadata: {
        gp: {
          entitlement_profile: {
            profile_id: 'voucher-sezonowy',
            entitlement_type: 'VOUCHER_AMOUNT',
            policy: { validity_months: 6 }
          }
        }
      }
    } as unknown as HttpTypes.StoreProduct;
    const meta = buildEntitlementLineItemMetadata(product, null);
    expect(meta?.amount_minor).toBeUndefined();
    expect(meta?.entitlement_profile.amount_minor).toBeUndefined();
  });

  it('passes the runtime amount through (Story 1.10 C1: 18000 grosze for 180.00 PLN)', () => {
    const product = makeProductWithEntitlement();
    const meta = buildEntitlementLineItemMetadata(product, 18000);
    expect(meta?.amount_minor).toBe(18000);
    expect(meta?.entitlement_profile.amount_minor).toBe(18000);
  });
});
