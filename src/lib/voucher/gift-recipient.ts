/**
 * gift-recipient.ts — kontrakt metadanych prezentu zapisywanych na
 * `line_item.metadata` (Story 2.4, FR-15/FR-15a; ADR-163 gift-flow-v1).
 *
 * ── Send-timing w wariancie A-minimal (v1.14.0) ─────────────────────────────
 * Kupująca ma DWIE realne opcje: `now` („wyślij od razu") i `handover`
 * („nie wysyłaj, przekażę osobiście"). Wysyłka z wybraną datą (`scheduled`)
 * jest deferowana do v1.15.0 — kontrakt ją ZNA (koszyki sprzed tej zmiany
 * niosą tę wartość), ale UI jej nie oferuje, a backend traktuje ją jawnie jako
 * „nie wysyłaj automatycznie". To zwężenie przez COPY, nie ukrycie kontrolki.
 */

export const GIFT_RECIPIENT_MESSAGE_MAX = 200;

/** Warianty osiągalne z UI w v1.14.0 (FR-15a). */
export type GiftRecipientSendTiming = 'now' | 'handover';

/**
 * Wartości, które mogą LEŻEĆ w metadanych: warianty UI + zastane `scheduled`
 * (koszyki utworzone przed v1.14.0). `scheduled` jest kontraktem v1.15.0 —
 * nieosiągalnym z UI i nigdy nieprodukowanym przez ten moduł.
 */
export type GiftRecipientPersistedSendTiming =
  | GiftRecipientSendTiming
  | 'scheduled';

export type GiftRecipientFormData = {
  recipientEmail: string;
  message: string;
  sendTiming: GiftRecipientSendTiming;
};

export type GiftRecipientIssueMetadata = {
  gift_recipient_email: string;
  gift_recipient_message: string;
  gift_recipient_send_timing: GiftRecipientPersistedSendTiming;
  /**
   * Wstecznie zgodne pole kontraktu. W v1.14.0 zapisywane ZAWSZE jako `null`
   * (nie ma ścieżki produkującej datę); odczytywane, żeby zastane koszyki nie
   * traciły danych i nie wywracały checkoutu.
   */
  gift_recipient_send_date: string | null;
  gift_recipient_bound_to_voucher_issue: true;
};

export type GiftRecipientValidationErrors = Partial<
  Record<'recipientEmail' | 'message', string>
>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPersistedSendTiming(
  value: unknown
): value is GiftRecipientPersistedSendTiming {
  return value === 'now' || value === 'handover' || value === 'scheduled';
}

/**
 * Sprowadza wartość z metadanych do wariantu wybieralnego w UI.
 *
 * Zastane `scheduled` mapuje się na `handover` („nie wysyłaj"), a NIE na `now`:
 * kupująca świadomie nie chciała wysyłki natychmiastowej, a mail nie w terminie
 * jest nieodwracalny. Ta sama semantyka po stronie backendu (`gift-handoff.ts`
 * → `scheduled_deferred_v1150`).
 */
export function toEditableSendTiming(
  value: unknown
): GiftRecipientSendTiming {
  if (value === 'now') return 'now';
  return 'handover';
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
    // v1.14.0 nie produkuje daty — scheduler wchodzi w v1.15.0 (ADR-163).
    gift_recipient_send_date: null,
    gift_recipient_bound_to_voucher_issue: true
  };
}

/**
 * Odczyt metadanych zastanych. Akceptuje RÓWNIEŻ `scheduled`, żeby koszyk
 * utworzony przed v1.14.0 nie wywracał checkoutu i nie tracił danych odbiorcy.
 */
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
    !isPersistedSendTiming(sendTiming) ||
    metadata.gift_recipient_bound_to_voucher_issue !== true
  ) {
    return null;
  }

  const data: GiftRecipientFormData = {
    recipientEmail,
    message,
    sendTiming: toEditableSendTiming(sendTiming)
  };

  return isGiftRecipientFormValid(data)
    ? {
        gift_recipient_email: recipientEmail,
        gift_recipient_message: message,
        gift_recipient_send_timing: sendTiming,
        gift_recipient_send_date:
          sendTiming === 'scheduled' && typeof sendDate === 'string'
            ? sendDate
            : null,
        gift_recipient_bound_to_voucher_issue: true
      }
    : null;
}
