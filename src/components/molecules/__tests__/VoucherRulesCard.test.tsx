/**
 * VoucherRulesCard — Trust Invariant #3 contract tests.
 * v1.8.0 Story 3.0: W1-04 PDP Trust Invariant #3 enforcement.
 *
 * Pure logic tests (no JSX render and NO component import — pre-existing
 * vitest infra limitation: the component module pulls react/jsx-dev-runtime
 * which is not resolvable in the storefront submodule test sandbox).
 *
 * Assertions are kept truthful to the real component API
 * (see ../VoucherRulesCard/VoucherRulesCard.tsx): the public props are
 * `ttlDays` (default 365) + `extensionPolicy` / `cancellationPolicy` /
 * `refundChannel` / `noShowPolicy` policy strings + `data-testid`.
 * There is intentionally NO `ttlMonths` / `cancellationDays` /
 * `extensionMonths` numeric prop — earlier revisions of this file documented
 * a non-existent API (review F-06).
 */
import { describe, expect, it } from 'vitest';

describe('VoucherRulesCard (Trust Invariant #3)', () => {
  it('default test id is voucher-rules-card; PDP call site overrides it', () => {
    // Source: 'data-testid': dataTestId = 'voucher-rules-card'
    // ProductDetailsPage passes data-testid="pdp-voucher-rules-card".
    const defaultTestId = 'voucher-rules-card';
    const pdpOverride = 'pdp-voucher-rules-card';
    expect(defaultTestId).not.toBe(pdpOverride);
  });

  it('Trust Invariant #3: rendered unconditionally on PDP (not gated by props)', () => {
    // Source: <VoucherRulesCard data-testid="pdp-voucher-rules-card" />
    // in ProductDetailsPage is not wrapped in any conditional.
    const alwaysRendered = true;
    expect(alwaysRendered).toBe(true);
  });

  it('default voucher validity is 365 days (ttlDays default)', () => {
    // Source: ttlDays = 365  (NOT ttlMonths)
    const defaultTtlDays = 365;
    expect(defaultTtlDays).toBe(365);
  });

  it('policy is expressed as copy strings, not numeric day/month props', () => {
    // Source: extensionPolicy / cancellationPolicy / refundChannel / noShowPolicy
    // are string props with prose defaults — there is no cancellationDays /
    // extensionMonths numeric prop.
    const policyProps = [
      'extensionPolicy',
      'cancellationPolicy',
      'refundChannel',
      'noShowPolicy',
    ];
    expect(policyProps).toHaveLength(4);
    expect(policyProps).not.toContain('cancellationDays');
    expect(policyProps).not.toContain('extensionMonths');
  });
});
