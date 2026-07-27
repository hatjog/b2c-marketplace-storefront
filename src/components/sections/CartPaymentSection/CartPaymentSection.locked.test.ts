/**
 * Kontrakt „żadna sekcja checkoutu nie blokuje bez powodu".
 *
 * Testy trzymają się warstwy logiki + i18n (środowisko node, bez jsdom) —
 * mountowanie CartPaymentSection wymagałoby atrapy Stripe, RadioGroup,
 * next/navigation i sesji płatności, co testowałoby atrapy zamiast kontraktu.
 * Regresja, przed którą realnie bronimy, jest dwuczęściowa:
 *   1. warunek `locked` sekcji płatności znów obejmuje dane obdarowanej
 *      (⇒ pointer-events:none ⇒ martwy box),
 *   2. któryś powód blokady przestaje istnieć w którymś locale
 *      (⇒ blokada bez komunikatu, czyli dokładnie stan wyjściowy).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const LOCALES = ['pl', 'en', 'ua', 'de'] as const;

const messagesFor = (locale: string): Record<string, never> =>
  JSON.parse(readFileSync(resolve(process.cwd(), `messages/${locale}.json`), 'utf8'));

const checkoutPageSource = (): string =>
  readFileSync(resolve(process.cwd(), 'src/app/[locale]/(checkout)/checkout/page.tsx'), 'utf8');

const paymentSectionSource = (): string =>
  readFileSync(
    resolve(process.cwd(), 'src/components/sections/CartPaymentSection/CartPaymentSection.tsx'),
    'utf8'
  );

// ---------------------------------------------------------------------------
// Hard-lock płatności — wyłącznie dostawa
// ---------------------------------------------------------------------------
describe('CartPaymentSection — hard-lock zawężony do niekompletnej dostawy', () => {
  it('page.tsx nie wpina danych obdarowanej w `locked` sekcji płatności', () => {
    // Regresja, którą to łapie: powrót do
    // `locked={!shippingIsComplete || (giftRecipientRequired && !giftRecipientComplete)}`
    // ⇒ .bb-section-shell[data-locked] ⇒ pointer-events:none ⇒ kupująca nie
    // może kliknąć niczego w płatnościach i nie wie dlaczego.
    // Celujemy w blok propsów SAMEJ sekcji płatności — `locked={!shippingIsComplete}`
    // występuje też przy CheckoutPurchaseMode, więc gołe `toContain` przechodziło
    // nawet gdyby prop płatności wrócił do starej postaci.
    const source = checkoutPageSource();
    const paymentBlock = source.slice(source.indexOf('<CartPaymentSection'));
    const paymentProps = paymentBlock.slice(0, paymentBlock.indexOf('/>'));
    expect(paymentProps).toContain('locked={!shippingIsComplete}');
    expect(paymentProps).not.toContain('giftRecipientComplete)');
  });

  it('sekcja płatności nadal przekazuje gift-gate do warstwy zapłaty', () => {
    // Zdejmujemy warstwę WIZUALNĄ, nie bramkę finansową — propsy muszą zostać.
    const source = checkoutPageSource();
    expect(source).toContain('giftRecipientRequired={giftRecipientRequired}');
    expect(source).toContain('giftRecipientComplete={giftRecipientComplete}');
  });

  it('powód blokady jest liczony RAZ i konsumowany przez notice, Stripe i submit', () => {
    const source = paymentSectionSource();
    expect(source).toContain('const blockReason =');
    expect(source).toContain('blockedReason={blockReason}');
    expect(source).toContain('reason={blockReason}');
    expect(source).toContain('setError(blockReason');
    // Warunek nie może być ponownie rozdublowany na trzy kopie.
    expect(source.match(/gift_recipient\.payment_block/g) ?? []).toHaveLength(1);
  });

  it('bramka finansowa trzyma: `blocked` i guard przed gałęzią checkActiveSession', () => {
    // Review słusznie zauważył, że poprzednia wersja tych testów pilnowała
    // kosmetyki ostrzej niż bramki płatności — usunięcie propsa `blocked`
    // przechodziło cały zestaw.
    const source = paymentSectionSource();
    expect(source).toContain('blocked={!checkoutReady}');
    // `checkoutReady` musi wynikać z `blockReason`, nie być liczone równolegle.
    expect(source).toContain('const checkoutReady = blockReason === undefined;');
    // Guard MUSI stać przed `if (!checkActiveSession)`, inaczej istniejąca
    // sesja płatności pozwala ominąć bramkę i przejść do ?step=review.
    const guardAt = source.indexOf('if (!checkoutReady)');
    const branchAt = source.indexOf('if (!checkActiveSession)');
    expect(guardAt).toBeGreaterThan(-1);
    expect(branchAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(branchAt);
  });

  it('notice jest RODZEŃSTWEM .bb-section-shell, nie jego dzieckiem', () => {
    // `opacity` na zablokowanej sekcji tworzy kontekst stakingu, którego
    // dziecko nie cofnie — notice w środku byłby wyszarzony tak samo jak stan,
    // który naprawia. Kolejność w źródle: notice PRZED className="bb-section-shell".
    const source = paymentSectionSource();
    const noticeAt = source.indexOf('<SectionLockedNotice');
    const shellAt = source.indexOf('className="bb-section-shell"');
    expect(noticeAt).toBeGreaterThan(-1);
    expect(shellAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeLessThan(shellAt);
  });
});

// ---------------------------------------------------------------------------
// i18n — każdy powód blokady istnieje w każdym locale
// ---------------------------------------------------------------------------
describe('Powody blokady sekcji checkoutu — parity 4 locale', () => {
  const REASON_PATHS = [
    ['checkout', 'locked_reason', 'address_incomplete'],
    ['checkout', 'locked_reason', 'shipping_incomplete'],
    ['checkout', 'shipping_incomplete_block'],
    ['checkout', 'gift_recipient', 'payment_block']
  ] as const;

  it.each(LOCALES)('%s ma każdy powód blokady, niepusty', locale => {
    const messages = messagesFor(locale) as unknown as Record<string, unknown>;
    for (const path of REASON_PATHS) {
      const value = path.reduce<unknown>(
        (node, key) => (node as Record<string, unknown> | undefined)?.[key],
        messages
      );
      expect(typeof value, `${locale}: ${path.join('.')}`).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('wszystkie locale mają identyczny zestaw kluczy locked_reason', () => {
    const keySets = LOCALES.map(locale => {
      const messages = messagesFor(locale) as unknown as {
        checkout: { locked_reason: Record<string, string> };
      };
      return Object.keys(messages.checkout.locked_reason).sort();
    });
    for (const keys of keySets) {
      expect(keys).toEqual(keySets[0]);
    }
  });
});
