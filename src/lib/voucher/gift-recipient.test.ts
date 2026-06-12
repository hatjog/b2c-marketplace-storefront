import { describe, expect, it } from 'vitest';

import {
  buildGiftRecipientIssueMetadata,
  GIFT_RECIPIENT_MESSAGE_MAX,
  isGiftRecipientFormValid,
  readGiftRecipientIssueMetadata,
  validateGiftRecipientForm,
  type GiftRecipientFormData
} from './gift-recipient';

const validForm: GiftRecipientFormData = {
  recipientEmail: 'Anna.Recipient@Example.com ',
  message: 'Miłego dnia w BonBeauty',
  sendTiming: 'scheduled',
  sendDate: '2026-06-20'
};

describe('gift recipient voucher issue binding', () => {
  it('builds a minimal voucher-issue metadata payload from the three allowed fields', () => {
    expect(buildGiftRecipientIssueMetadata(validForm)).toEqual({
      gift_recipient_email: 'anna.recipient@example.com',
      gift_recipient_message: 'Miłego dnia w BonBeauty',
      gift_recipient_send_timing: 'scheduled',
      gift_recipient_send_date: '2026-06-20',
      gift_recipient_bound_to_voucher_issue: true
    });
  });

  it('validates recipient email, hard message limit and scheduled send date', () => {
    const tooLong = 'x'.repeat(GIFT_RECIPIENT_MESSAGE_MAX + 1);
    const errors = validateGiftRecipientForm({
      recipientEmail: 'bad-email',
      message: tooLong,
      sendTiming: 'scheduled',
      sendDate: null
    });

    expect(errors).toEqual({
      recipientEmail: 'invalid',
      message: 'invalid',
      sendDate: 'invalid'
    });
  });

  it('accepts send-now without collecting a redundant date', () => {
    const payload = buildGiftRecipientIssueMetadata({
      ...validForm,
      sendTiming: 'now',
      sendDate: null
    });

    expect(payload.gift_recipient_send_date).toBeNull();
    expect(isGiftRecipientFormValid({ ...validForm, sendTiming: 'now', sendDate: null })).toBe(
      true
    );
  });

  it('reads only a complete payload as bound to voucher issue', () => {
    const metadata = buildGiftRecipientIssueMetadata(validForm);

    expect(readGiftRecipientIssueMetadata(metadata)).toEqual(metadata);
    expect(
      readGiftRecipientIssueMetadata({
        ...metadata,
        gift_recipient_bound_to_voucher_issue: false
      })
    ).toBeNull();
  });
});
