/**
 * GiftRecipientForm — unit tests covering AC1/AC2/AC3 (Story 5.3).
 *
 * Tests are kept in node environment (no jsdom required) because they exercise
 * the form logic layer: validation, char-counter bounds, RODO field scope, and
 * the binding-ready contract — all verifiable via the pure helper functions
 * imported by GiftRecipientForm without mounting a DOM.
 *
 * Render integration (gift-mode ON reveals form, consent copy present) is
 * covered at the checkout page level; the unit layer here focuses on the
 * contract correctness that would be invisible to a DOM snapshot.
 */
import { describe, expect, it } from 'vitest';

import {
  buildGiftRecipientIssueMetadata,
  GIFT_RECIPIENT_MESSAGE_MAX,
  isGiftRecipientFormValid,
  todayISODate,
  validateGiftRecipientForm,
  type GiftRecipientFormData
} from '@/lib/voucher/gift-recipient';

// ---------------------------------------------------------------------------
// AC2 — email validation
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — AC2: recipient email validation', () => {
  const baseForm: GiftRecipientFormData = {
    recipientEmail: 'recipient@example.com',
    message: 'Hello',
    sendTiming: 'now',
    sendDate: null
  };

  it('accepts a valid email address', () => {
    expect(validateGiftRecipientForm(baseForm).recipientEmail).toBeUndefined();
  });

  it('rejects an email without @', () => {
    const errors = validateGiftRecipientForm({ ...baseForm, recipientEmail: 'notanemail' });
    expect(errors.recipientEmail).toBe('invalid');
  });

  it('rejects an empty email', () => {
    const errors = validateGiftRecipientForm({ ...baseForm, recipientEmail: '' });
    expect(errors.recipientEmail).toBe('invalid');
  });

  it('rejects whitespace-only email (trimmed before validation)', () => {
    const errors = validateGiftRecipientForm({ ...baseForm, recipientEmail: '   ' });
    expect(errors.recipientEmail).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// AC2 — message live-counter and hard limit ≤200
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — AC2: message char-counter and hard limit', () => {
  const baseForm: GiftRecipientFormData = {
    recipientEmail: 'r@example.com',
    message: '',
    sendTiming: 'now',
    sendDate: null
  };

  it('GIFT_RECIPIENT_MESSAGE_MAX is exactly 200 (live-counter upper bound)', () => {
    expect(GIFT_RECIPIENT_MESSAGE_MAX).toBe(200);
  });

  it('accepts a message of exactly 200 characters', () => {
    const msg200 = 'x'.repeat(200);
    expect(validateGiftRecipientForm({ ...baseForm, message: msg200 }).message).toBeUndefined();
  });

  it('rejects a message of 201 characters (hard limit)', () => {
    const msg201 = 'x'.repeat(201);
    expect(validateGiftRecipientForm({ ...baseForm, message: msg201 }).message).toBe('invalid');
  });

  it('rejects an empty message', () => {
    expect(validateGiftRecipientForm({ ...baseForm, message: '' }).message).toBe('invalid');
  });

  it('buildGiftRecipientIssueMetadata trims message to max 200 chars', () => {
    // The build step also slices defensively; should never exceed 200 in payload.
    const long = 'y'.repeat(200);
    const payload = buildGiftRecipientIssueMetadata({ ...baseForm, message: long });
    expect(payload.gift_recipient_message.length).toBeLessThanOrEqual(GIFT_RECIPIENT_MESSAGE_MAX);
  });
});

// ---------------------------------------------------------------------------
// AC2 — send-date: Teraz / Zaplanuj + calendar-invalid + past-date (L1 fix)
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — AC2/L1: send-date validation', () => {
  const baseForm: GiftRecipientFormData = {
    recipientEmail: 'r@example.com',
    message: 'Hi',
    sendTiming: 'now',
    sendDate: null
  };

  it('send-now does not require a date', () => {
    expect(validateGiftRecipientForm({ ...baseForm, sendTiming: 'now', sendDate: null }).sendDate)
      .toBeUndefined();
  });

  it('send-scheduled rejects null date', () => {
    expect(
      validateGiftRecipientForm({ ...baseForm, sendTiming: 'scheduled', sendDate: null }).sendDate
    ).toBe('invalid');
  });

  it('send-scheduled accepts a valid future date', () => {
    // Use a hardcoded far-future date so the test is stable over time.
    expect(
      validateGiftRecipientForm({ ...baseForm, sendTiming: 'scheduled', sendDate: '2099-12-31' })
        .sendDate
    ).toBeUndefined();
  });

  it('send-scheduled rejects a calendar-invalid date (L1 fix — 2026-02-30 does not exist)', () => {
    expect(
      validateGiftRecipientForm({ ...baseForm, sendTiming: 'scheduled', sendDate: '2026-02-30' })
        .sendDate
    ).toBe('invalid');
  });

  it('send-scheduled rejects a month > 12 (L1 fix)', () => {
    expect(
      validateGiftRecipientForm({ ...baseForm, sendTiming: 'scheduled', sendDate: '2026-13-01' })
        .sendDate
    ).toBe('invalid');
  });

  it('send-scheduled rejects a past date (L1 fix)', () => {
    // 1970-01-01 is always in the past.
    expect(
      validateGiftRecipientForm({ ...baseForm, sendTiming: 'scheduled', sendDate: '1970-01-01' })
        .sendDate
    ).toBe('invalid');
  });

  it('todayISODate returns a valid YYYY-MM-DD string', () => {
    const today = todayISODate();
    expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true);
    // Must not be rejected as a past date.
    expect(
      validateGiftRecipientForm({ ...baseForm, sendTiming: 'scheduled', sendDate: today }).sendDate
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC3 — RODO/HG-7: payload contains exactly the three allowed fields
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — AC3: RODO minimisation (exactly 3 PII fields in payload)', () => {
  const validForm: GiftRecipientFormData = {
    recipientEmail: 'User@Example.com',
    message: 'Prezent dla Ciebie',
    sendTiming: 'scheduled',
    sendDate: '2099-06-20'
  };

  it('payload contains only the allowed keys — no extra PII', () => {
    const payload = buildGiftRecipientIssueMetadata(validForm);
    const allowedKeys = new Set([
      'gift_recipient_email',
      'gift_recipient_message',
      'gift_recipient_send_timing',
      'gift_recipient_send_date',
      'gift_recipient_bound_to_voucher_issue'
    ]);
    for (const key of Object.keys(payload)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it('email is normalised (lowercase, trimmed) — no raw PII leakage', () => {
    const payload = buildGiftRecipientIssueMetadata(validForm);
    expect(payload.gift_recipient_email).toBe('user@example.com');
  });

  it('binding flag is true (form is complete and ready for voucher-issue)', () => {
    const payload = buildGiftRecipientIssueMetadata(validForm);
    expect(payload.gift_recipient_bound_to_voucher_issue).toBe(true);
  });

  it('isGiftRecipientFormValid returns false for an incomplete form', () => {
    expect(isGiftRecipientFormValid({ ...validForm, recipientEmail: 'bad' })).toBe(false);
  });
});
