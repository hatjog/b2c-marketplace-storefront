/**
 * v1.15.0 Story 3.7 (AC1, AC2) — KARDYNALNOŚĆ MIERZONA NA WYRENDEROWANEJ
 * POWIERZCHNI.
 *
 * Test asertuje na RENDERZE, nie na sygnaturze: liczy elementy listy zamówień
 * i porównuje widoczne identyfikatory. Przywrócenie skalarnego propa
 * (`orderId: string`) albo redukcji `orderIds[0]` powoduje CZERWIEŃ — kolekcja
 * nie ma wtedy jak zostać wyrenderowana.
 *
 * Komunikaty pochodzą z REALNEGO `messages/pl.json`, więc test jest zarazem
 * kontrolą, że nowe klucze rozwiązują się we WŁAŚCIWYM namespace (`confirmation`).
 * Klucz w złym namespace daje w tym repo `500` — znana klasa defektu.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ConfirmationPageContent } from '../ConfirmationPageContent';

const messages = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../../messages/pl.json', import.meta.url)), 'utf-8')
);

function render(node: React.ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale="pl"
      messages={messages}
    >
      {node}
    </NextIntlClientProvider>
  );
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe('powierzchnia potwierdzenia — kardynalność zakupu', () => {
  it('zakup z DWOMA zamówieniami renderuje DWA — z dwoma różnymi identyfikatorami', () => {
    const html = render(
      <ConfirmationPageContent
        purchase={{
          kind: 'collection',
          orderIds: ['order_aaa', 'order_bbb'],
          expectedOrderCount: 2
        }}
      />
    );

    // Dwa elementy listy — liczone na renderze, nie na propsie.
    expect(countOccurrences(html, 'data-order-id="order_aaa"')).toBe(1);
    expect(countOccurrences(html, 'data-order-id="order_bbb"')).toBe(1);
    expect(html).toContain('data-order-count="2"');
    expect(html).toContain('data-expected-order-count="2"');
    expect(html).toContain('data-cardinality="complete"');

    // Zgodna liczność NIE straszy kupującej banerem.
    expect(html).not.toContain('data-testid="confirmation-cardinality-notice"');
  });

  it('N = 1 nie zyskuje ceremonii: brak „zamówienie 1 z 1" i brak baneru liczności', () => {
    const html = render(
      <ConfirmationPageContent
        purchase={{ kind: 'collection', orderIds: ['order_solo'], expectedOrderCount: 1 }}
      />
    );

    expect(countOccurrences(html, 'data-order-id="order_solo"')).toBe(1);
    expect(html).not.toContain('data-testid="order-position-label"');
    expect(html).not.toContain('data-testid="purchase-order-count"');
    expect(html).not.toContain('data-testid="confirmation-cardinality-notice"');
  });

  it('sukces CZĘŚCIOWY (1 z 2) jest NAZWANY, a nie cichą krótszą listą', () => {
    const html = render(
      <ConfirmationPageContent
        purchase={{ kind: 'collection', orderIds: ['order_aaa'], expectedOrderCount: 2 }}
      />
    );

    expect(html).toContain('data-cardinality="partial"');
    expect(html).toContain('data-testid="confirmation-cardinality-notice"');
    // Liczby są w treści dla CZŁOWIEKA, nie tylko w atrybucie data-*.
    expect(html).toContain('1 z 2');
  });

  it('trzy wejścia dają TRZY odróżnialne wyniki (pełny / częściowy / brak zakupu)', () => {
    const full = render(
      <ConfirmationPageContent
        purchase={{ kind: 'collection', orderIds: ['a', 'b'], expectedOrderCount: 2 }}
      />
    );
    const partial = render(
      <ConfirmationPageContent
        purchase={{ kind: 'collection', orderIds: ['a'], expectedOrderCount: 2 }}
      />
    );
    const none = render(
      <ConfirmationPageContent purchase={{ kind: 'purchase_not_found', value: 'cart_x' }} />
    );

    const marks = [full, partial, none].map(html => {
      const match = /data-purchase-state="([a-z_]+)"[\s\S]*?data-cardinality="([a-z_]+)"/.exec(html);
      return match ? `${match[1]}/${match[2]}` : 'purchase_not_found/none';
    });

    expect(new Set(marks).size).toBe(3);
  });

  it('identyfikator spoza dziedziny jest BŁĘDEM z wyjściem, nie pustym ekranem (AD-19)', () => {
    const html = render(
      <ConfirmationPageContent purchase={{ kind: 'out_of_domain', value: 'zzz' }} />
    );

    expect(html).toContain('data-testid="confirmation-out-of-domain"');
    expect(html).toContain('role="alert"');
    expect(html).toContain(messages.confirmation.out_of_domain_title);
    expect(html).toContain(messages.confirmation.recovery_cta);
  });

  it('drill-down z linku zastanego jest NAZWANY, a nie udawany jako całość zakupu (AD-16)', () => {
    const html = render(
      <ConfirmationPageContent
        purchase={{ kind: 'drilldown', orderIds: ['order_from_email'], expectedOrderCount: null }}
      />
    );

    expect(html).toContain('data-testid="confirmation-drilldown-notice"');
    expect(html).toContain(messages.confirmation.drilldown_notice);
  });

  it('brak liczności w kontrakcie przy N > 1 jest NAZWANY, nie milcząco uznany za zgodność', () => {
    const html = render(
      <ConfirmationPageContent
        purchase={{ kind: 'collection', orderIds: ['a', 'b'], expectedOrderCount: null }}
      />
    );

    expect(html).toContain('data-cardinality="unknown_expected"');
    expect(html).toContain('data-testid="confirmation-cardinality-notice"');
  });

  it('żaden nowy komunikat nie jest literałem w kodzie — wszystkie klucze rozwiązują się w namespace confirmation', () => {
    const html = render(
      <ConfirmationPageContent
        purchase={{ kind: 'collection', orderIds: ['a', 'b'], expectedOrderCount: 3 }}
      />
    );

    // next-intl renderuje nierozwiązany klucz jako `confirmation.<key>`.
    expect(html).not.toMatch(/confirmation\.[a-z_]+/);
  });
});
