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

/** Returns today's date as YYYY-MM-DD string (local time). */
export function todayISODate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Validates a YYYY-MM-DD date string. Returns 'invalid' when:
 *  - the string does not match the expected format,
 *  - the date is not a real calendar date (e.g. 2026-02-30), or
 *  - the date is in the past relative to today (local time).
 */
function validateSendDate(value: string | null): 'invalid' | undefined {
  if (!value || !DATE_RE.test(value)) return 'invalid';
  const parsed = new Date(value + 'T00:00:00');
  if (Number.isNaN(parsed.getTime())) return 'invalid';
  // Canonicalise back to YYYY-MM-DD to catch calendar-invalid dates (e.g.
  // 2026-02-30 → JS wraps to 2026-03-02, which does not equal the original).
  const canon =
    `${parsed.getFullYear()}-` +
    `${String(parsed.getMonth() + 1).padStart(2, '0')}-` +
    `${String(parsed.getDate()).padStart(2, '0')}`;
  if (canon !== value) return 'invalid';
  // Reject past dates.
  if (value < todayISODate()) return 'invalid';
  return undefined;
}

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
    const dateError = validateSendDate(data.sendDate);
    if (dateError) errors.sendDate = dateError;
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
