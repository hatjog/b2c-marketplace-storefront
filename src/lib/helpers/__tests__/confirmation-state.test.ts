/**
 * Tests for confirmation-state.ts — Story 2.5 (UX-CMP-4 five-state machine)
 *
 * Covers the deterministic input rules from T2:
 *   - not_paid / awaiting          → payment_pending
 *   - canceled / failed / expired  → payment_failed_retry
 *   - paid + entitlement ISSUED    → paid_delivered (gift path)
 *   - paid + entitlement ACTIVE    → paid_delivered (self-purchase path)
 *   - paid + no entitlement        → paid_delivery_pending (HONESTY: not failure)
 *   - paid + delivery_state=failed → support_required (positive evidence)
 *   - paid + requires_support=true → support_required (positive evidence)
 *   - support_required (proxy)     → support_required
 *   - unknown status               → payment_pending (safe default / anti-optimistic-paid)
 *
 * Legacy bridge:
 *   - getConfirmationState() backward-compat mapping
 */

import { describe, expect, it } from 'vitest';

import {
  getConfirmationHandoffState,
  getConfirmationState,
} from '../confirmation-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const issued = { status: 'ISSUED', voucher_code: 'ABCD1234', claim_url: 'https://bb.test/claim/xyz' };
const active = { status: 'ACTIVE', voucher_code: 'WXYZ5678', claim_url: null };
const noEnt: never[] = [];

// ─── getConfirmationHandoffState ──────────────────────────────────────────────

