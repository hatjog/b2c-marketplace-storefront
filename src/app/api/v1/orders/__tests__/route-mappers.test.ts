/**
 * Tests for the /api/v1/orders/[id] proxy mappers.
 *
 * R10 review fix (second pass): the proxy boundary — not the client-side
 * adapter — is now the authoritative status mapper. The client adapter's
 * safe-default is defense-in-depth; the proxy mapper is the surface that
 * actually runs in production. This test covers every Medusa enum member
 * the proxy may receive, plus the R3 fix (requires_action → failed) and
 * the R4 order-level expired override.
 */

import { describe, expect, it } from 'vitest';

import {
  isGuestCheckout,
  mapMedusaOrderStatusToLifecycle,
  mapMedusaPaymentStatusToLifecycle,
} from '../[id]/lifecycle-mappers';

describe('mapMedusaPaymentStatusToLifecycle', () => {
  it('maps captured → paid', () => {
    expect(mapMedusaPaymentStatusToLifecycle('captured')).toBe('paid');
  });

  it('maps partially_captured → paid', () => {
    expect(mapMedusaPaymentStatusToLifecycle('partially_captured')).toBe('paid');
  });

  it('maps not_paid → pending_psp_confirmation', () => {
    expect(mapMedusaPaymentStatusToLifecycle('not_paid')).toBe('pending_psp_confirmation');
  });

  it('maps awaiting → pending_psp_confirmation', () => {
    expect(mapMedusaPaymentStatusToLifecycle('awaiting')).toBe('pending_psp_confirmation');
  });

  it('maps authorized → pending_psp_confirmation', () => {
    expect(mapMedusaPaymentStatusToLifecycle('authorized')).toBe('pending_psp_confirmation');
  });

  it('maps partially_authorized → pending_psp_confirmation', () => {
    expect(mapMedusaPaymentStatusToLifecycle('partially_authorized')).toBe('pending_psp_confirmation');
  });

  it('R3: maps requires_action → failed (NOT pending — SCA / 3DS needs retry, not wait)', () => {
    expect(mapMedusaPaymentStatusToLifecycle('requires_action')).toBe('failed');
  });

  it('maps canceled → expired', () => {
    expect(mapMedusaPaymentStatusToLifecycle('canceled')).toBe('expired');
  });

  it('maps refunded → support_required', () => {
    expect(mapMedusaPaymentStatusToLifecycle('refunded')).toBe('support_required');
  });

  it('maps partially_refunded → support_required', () => {
    expect(mapMedusaPaymentStatusToLifecycle('partially_refunded')).toBe('support_required');
  });

  it('maps unknown to pending_psp_confirmation (anti-optimistic-paid)', () => {
    expect(mapMedusaPaymentStatusToLifecycle('random_garbage')).toBe('pending_psp_confirmation');
  });

  it('maps null to pending_psp_confirmation', () => {
    expect(mapMedusaPaymentStatusToLifecycle(null)).toBe('pending_psp_confirmation');
  });

  it('maps undefined to pending_psp_confirmation', () => {
    expect(mapMedusaPaymentStatusToLifecycle(undefined)).toBe('pending_psp_confirmation');
  });

  it('NEVER returns paid for unknown / null / empty input (anti-optimistic-paid)', () => {
    const unknownInputs: Array<string | null | undefined> = [
      null,
      undefined,
      '',
      'processing',
      'held',
      'done',
      'random',
    ];
    for (const input of unknownInputs) {
      expect(mapMedusaPaymentStatusToLifecycle(input)).not.toBe('paid');
    }
  });
});

describe('mapMedusaOrderStatusToLifecycle', () => {
  it('R4: maps archived → expired (order TTL elapsed)', () => {
    expect(mapMedusaOrderStatusToLifecycle('archived')).toBe('expired');
  });

  it('R4: maps canceled (order-level) → expired', () => {
    expect(mapMedusaOrderStatusToLifecycle('canceled')).toBe('expired');
  });

  it('returns null for non-override states (let payment_status drive)', () => {
    expect(mapMedusaOrderStatusToLifecycle('pending')).toBeNull();
    expect(mapMedusaOrderStatusToLifecycle('completed')).toBeNull();
    expect(mapMedusaOrderStatusToLifecycle(null)).toBeNull();
    expect(mapMedusaOrderStatusToLifecycle(undefined)).toBeNull();
  });
});

describe('isGuestCheckout', () => {
  it('returns true when customer_id is null/undefined/empty', () => {
    expect(isGuestCheckout(null)).toBe(true);
    expect(isGuestCheckout(undefined)).toBe(true);
    expect(isGuestCheckout('')).toBe(true);
  });

  it('returns false when customer_id is present', () => {
    expect(isGuestCheckout('cus_123')).toBe(false);
  });
});
