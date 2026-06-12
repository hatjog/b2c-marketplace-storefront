export const GIFT_RECIPIENT_MESSAGE_MAX = 200;

export type GiftRecipientSendTiming = 'now' | 'scheduled';

export type GiftRecipientFormData = {
  recipientEmail: string;
  message: string;
  sendTiming: GiftRecipientSendTiming;
  sendDate: string | null;
};

export type GiftRecipientIssueMetadata = {
  gift_recipient_email: string;
  gift_recipient_message: string;
  gift_recipient_send_timing: GiftRecipientSendTiming;
  gift_recipient_send_date: string | null;
  gift_recipient_bound_to_voucher_issue: true;
};

export type GiftRecipientValidationErrors = Partial<
  Record<'recipientEmail' | 'message' | 'sendDate', string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateGiftRecipientForm(
  data: GiftRecipientFormData
): GiftRecipientValidationErrors {
  const errors: GiftRecipientValidationErrors = {};
  const email = data.recipientEmail.trim();
  const message = data.message.trim();

  if (!EMAIL_RE.test(email)) {
    errors.recipientEmail = 'invalid';
  }

  if (message.length === 0 || message.length > GIFT_RECIPIENT_MESSAGE_MAX) {
    errors.message = 'invalid';
  }

  if (data.sendTiming === 'scheduled') {
    if (!data.sendDate || !DATE_RE.test(data.sendDate)) {
      errors.sendDate = 'invalid';
    }
  }

  return errors;
}

export function isGiftRecipientFormValid(data: GiftRecipientFormData): boolean {
  return Object.keys(validateGiftRecipientForm(data)).length === 0;
}

export function buildGiftRecipientIssueMetadata(
  data: GiftRecipientFormData
): GiftRecipientIssueMetadata {
  const errors = validateGiftRecipientForm(data);
  if (Object.keys(errors).length > 0) {
    throw new Error('Invalid gift recipient payload');
  }

  return {
    gift_recipient_email: data.recipientEmail.trim().toLowerCase(),
    gift_recipient_message: data.message.trim().slice(0, GIFT_RECIPIENT_MESSAGE_MAX),
    gift_recipient_send_timing: data.sendTiming,
    gift_recipient_send_date: data.sendTiming === 'scheduled' ? data.sendDate : null,
    gift_recipient_bound_to_voucher_issue: true
  };
}

export function readGiftRecipientIssueMetadata(
  metadata: Record<string, unknown> | null | undefined
): GiftRecipientIssueMetadata | null {
  if (!metadata) return null;

  const recipientEmail = metadata.gift_recipient_email;
  const message = metadata.gift_recipient_message;
  const sendTiming = metadata.gift_recipient_send_timing;
  const sendDate = metadata.gift_recipient_send_date;

  if (
    typeof recipientEmail !== 'string' ||
    typeof message !== 'string' ||
    (sendTiming !== 'now' && sendTiming !== 'scheduled') ||
    metadata.gift_recipient_bound_to_voucher_issue !== true
  ) {
    return null;
  }

  const data: GiftRecipientFormData = {
    recipientEmail,
    message,
    sendTiming,
    sendDate: typeof sendDate === 'string' ? sendDate : null
  };

  return isGiftRecipientFormValid(data)
    ? {
        gift_recipient_email: recipientEmail,
        gift_recipient_message: message,
        gift_recipient_send_timing: sendTiming,
        gift_recipient_send_date: data.sendTiming === 'scheduled' ? data.sendDate : null,
        gift_recipient_bound_to_voucher_issue: true
      }
    : null;
}