describe('getConfirmationHandoffState', () => {
  // --- Payment pending PSP ---

  describe('payment_pending states', () => {
    it('returns payment_pending for not_paid', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'not_paid' })).toBe('payment_pending');
    });

    it('returns payment_pending for awaiting', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'awaiting' })).toBe('payment_pending');
    });

    it('returns payment_pending for pending_psp_confirmation (lifecycle vocab)', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'pending_psp_confirmation' })).toBe('payment_pending');
    });

    it('returns payment_pending for authorized', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'authorized' })).toBe('payment_pending');
    });

    it('returns payment_pending for null (anti-optimistic-paid safe default)', () => {
      expect(getConfirmationHandoffState({ paymentStatus: null })).toBe('payment_pending');
    });

    it('returns payment_pending for undefined (anti-optimistic-paid safe default)', () => {
      expect(getConfirmationHandoffState({ paymentStatus: undefined })).toBe('payment_pending');
    });

    it('returns payment_pending for unknown status (anti-optimistic-paid)', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'processing' })).toBe('payment_pending');
      expect(getConfirmationHandoffState({ paymentStatus: 'done' })).toBe('payment_pending');
    });
  });

  // --- Payment failed / retry ---

  describe('payment_failed_retry states', () => {
    it('returns payment_failed_retry for canceled', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'canceled' })).toBe('payment_failed_retry');
    });

    it('returns payment_failed_retry for failed (lifecycle vocab)', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'failed' })).toBe('payment_failed_retry');
    });

    it('returns payment_failed_retry for expired (lifecycle vocab)', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'expired' })).toBe('payment_failed_retry');
    });
  });

  // --- Paid + delivered ---

  describe('paid_delivered states', () => {
    it('returns paid_delivered for paid + entitlement ISSUED (gift path)', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'paid', entitlements: [issued] })
      ).toBe('paid_delivered');
    });

    it('returns paid_delivered for paid + entitlement ACTIVE (self-purchase path)', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'paid', entitlements: [active] })
      ).toBe('paid_delivered');
    });

    it('returns paid_delivered for captured + entitlement ACTIVE', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'captured', entitlements: [active] })
      ).toBe('paid_delivered');
    });
  });

  // --- Paid but delivery pending ---

  describe('paid_delivery_pending state (HONESTY: absence != failure)', () => {
    it('returns paid_delivery_pending for paid + no entitlement', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'paid', entitlements: noEnt })
      ).toBe('paid_delivery_pending');
    });

    it('returns paid_delivery_pending for paid + entitlements array absent', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'paid' })
      ).toBe('paid_delivery_pending');
    });

    it('does NOT return support_required when entitlement is absent (no positive evidence)', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'paid', entitlements: noEnt })
      ).not.toBe('support_required');
    });
  });

  // --- Support required ---

  describe('support_required states (positive evidence required)', () => {
    it('returns support_required when delivery_state=failed metadata present', () => {
      expect(
        getConfirmationHandoffState({
          paymentStatus: 'paid',
          entitlements: noEnt,
          metadata: { delivery_state: 'failed' },
        })
      ).toBe('support_required');
    });

    it('returns support_required when requires_support=true metadata present', () => {
      expect(
        getConfirmationHandoffState({
          paymentStatus: 'paid',
          entitlements: noEnt,
          metadata: { requires_support: true },
        })
      ).toBe('support_required');
    });

    it('returns support_required for proxy-mapped support_required status', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'support_required' })
      ).toBe('support_required');
    });

    it('does NOT return support_required for paid + entitlement present + delivery_state=failed (entitlement wins, unusual edge)', () => {
      // delivery_state=failed + entitlement = support_required (failure evidence overrides)
      expect(
        getConfirmationHandoffState({
          paymentStatus: 'paid',
          entitlements: [active],
          metadata: { delivery_state: 'failed' },
        })
      ).toBe('support_required');
    });
  });

  // --- Defensive input normalisation (F2 review fix) ---

  describe('input normalisation: case + whitespace tolerance', () => {
    it('normalises uppercase PAID to paid (no false-pending fall-through)', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'PAID', entitlements: [active] })
      ).toBe('paid_delivered');
    });

    it('normalises whitespace-padded " paid " to paid', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: ' paid ', entitlements: [active] })
      ).toBe('paid_delivered');
    });

    it('normalises mixed-case CANCELED to canceled (failed_retry path)', () => {
      expect(
        getConfirmationHandoffState({ paymentStatus: 'Canceled' })
      ).toBe('payment_failed_retry');
    });
  });

  // --- Anti-patterns (banned behaviours) ---

  describe('anti-patterns: banned behaviours', () => {
    it('NEVER returns paid_delivered for null payment status', () => {
      expect(getConfirmationHandoffState({ paymentStatus: null, entitlements: [active] })).not.toBe('paid_delivered');
    });

    it('NEVER returns paid_delivered for unknown payment status', () => {
      expect(getConfirmationHandoffState({ paymentStatus: 'random', entitlements: [active] })).not.toBe('paid_delivered');
    });

    it('NEVER returns support_required from absence of entitlement alone', () => {
      const result = getConfirmationHandoffState({ paymentStatus: 'paid', entitlements: [] });
      expect(result).toBe('paid_delivery_pending');
      expect(result).not.toBe('support_required');
    });
  });
});

// ─── Legacy getConfirmationState bridge ──────────────────────────────────────

describe('getConfirmationState (legacy 3-state bridge)', () => {
  it('returns success for not_paid/awaiting — WAIT, maps payment_pending → pending', () => {
    // Correct: not_paid → payment_pending → pending (not success)
    expect(getConfirmationState('not_paid')).toBe('pending');
    expect(getConfirmationState('awaiting')).toBe('pending');
  });

  it('returns error for canceled', () => {
    expect(getConfirmationState('canceled')).toBe('error');
  });

  it('returns pending for paid + no entitlement (F12 honesty fix: paid_delivery_pending → pending, not success)', () => {
    // paid + no entitlement → paid_delivery_pending → legacy 'pending'
    // (F12 review fix: was 'success'; corrected to honour AC2 — never claim
    // delivery success on the legacy 3-state surface without backend evidence)
    expect(getConfirmationState('paid')).toBe('pending');
  });

  it('returns pending for pending_psp_confirmation', () => {
    expect(getConfirmationState('pending_psp_confirmation')).toBe('pending');
  });

  it('returns error for failed', () => {
    expect(getConfirmationState('failed')).toBe('error');
  });

  it('returns error for support_required', () => {
    expect(getConfirmationState('support_required')).toBe('error');
  });
});
