/**
 * GiftRecipientForm — unit tests covering AC1/AC2/AC3 (Story 5.3) plus the
 * A-minimal send-timing narrowing from Story 2.4 (v1.14.0, FR-15a).
 *
 * Tests are kept in node environment (no jsdom required) because they exercise
 * the form logic layer: validation, char-counter bounds, RODO field scope, and
 * the binding-ready contract — all verifiable via the pure helper functions
 * imported by GiftRecipientForm without mounting a DOM.
 *
 * The i18n assertions read `messages/*.json` directly: the narrowing is a COPY
 * change across four locales, so „does the string exist in every locale" is
 * exactly the regression that would otherwise ship unnoticed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildGiftRecipientIssueMetadata,
  GIFT_RECIPIENT_MESSAGE_MAX,
  isGiftRecipientFormValid,
  toEditableSendTiming,
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
    sendTiming: 'now'
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
    sendTiming: 'now'
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
    const long = 'y'.repeat(200);
    const payload = buildGiftRecipientIssueMetadata({ ...baseForm, message: long });
    expect(payload.gift_recipient_message.length).toBeLessThanOrEqual(GIFT_RECIPIENT_MESSAGE_MAX);
  });
});

// ---------------------------------------------------------------------------
// Story 2.4 / FR-15a — send-timing narrowed to two honest options
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — FR-15a: send-timing A-minimal', () => {
  const baseForm: GiftRecipientFormData = {
    recipientEmail: 'r@example.com',
    message: 'Hi',
    sendTiming: 'now'
  };

  it('both variants are valid — "hand over in person" is a real choice, not a blocked one', () => {
    expect(isGiftRecipientFormValid({ ...baseForm, sendTiming: 'now' })).toBe(true);
    expect(isGiftRecipientFormValid({ ...baseForm, sendTiming: 'handover' })).toBe(true);
  });

  it('no send-date validation remains on the buyer path', () => {
    // Pole daty zniknęło ze ścieżki kupującej razem z walidacją; jedyne możliwe
    // błędy to adres i wiadomość.
    const errors = validateGiftRecipientForm({ ...baseForm, sendTiming: 'handover' });
    expect(Object.keys(errors)).toEqual([]);
    expect('sendDate' in errors).toBe(false);
  });

  it('the persisted payload never carries a date in v1.14.0', () => {
    expect(
      buildGiftRecipientIssueMetadata({ ...baseForm, sendTiming: 'now' })
        .gift_recipient_send_date
    ).toBeNull();
  });

  it('a legacy cart (`scheduled`) opens as "hand over in person", not "send now"', () => {
    expect(toEditableSendTiming('scheduled')).toBe('handover');
  });
});

// ---------------------------------------------------------------------------
// Story 2.4 — i18n parity: new copy exists in all four locales, old keys gone
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — FR-14/FR-15a: i18n parity across 4 locales', () => {
  const LOCALES = ['pl', 'en', 'ua', 'de'] as const;
  const NEW_KEYS = [
    'send_timing_label',
    'send_timing_now',
    'send_timing_handover',
    'send_timing_now_hint',
    'send_timing_handover_hint'
  ] as const;
  const REMOVED_KEYS = [
    'send_date_label',
    'send_now',
    'send_scheduled',
    'scheduled_date_label',
    'send_date_error'
  ] as const;

  const blockFor = (locale: string): Record<string, string> => {
    const raw = readFileSync(
      resolve(process.cwd(), `messages/${locale}.json`),
      'utf8'
    );
    return JSON.parse(raw).seller.checkout.gift_recipient;
  };

  it.each(LOCALES)('%s has every new send-timing string, non-empty', locale => {
    const block = blockFor(locale);
    for (const key of NEW_KEYS) {
      expect(typeof block[key]).toBe('string');
      expect(block[key].trim().length).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)('%s no longer carries the scheduling keys (no orphans)', locale => {
    const block = blockFor(locale);
    for (const key of REMOVED_KEYS) {
      expect(block[key]).toBeUndefined();
    }
  });

  it('all four locales expose exactly the same key set (parity)', () => {
    const keySets = LOCALES.map(locale => Object.keys(blockFor(locale)).sort());
    for (const keys of keySets) {
      expect(keys).toEqual(keySets[0]);
    }
  });

  it('no locale promises a scheduled send — copy must not oversell v1.14.0', () => {
    // FR-15a: „copy nie obiecuje niczego, czego system nie robi".
    const forbidden = /data wysyłki|zaplanuj|schedule|дата надсилання|запланувати|versanddatum|planen/i;
    for (const locale of LOCALES) {
      expect(JSON.stringify(blockFor(locale))).not.toMatch(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 — RODO/HG-7: payload contains exactly the allowed fields
// ---------------------------------------------------------------------------
describe('GiftRecipientForm — AC3: RODO minimisation (only allowed fields in payload)', () => {
  const validForm: GiftRecipientFormData = {
    recipientEmail: 'User@Example.com',
    message: 'Prezent dla Ciebie',
    sendTiming: 'now'
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
