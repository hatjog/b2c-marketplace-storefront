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
});
