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
export type GiftRecipientPersistedSendTiming = GiftRecipientSendTiming | 'scheduled';

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

export type GiftRecipientValidationErrors = Partial<Record<'recipientEmail' | 'message', string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPersistedSendTiming(value: unknown): value is GiftRecipientPersistedSendTiming {
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
export function toEditableSendTiming(value: unknown): GiftRecipientSendTiming {
  if (value === 'now') return 'now';
  return 'handover';
}

/**
 * Czy przy tym send-timingu adres obdarowanej jest nam do czegokolwiek POTRZEBNY.
 *
 * Tylko `now` wysyła handoff-mail — potwierdza to jedyny produkcyjny czytelnik
 * po stronie backendu (`gift-handoff.ts`), który przy `handover` zwraca
 * `handover_in_person` ZANIM w ogóle spojrzy na adres.
 *
 * Przy „nie wysyłaj, przekażę osobiście" nie wysyłamy nic, więc wymaganie
 * adresu e-mail osoby trzeciej było przetwarzaniem danych osobowych BEZ CELU
 * (minimalizacja, RODO art. 5 ust. 1 lit. c) — a `privacy_copy` deklarowało
 * przetwarzanie „żeby dostarczyć voucher", czyli cel, którego nie realizowaliśmy.
 * Decyzja PO (Robert, 2026-08-01): naprawiamy.
 */
export function isRecipientEmailRequired(sendTiming: GiftRecipientSendTiming): boolean {
  return sendTiming === 'now';
}

export function validateGiftRecipientForm(
  data: GiftRecipientFormData
): GiftRecipientValidationErrors {
  const errors: GiftRecipientValidationErrors = {};
  const email = data.recipientEmail.trim();
  const message = data.message.trim();

  if (isRecipientEmailRequired(data.sendTiming)) {
    if (!EMAIL_RE.test(email)) {
      errors.recipientEmail = 'invalid';
    }
  } else if (email.length > 0 && !EMAIL_RE.test(email)) {
    // Adres nie jest wymagany, ale jeśli kupująca go wpisała (np. zanim
    // przełączyła się na „przekażę osobiście"), to literówka ma być widoczna
    // TERAZ — inaczej po powrocie do „wyślij od razu" formularz zablokowałby
    // się bez wskazania pola.
    errors.recipientEmail = 'invalid';
  }

  // Wiadomość jest OPCJONALNA (decyzja PO 2026-07-27). Ani FR-15a, ani story
  // 2.4 jej nie wymagają, a wymóg niepustej treści był niezakomunikowaną bramą
  // na drodze do płatności: kupująca podawała poprawny e-mail, zapis się nie
  // wykonywał, a sekcja płatności zostawała zablokowana bez wyjaśnienia.
  // Limit 200 znaków zostaje — to kontrakt szablonu handoff-maila.
  if (message.length > GIFT_RECIPIENT_MESSAGE_MAX) {
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
    // MINIMALIZACJA: przy „przekażę osobiście" adres obdarowanej NIE JEST
    // ZAPISYWANY. Zdjęcie samego wymogu z formularza nie wystarczyłoby —
    // adres wpisany zanim kupująca przełączyła timing i tak wylądowałby w
    // `line_item.metadata`, czyli przetwarzalibyśmy dane osoby trzeciej bez celu.
    gift_recipient_email: isRecipientEmailRequired(data.sendTiming)
      ? data.recipientEmail.trim().toLowerCase()
      : '',
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

  // BRAK klucza `gift_recipient_email` znaczy „nie podano adresu", nie „rekord
  // niekompletny" — DOKŁADNIE ta sama pułapka `mergeMetadata`, co przy
  // wiadomości (opis niżej). Odkąd wariant `handover` zapisuje pusty adres,
  // Medusa USUWA ten klucz, więc bez tego `?? ''` odczyt zwracałby `null`,
  // `giftRecipientComplete` zostawałoby `false` i sekcja płatności blokowałaby
  // się zaraz po UDANYM zapisie — czyli oryginalny bug tylnym wejściem,
  // odtworzony przez zmianę, która miała go usunąć.
  const recipientEmail = metadata.gift_recipient_email ?? '';
  // BRAK klucza znaczy „pusta wiadomość", nie „rekord niekompletny".
  //
  // Medusa stosuje `mergeMetadata` w generycznej ścieżce update KAŻDEGO modułu
  // (@medusajs/utils modules-sdk/medusa-internal-service.js), a ta funkcja
  // USUWA klucz, którego wartością jest pusty string. Skoro wiadomość jest
  // opcjonalna, zapis samego e-maila wysyła `gift_recipient_message: ''` —
  // Medusa kasuje klucz — i gdyby odczyt tego nie tolerował, zwracałby `null`,
  // `giftRecipientComplete` zostawałoby `false`, a sekcja płatności blokowała
  // się PONOWNIE zaraz po UDANYM zapisie. Czyli dokładnie ten bug, tylko
  // tylnym wejściem. Odczyt jest tu odporny na semantykę backendu, zamiast na
  // niej polegać.
  const message = metadata.gift_recipient_message ?? '';
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

  // LOW#5 (code-review 2.4): zastane `scheduled` normalizuje się do `handover`
  // TU, nie tylko w `data.sendTiming` dla formularza. Bez tego koszyk sprzed
  // v1.14.0 pokazywał w UI „przekażę osobiście", a `readGiftRecipientIssueMetadata`
  // dalej zwracał `scheduled` — rozjazd między stanem WYŚWIETLANYM a stanem, na
  // którym operuje reszta checkoutu (`giftRecipientComplete`, ewentualny re-zapis).
  void sendDate;
  return isGiftRecipientFormValid(data)
    ? {
        gift_recipient_email: recipientEmail,
        gift_recipient_message: message,
        gift_recipient_send_timing: data.sendTiming,
        // Normalizacja usuwa jedyną ścieżkę produkującą `scheduled` — data
        // wysyłki (kontrakt v1.15.0) nie ma już tu zastosowania.
        gift_recipient_send_date: null,
        gift_recipient_bound_to_voucher_issue: true
      }
    : null;
}
