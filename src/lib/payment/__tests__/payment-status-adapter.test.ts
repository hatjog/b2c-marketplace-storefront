/**
 * Tests for payment-status-adapter.ts — v1.7.0 Story 2.4.
 *
 * Verifies:
 *   - All canonical lifecycle state IDs are present in PAYMENT_STATUS_MAP.
 *   - No local aliases (processing, held, verifying, done, etc.) exist.
 *   - resolvePaymentStatusId safe-defaults unknown/null to pending_psp_confirmation.
 *   - getPaymentStatusDescriptor returns valid descriptor for all status IDs.
 *   - Exactly one primary action per status (FR8).
 *   - paid state never returned for unknown/empty input (anti-optimistic-paid).
 */

import { describe, expect, it } from 'vitest';

import {
  PAYMENT_STATUS_IDS,
  PAYMENT_STATUS_MAP,
  getPaymentStatusDescriptor,
  resolvePaymentStatusId,
} from '../payment-status-adapter';

describe('payment-status-adapter', () => {
  // ─── Lifecycle state ID completeness ───────────────────────────────────────

  describe('PAYMENT_STATUS_IDS', () => {
    it('contains all 5 canonical lifecycle state IDs', () => {
      const ids = [...PAYMENT_STATUS_IDS];
      expect(ids).toContain('paid');
      expect(ids).toContain('pending_psp_confirmation');
      expect(ids).toContain('failed');
      expect(ids).toContain('support_required');
      expect(ids).toContain('expired');
      expect(ids).toHaveLength(5);
    });

    it('does NOT contain local alias variants forbidden by lifecycle validator', () => {
      const ids = [...PAYMENT_STATUS_IDS];
      const forbidden = ['processing', 'held', 'verifying', 'done', 'pending', 'confirmed', 'cancelled'];
      for (const alias of forbidden) {
        expect(ids).not.toContain(alias);
      }
    });
  });

  // ─── PAYMENT_STATUS_MAP completeness ──────────────────────────────────────

  describe('PAYMENT_STATUS_MAP', () => {
    it('has a descriptor for every canonical status ID', () => {
      for (const id of PAYMENT_STATUS_IDS) {
        expect(PAYMENT_STATUS_MAP[id]).toBeDefined();
        expect(PAYMENT_STATUS_MAP[id].statusId).toBe(id);
      }
    });

    it('each descriptor has exactly one primary action (FR8)', () => {
      for (const id of PAYMENT_STATUS_IDS) {
        const descriptor = PAYMENT_STATUS_MAP[id];
        expect(descriptor.primaryAction).toBeDefined();
        expect(descriptor.primaryAction.kind).toBeTruthy();
        expect(descriptor.primaryAction.ctaLabelKey).toBeTruthy();
      }
    });

    it('maps paid → continue (handoff to Story 2.5)', () => {
      expect(PAYMENT_STATUS_MAP.paid.primaryAction.kind).toBe('continue');
    });

    it('maps pending_psp_confirmation → refresh (read, not mutation)', () => {
      expect(PAYMENT_STATUS_MAP.pending_psp_confirmation.primaryAction.kind).toBe('refresh');
    });

    it('maps failed → retry (explicit mutation)', () => {
      expect(PAYMENT_STATUS_MAP.failed.primaryAction.kind).toBe('retry');
    });

    it('maps support_required → contact_support', () => {
      expect(PAYMENT_STATUS_MAP.support_required.primaryAction.kind).toBe('contact_support');
    });

    it('maps expired → abandon', () => {
      expect(PAYMENT_STATUS_MAP.expired.primaryAction.kind).toBe('abandon');
    });

    it('all label keys follow payment_status.* namespace convention', () => {
      for (const id of PAYMENT_STATUS_IDS) {
        const d = PAYMENT_STATUS_MAP[id];
        expect(d.labelKey).toMatch(/^payment_status\./);
        expect(d.bodyKey).toMatch(/^payment_status\./);
        expect(d.primaryAction.ctaLabelKey).toMatch(/^payment_status\./);
      }
    });
  });

  // ─── resolvePaymentStatusId ────────────────────────────────────────────────

  describe('resolvePaymentStatusId', () => {
    it('returns exact match for all canonical status IDs', () => {
      for (const id of PAYMENT_STATUS_IDS) {
        expect(resolvePaymentStatusId(id)).toBe(id);
      }
    });

    it('returns pending_psp_confirmation for null (anti-optimistic-paid)', () => {
      expect(resolvePaymentStatusId(null)).toBe('pending_psp_confirmation');
    });

    it('returns pending_psp_confirmation for undefined', () => {
      expect(resolvePaymentStatusId(undefined)).toBe('pending_psp_confirmation');
    });

    it('returns pending_psp_confirmation for empty string', () => {
      expect(resolvePaymentStatusId('')).toBe('pending_psp_confirmation');
    });

    it('returns pending_psp_confirmation for unknown local alias (anti-pattern guard)', () => {
      const forbidden = ['processing', 'held', 'verifying', 'done', 'confirmed', 'cancelled'];
      for (const alias of forbidden) {
        expect(resolvePaymentStatusId(alias)).toBe('pending_psp_confirmation');
      }
    });

    it('NEVER returns paid for unknown/null/undefined input (anti-optimistic-paid)', () => {
      const unknownInputs = [null, undefined, '', 'processing', 'held', 'done', 'random'];
      for (const input of unknownInputs) {
        expect(resolvePaymentStatusId(input)).not.toBe('paid');
      }
    });
  });

  // ─── getPaymentStatusDescriptor ───────────────────────────────────────────

  describe('getPaymentStatusDescriptor', () => {
    it('returns valid descriptor for all canonical status IDs', () => {
      for (const id of PAYMENT_STATUS_IDS) {
        const d = getPaymentStatusDescriptor(id);
        expect(d).toBeDefined();
        expect(d.statusId).toBe(id);
        expect(d.primaryAction).toBeDefined();
      }
    });

    it('always returns a valid descriptor (never undefined)', () => {
      // Even for edge case IDs (impossible in TS but defensive)
      const d = getPaymentStatusDescriptor('paid');
      expect(d).not.toBeNull();
      expect(d).not.toBeUndefined();
    });
  });

  // ─── Story 6.1: pending → paid transition path (AC 1 / AC 3) ─────────────
  // Tests the adapter behaviour across the >2 min webhook delay scenario:
  //   1. pending_psp_confirmation status renders "refresh" recovery path.
  //   2. When polling resolves to "paid", adapter switches to "continue" path.
  //   3. The transition uses only canonical lifecycle IDs (no local aliases).

  describe('Story 6.1 — pending → paid transition coverage', () => {
    it('pending_psp_confirmation has refresh recovery path (wait recovery action)', () => {
      const d = PAYMENT_STATUS_MAP.pending_psp_confirmation;
      expect(d.primaryAction.kind).toBe('refresh');
    });

    it('pending_psp_confirmation has secondary CTA (contact support link)', () => {
      expect(PAYMENT_STATUS_MAP.pending_psp_confirmation.secondaryActionKey).toBeTruthy();
    });

    it('resolving pending → paid uses canonical "paid" id (anti-optimistic-paid guard)', () => {
      // Simulate: polling endpoint returns "paid" (previously pending).
      // The adapter must recognise it as canonical (not an alias).
      expect(resolvePaymentStatusId('paid')).toBe('paid');
      expect(PAYMENT_STATUS_MAP.paid.primaryAction.kind).toBe('continue');
    });

    it('resolving pending → failed uses canonical "failed" id', () => {
      expect(resolvePaymentStatusId('failed')).toBe('failed');
      expect(PAYMENT_STATUS_MAP.failed.primaryAction.kind).toBe('retry');
    });

    it('resolving pending → support_required uses canonical id', () => {
      expect(resolvePaymentStatusId('support_required')).toBe('support_required');
      expect(PAYMENT_STATUS_MAP.support_required.primaryAction.kind).toBe('contact_support');
    });

    it('expired maps to failed recovery path (abandon CTA) per Dev Notes', () => {
      expect(resolvePaymentStatusId('expired')).toBe('expired');
      expect(PAYMENT_STATUS_MAP.expired.primaryAction.kind).toBe('abandon');
    });

    it('all pending_psp_confirmation keys use payment_status.* namespace (no PL-only inline)', () => {
      const d = PAYMENT_STATUS_MAP.pending_psp_confirmation;
      expect(d.labelKey).toMatch(/^payment_status\./);
      expect(d.bodyKey).toMatch(/^payment_status\./);
      expect(d.primaryAction.ctaLabelKey).toMatch(/^payment_status\./);
      if (d.secondaryActionKey) {
        expect(d.secondaryActionKey).toMatch(/^payment_status\./);
      }
    });
  });

  // ─── Story 6.1: failed/expired → support path (AC 2) ────────────────────

  describe('Story 6.1 — failed/expired recovery path discipline', () => {
    it('failed state has exactly one primary action (retry)', () => {
      const d = PAYMENT_STATUS_MAP.failed;
      expect(d.primaryAction.kind).toBe('retry');
      // Only primaryAction, no competing action object.
      expect(Object.keys(d)).toContain('primaryAction');
    });

    it('support_required has no secondaryActionKey (contact_support IS the primary)', () => {
      // No competing secondary CTA on support_required state.
      expect(PAYMENT_STATUS_MAP.support_required.secondaryActionKey).toBeUndefined();
    });

    it('expired secondaryActionKey is contact support (safe handoff)', () => {
      const secondary = PAYMENT_STATUS_MAP.expired.secondaryActionKey;
      expect(secondary).toBeTruthy();
      expect(secondary).toMatch(/^payment_status\./);
    });

    it('no raw Stripe error keys exist in any descriptor (raw error redaction guard)', () => {
      // All descriptors must only carry i18n key paths, never raw error text.
      for (const id of PAYMENT_STATUS_IDS) {
        const d = PAYMENT_STATUS_MAP[id];
        const allKeyValues = [
          d.labelKey,
          d.bodyKey,
          d.primaryAction.ctaLabelKey,
          d.secondaryActionKey,
        ].filter(Boolean);
        for (const keyVal of allKeyValues) {
          // Keys must be i18n paths (payment_status.*), not raw strings.
          expect(keyVal).toMatch(/^payment_status\./);
          // Must NOT look like a Stripe error message or decline code.
          expect(keyVal).not.toMatch(/decline_code|error\.message|insufficient_funds/i);
        }
      }
    });
  });
});
