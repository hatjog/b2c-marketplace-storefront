/**
 * v1.16.0 Story 6.9 AC1 (FR-20, FR-30, NFR-4): every recipient page state has a
 * distinguishable message, a next action and no PII in the DOM.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import de from '../../../../messages/de.json';
import en from '../../../../messages/en.json';
import pl from '../../../../messages/pl.json';
import ua from '../../../../messages/ua.json';

const messages = { de, en, pl, ua } as const;
type Locale = keyof typeof messages;

function lookup(locale: Locale, key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages[locale].voucher.recipient);
  if (typeof value !== 'string') throw new Error(`missing i18n key voucher.recipient.${key} (${locale})`);
  return value;
}

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: Locale }) => (key: string, values?: Record<string, unknown>) =>
    lookup(locale, key).replace(/\{(\w+)\}/g, (_m, name: string) => String(values?.[name] ?? '')),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'vitest' }),
}));
vi.mock('../../voucher-possession/SymmetricPossessionSection', () => ({
  SymmetricPossessionSection: () => null,
}));

const { VoucherRecipientView } = await import('../VoucherRecipientView');
const { VoucherRecipientStateScreen } = await import('../VoucherRecipientStateScreen');
const { projectVoucherRecipientPage, VOUCHER_RECIPIENT_PAGE_STATES } = await import(
  '@/lib/data/voucher-recipient-projection'
);

const CODE = 'SECRET-GIFT-CODE-9F3K';
const PII = ['buyer@example.com', '+48 600 000 000', 'Kupujący Kowalski', 'odbiorca@example.com'];

function viewFor(state: 'active' | 'pending' | 'already_redeemed' | 'expired' | 'voided') {
  return {
    code: CODE,
    state,
    seller_name: 'Salon Test',
    seller_handle: 'salon-test',
    product_title: 'Manicure',
    value_minor: 10000,
    currency_code: 'PLN',
    expires_at: '2026-12-31T00:00:00.000Z',
    redeemed_at: null,
    sender_name: null,
    sender_disclosure_allowed: false,
    sender_message: null,
    pdf_url: null,
    seller_address: null,
    seller_phone: null,
    seller_hours: null,
    seller_city: null,
    seller_lat: null,
    seller_lng: null,
    policy_snapshot: null,
    is_public_entry_confirmed: state === 'active',
    // Fields outside the AR45 allowlist must never reach the DOM.
    buyer_email: PII[0],
    buyer_phone: PII[1],
    buyer_name: PII[2],
    recipient_email: PII[3],
  };
}

function resultFor(state: (typeof VOUCHER_RECIPIENT_PAGE_STATES)[number]) {
  switch (state) {
    case 'loading':
      return null;
    case 'forbidden':
      return { kind: 'forbidden', status: 403, reason: 'http_status' } as const;
    case 'not_found':
      return { kind: 'not_found', status: 404, reason: 'http_status' } as const;
    case 'technical_error':
      return { kind: 'technical_error', status: 503, reason: 'http_status' } as const;
    case 'redeemed':
      return { kind: 'ok', status: null, view: viewFor('already_redeemed') } as const;
    default:
      return { kind: 'ok', status: null, view: viewFor(state) } as const;
  }
}

// Expired / redeemed keep their established CTA copy (pre-6.9 screens).
const CTA_KEY: Partial<Record<string, string>> = {
  expired: 'expired.support_cta',
  redeemed: 'redeemed.cta_explore',
};

async function render(state: (typeof VOUCHER_RECIPIENT_PAGE_STATES)[number], locale: Locale) {
  const projection = projectVoucherRecipientPage(resultFor(state) as never, { locale, code: CODE });
  const element =
    state === 'loading'
      ? VoucherRecipientStateScreen({ projection, t: (key) => lookup(locale, key) })
      : await VoucherRecipientView({ locale, requestedCode: CODE, projection });
  return { html: renderToStaticMarkup(element), projection };
}

describe('VoucherRecipientView — pełny katalog stanów (AC1)', () => {
  it('katalog obejmuje 8 stanów z AC1 (+ not_found jako osobna klasa transportu)', () => {
    for (const state of ['loading', 'active', 'pending', 'redeemed', 'expired', 'voided', 'forbidden', 'technical_error']) {
      expect(VOUCHER_RECIPIENT_PAGE_STATES).toContain(state);
    }
  });

  it.each(VOUCHER_RECIPIENT_PAGE_STATES)('stan %s: unikalny data-state, komunikat, następna akcja, bez PII', async (state) => {
    for (const locale of ['pl', 'en', 'de', 'ua'] as const) {
      const { html, projection } = await render(state, locale);

      expect(html).toContain(`data-state="${state}"`);
      expect(html).toContain(`data-message-key="states.${state}"`);
      expect(html).toContain('data-testid="voucher-recipient-next-action"');
      expect(html).toContain(lookup(locale, CTA_KEY[state] ?? `states.${state}.cta`));
      if (projection.nextActionHref) {
        expect(html).toContain(`href="${projection.nextActionHref}"`);
      }
      for (const other of VOUCHER_RECIPIENT_PAGE_STATES.filter((s) => s !== state)) {
        expect(html).not.toContain(`data-state="${other}"`);
      }
      for (const pii of PII) {
        expect(html).not.toContain(pii);
      }
      if (state !== 'active') {
        // Code stays hidden in visible copy outside the confirmed active entry
        // (the retry/check-again href is the recipient's own canonical link).
        expect(html.replace(/href="[^"]*"/g, '')).not.toContain(CODE);
      }
    }
  });

  it('komunikaty stanów są rozróżnialne (unikalne nagłówki) w każdym locale', () => {
    for (const locale of ['pl', 'en', 'de', 'ua'] as const) {
      const headings = VOUCHER_RECIPIENT_PAGE_STATES.map((s) => lookup(locale, `states.${s}.heading`));
      expect(new Set(headings).size).toBe(headings.length);
    }
  });

  it('parytet kluczy voucher.recipient.states w pl/en/de/ua', () => {
    const shape = (locale: Locale) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(messages[locale].voucher.recipient.states).map(([k, v]) => [k, Object.keys(v).sort()])
        )
      );
    expect(shape('en')).toBe(shape('pl'));
    expect(shape('de')).toBe(shape('pl'));
    expect(shape('ua')).toBe(shape('pl'));
  });

  it('awaria (403/503) nie renderuje ekranu „wygasł”', async () => {
    for (const state of ['forbidden', 'technical_error', 'not_found'] as const) {
      const { html } = await render(state, 'pl');
      expect(html).not.toContain(lookup('pl', 'expired.heading'));
      expect(html).not.toContain(lookup('pl', 'states.expired.heading'));
    }
  });
});
