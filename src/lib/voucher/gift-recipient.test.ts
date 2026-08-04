import { describe, expect, it } from 'vitest';

import {
  buildGiftRecipientIssueMetadata,
  GIFT_RECIPIENT_MESSAGE_MAX,
  isGiftRecipientFormValid,
  isRecipientEmailRequired,
  readGiftRecipientIssueMetadata,
  toEditableSendTiming,
  validateGiftRecipientForm,
  type GiftRecipientFormData
} from './gift-recipient';

const validForm: GiftRecipientFormData = {
  recipientEmail: 'Anna.Recipient@Example.com ',
  message: 'Miłego dnia w BonBeauty',
  sendTiming: 'now'
};

describe('gift recipient voucher issue binding', () => {
  it('builds a minimal voucher-issue metadata payload from the allowed fields', () => {
    expect(buildGiftRecipientIssueMetadata(validForm)).toEqual({
      gift_recipient_email: 'anna.recipient@example.com',
      gift_recipient_message: 'Miłego dnia w BonBeauty',
      gift_recipient_send_timing: 'now',
      gift_recipient_send_date: null,
      gift_recipient_bound_to_voucher_issue: true
    });
  });

  it('validates recipient email and the hard message limit', () => {
    const tooLong = 'x'.repeat(GIFT_RECIPIENT_MESSAGE_MAX + 1);
    const errors = validateGiftRecipientForm({
      recipientEmail: 'bad-email',
      message: tooLong,
      sendTiming: 'now'
    });

    expect(errors).toEqual({
      recipientEmail: 'invalid',
      message: 'invalid'
    });
  });

  it('never persists a send date in v1.14.0 (scheduler deferred to v1.15.0)', () => {
    const handover = buildGiftRecipientIssueMetadata({
      ...validForm,
      sendTiming: 'handover'
    });

    expect(handover.gift_recipient_send_timing).toBe('handover');
    expect(handover.gift_recipient_send_date).toBeNull();
    expect(isGiftRecipientFormValid({ ...validForm, sendTiming: 'handover' })).toBe(true);
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

  // ── Wsteczna zgodność: koszyki sprzed v1.14.0 ────────────────────────────
  describe('legacy `scheduled` metadata (carts created before v1.14.0)', () => {
    const legacy = {
      gift_recipient_email: 'anna.recipient@example.com',
      gift_recipient_message: 'Miłego dnia w BonBeauty',
      gift_recipient_send_timing: 'scheduled',
      gift_recipient_send_date: '2026-12-24',
      gift_recipient_bound_to_voucher_issue: true
    };

    it('is still readable — an old cart must not break checkout, AND is normalized to `handover`', () => {
      // LOW#5 (code-review 2.4): normalizacja `scheduled → handover` musi
      // pojawić się TU (metadanych), nie tylko w formularzu — inaczej UI
      // pokazuje „przekażę osobiście", a stan uznany za "kompletny" gdzieś
      // indziej wciąż niesie `scheduled`.
      expect(readGiftRecipientIssueMetadata(legacy)).toEqual({
        ...legacy,
        gift_recipient_send_timing: 'handover',
        gift_recipient_send_date: null
      });
    });

    it('maps to "handover" in the editable form, never to "now"', () => {
      // Wysyłka nie w terminie jest nieodwracalna — cichy awans do „od razu”
      // byłby najgorszym możliwym domyślnym zachowaniem.
      expect(toEditableSendTiming('scheduled')).toBe('handover');
      expect(toEditableSendTiming(undefined)).toBe('handover');
      expect(toEditableSendTiming('now')).toBe('now');
    });

    it('an unknown send-timing value is not readable as a bound payload', () => {
      expect(
        readGiftRecipientIssueMetadata({
          ...legacy,
          gift_recipient_send_timing: 'kiedys'
        })
      ).toBeNull();
    });
  });
});

describe('handover: e-mail obdarowanej nie ma celu przetwarzania (RODO art. 5 ust. 1 lit. c)', () => {
  const handoverForm: GiftRecipientFormData = {
    recipientEmail: '',
    message: 'Do odbioru w salonie',
    sendTiming: 'handover'
  };

  it('wymaga adresu WYLACZNIE przy wysylce od razu', () => {
    expect(isRecipientEmailRequired('now')).toBe(true);
    expect(isRecipientEmailRequired('handover')).toBe(false);
  });

  it('pusty adres przy handover NIE blokuje bramki platnosci', () => {
    // Rdzen defektu: gate `giftRecipientComplete` wymuszal podanie e-maila
    // osoby trzeciej, do ktorej nigdy nie wysylamy zadnej wiadomosci.
    expect(validateGiftRecipientForm(handoverForm)).toEqual({});
    expect(isGiftRecipientFormValid(handoverForm)).toBe(true);
  });

  it('pusty adres przy `now` NADAL blokuje — wysylka bez adresu nie ma jak dojsc', () => {
    expect(validateGiftRecipientForm({ ...handoverForm, sendTiming: 'now' })).toEqual({
      recipientEmail: 'invalid'
    });
  });

  it('NIE ZAPISUJE adresu przy handover, nawet jesli zostal wpisany', () => {
    // Zdjecie samego wymogu z formularza nie wystarczy: adres wpisany zanim
    // kupujaca przelaczyla timing i tak wyladowalby w `line_item.metadata`.
    const payload = buildGiftRecipientIssueMetadata({
      ...handoverForm,
      recipientEmail: 'obdarowana@example.com'
    });
    expect(payload.gift_recipient_email).toBe('');
    expect(JSON.stringify(payload)).not.toContain('obdarowana@example.com');
  });

  it('literowka w adresie jest zglaszana takze przy handover', () => {
    expect(
      validateGiftRecipientForm({ ...handoverForm, recipientEmail: 'nie-adres' })
    ).toEqual({ recipientEmail: 'invalid' });
  });

  it('odczyt bez klucza `gift_recipient_email` nie wywraca checkoutu', () => {
    // `mergeMetadata` Medusy USUWA klucz o wartosci pustego stringa, wiec zapis
    // wariantu handover zostawia metadane BEZ tego klucza. Gdyby odczyt tego nie
    // tolerowal, `giftRecipientComplete` bylby `false` zaraz po UDANYM zapisie —
    // oryginalny bug tylnym wejsciem, odtworzony przez sama poprawke.
    expect(
      readGiftRecipientIssueMetadata({
        gift_recipient_message: 'Do odbioru w salonie',
        gift_recipient_send_timing: 'handover',
        gift_recipient_bound_to_voucher_issue: true
      })
    ).toEqual({
      gift_recipient_email: '',
      gift_recipient_message: 'Do odbioru w salonie',
      gift_recipient_send_timing: 'handover',
      gift_recipient_send_date: null,
      gift_recipient_bound_to_voucher_issue: true
    });
  });

  it('zastane `scheduled` bez adresu tez sie odczytuje (normalizacja do handover)', () => {
    const read = readGiftRecipientIssueMetadata({
      gift_recipient_send_timing: 'scheduled',
      gift_recipient_bound_to_voucher_issue: true
    });
    expect(read?.gift_recipient_send_timing).toBe('handover');
  });
});

