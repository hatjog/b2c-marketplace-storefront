/**
 * @vitest-environment jsdom
 *
 * v1.15.0 Story 3.7 (AC5, NFR-7) — axe na WYRENDEROWANEJ powierzchni, dla
 * KAŻDEGO nowego stanu.
 *
 * ── Co ten plik mierzy, a czego NIE ────────────────────────────────────────
 * MIERZY: strukturę wyrenderowanego drzewa dla nowych stanów (lista N zamówień,
 * sukces częściowy, stan terminalny porażki, identyfikator spoza dziedziny) —
 * role, nazwy dostępne, kolejność nagłówków, unikalność `id`, `aria-*`.
 * Uruchamiane jest tu REALNE axe-core na realnym DOM-ie, nie sprawdzenie
 * obecności klasy w kodzie.
 *
 * NIE MIERZY: kontrastu AA, celów dotykowych ≥44 px ani widocznego pierścienia
 * focusu. Te trzy wymagają ARKUSZA STYLÓW i układu, czyli przeglądarki —
 * jsdom nie liczy layoutu, a axe-core wyłącza wtedy regułę `color-contrast`
 * z własnej inicjatywy. Zielony wynik tego pliku NIE JEST więc dowodem NFR-7
 * w części wizualnej; ten dowód należy do przebiegu Playwrighta
 * (`e2e/ux-evidence/confirmation.spec.ts`) i jest w tej story zapisany jako
 * NIEWYKONANY, a nie zastąpiony asercją, która świeci na zielono niezależnie
 * od wyglądu.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import type { ConfirmationPurchase } from '@/lib/confirmation/confirmation-purchase';

import { ConfirmationPageContent } from '../ConfirmationPageContent';

// `import.meta.url` w środowisku jsdom jest adresem http, nie plikowym —
// komunikaty czytamy względem katalogu roboczego vitesta (katalog storefrontu).
const messages = JSON.parse(readFileSync(resolve('messages/pl.json'), 'utf-8'));

/** Reguły niemierzalne bez arkusza stylów i układu — wyłączone JAWNIE, z powodem. */
const DISABLED_RULES = {
  // jsdom nie liczy layoutu ani nie stosuje CSS — axe i tak zwróciłby
  // `incomplete`, a udawanie wyniku byłoby gorsze niż jego brak.
  'color-contrast': { enabled: false },
  // Powierzchnia jest fragmentem strony (`<main>` dokłada trasa RSC), więc
  // reguły landmarkowe całego dokumentu nie mają tu sensownego zakresu.
  region: { enabled: false },
  'landmark-one-main': { enabled: false },
  'page-has-heading-one': { enabled: false }
};

function mount(purchase: ConfirmationPurchase): HTMLElement {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider
      locale="pl"
      messages={messages}
    >
      <ConfirmationPageContent purchase={purchase} />
    </NextIntlClientProvider>
  );

  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

async function analyze(host: HTMLElement) {
  const results = await axe.run(host, { rules: DISABLED_RULES });
  return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('NFR-7 — axe na wyrenderowanej powierzchni potwierdzenia', () => {
  const cases: Array<[string, ConfirmationPurchase]> = [
    [
      'lista dwóch zamówień',
      { kind: 'collection', orderIds: ['order_aaa', 'order_bbb'], expectedOrderCount: 2 }
    ],
    [
      'sukces częściowy (1 z 2)',
      { kind: 'collection', orderIds: ['order_aaa'], expectedOrderCount: 2 }
    ],
    [
      'liczność nieznana przy N > 1',
      { kind: 'collection', orderIds: ['order_aaa', 'order_bbb'], expectedOrderCount: null }
    ],
    [
      'drill-down z linku zastanego',
      { kind: 'drilldown', orderIds: ['order_from_email'], expectedOrderCount: null }
    ],
    ['zakup nieodnaleziony', { kind: 'purchase_not_found', value: 'cart_x' }],
    ['identyfikator spoza dziedziny', { kind: 'out_of_domain', value: 'zzz' }]
  ];

  it.each(cases)('stan „%s" nie ma naruszeń serious/critical', async (_label, purchase) => {
    const violations = await analyze(mount(purchase));
    expect(violations.map(v => `${v.id}: ${v.help}`)).toEqual([]);
  });

  it('stan terminalny porażki ogłasza się asertywnie i ma DOSTĘPNE wyjście', () => {
    // To jest ekran, na którym człowiek szuka przycisku „co dalej". Wyjście
    // musi być osiągalne z klawiatury i mieć nazwę dostępną — brak jednego
    // z tych dwóch zamienia stan terminalny w ślepy zaułek.
    const host = mount({ kind: 'out_of_domain', value: 'zzz' });

    const alert = host.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();

    const link = host.querySelector('a[href]');
    expect(link).not.toBeNull();
    expect(link?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    // Element z natury fokusowalny — bez `tabindex="-1"`, które by go wycięło
    // z kolejności tabulacji.
    expect(link?.getAttribute('tabindex')).not.toBe('-1');
    // Widoczny pierścień focusu jest DEKLAROWANY w klasie; jego rzeczywisty
    // wygląd mierzy dopiero przebieg w przeglądarce (patrz nagłówek pliku).
    expect(link?.getAttribute('class') ?? '').toContain('focus-visible:outline');
  });

  it('dwa zamówienia nie kolidują identyfikatorami DOM (aria-labelledby wskazuje właściwy nagłówek)', () => {
    const host = mount({
      kind: 'collection',
      orderIds: ['order_aaa', 'order_bbb'],
      expectedOrderCount: 2
    });

    const ids = Array.from(host.querySelectorAll('[id]')).map(el => el.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const card of Array.from(host.querySelectorAll('[data-testid="order-confirmed-loading"], article[aria-labelledby]'))) {
      const labelledBy = card.getAttribute('aria-labelledby');
      if (labelledBy) {
        expect(host.querySelector(`#${CSS.escape(labelledBy)}`)).not.toBeNull();
      }
    }
  });
});
