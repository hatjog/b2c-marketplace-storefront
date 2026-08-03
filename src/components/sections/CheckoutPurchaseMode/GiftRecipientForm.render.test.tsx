/**
 * @vitest-environment jsdom
 *
 * GiftRecipientForm — render coverage (LOW#7, code-review 2.4).
 *
 * Testing standards story wymagają: "UI (AC4): render pokazuje dwie opcje
 * z nowym copy; pole daty nieosiągalne". `GiftRecipientForm.test.ts` (środowisko
 * node) sprawdza WYŁĄCZNIE czyste helpery i i18n przez `readFileSync` — cała
 * zmiana w JSX (usunięcie `<input type="date">`, dwie opcje send-timing,
 * `aria-pressed`, hint zależny od stanu) nie była wykonywana przez żaden test.
 * Ten plik montuje realny komponent, żeby przywrócona gałąź daty w renderze
 * faktycznie zawaliła test.
 */
import { act } from 'react';

import { NextIntlClientProvider } from 'next-intl';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import plMessages from '../../../../messages/pl.json';
import { GiftRecipientForm } from './GiftRecipientForm';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const mockRefresh = vi.fn();
const mockUpdateGiftRecipientCartItems = vi.fn().mockResolvedValue(undefined);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh })
}));

vi.mock('@/lib/data/cart', () => ({
  updateGiftRecipientCartItems: (...args: unknown[]) =>
    mockUpdateGiftRecipientCartItems(...args)
}));

// `@/components/atoms` is a barrel that also re-exports `LogoutButton`, which
// pulls in `@/lib/data/customer` → `@/lib/config` → constructs the Medusa SDK
// client at import time (storefront CLAUDE.md gotcha: barrel exports leak
// server modules into client bundles). Stub it so the barrel import doesn't
// need a real backend/localStorage in this render test.
vi.mock('@/lib/data/customer', () => ({
  signout: vi.fn(),
  retrieveCustomer: vi.fn()
}));

describe('GiftRecipientForm — render (AC4)', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderForm(lineItemIds: string[] = ['li_1']) {
    await act(async () => {
      root.render(
        <NextIntlClientProvider
          locale="pl"
          messages={plMessages}
        >
          <GiftRecipientForm lineItemIds={lineItemIds} />
        </NextIntlClientProvider>
      );
    });
  }

  it('renders exactly the two send-timing options with their copy — never a third', async () => {
    await renderForm();

    const now = container.querySelector('[data-testid="gift-recipient-send-now"]');
    const handover = container.querySelector(
      '[data-testid="gift-recipient-send-handover"]'
    );

    expect(now?.textContent).toBe('Wyślij od razu');
    expect(handover?.textContent).toBe('Nie wysyłaj, przekażę osobiście');
    expect(
      container.querySelectorAll('[data-testid^="gift-recipient-send-"]')
    ).toHaveLength(3); // now + handover buttons + hint <p> share the prefix
  });

  it('never renders a date input — send-date is unreachable from this UI (AC4)', async () => {
    await renderForm();

    expect(container.querySelector('input[type="date"]')).toBeNull();
    expect(container.querySelector('input[name*="send_date"]')).toBeNull();
  });

  it('defaults to "now" and shows the immediate-delivery hint', async () => {
    await renderForm();

    expect(
      container.querySelector('[data-testid="gift-recipient-send-now"]')?.getAttribute(
        'aria-pressed'
      )
    ).toBe('true');
    expect(
      container.querySelector('[data-testid="gift-recipient-send-handover"]')?.getAttribute(
        'aria-pressed'
      )
    ).toBe('false');
    expect(container.querySelector('[data-testid="gift-recipient-send-hint"]')?.textContent).toBe(
      'Odbiorca dostanie voucher e-mailem zaraz po opłaceniu zamówienia.'
    );
  });

  it('switching to "handover" flips aria-pressed and the hint — copy never mentions a date', async () => {
    await renderForm();

    const handoverButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="gift-recipient-send-handover"]'
    );
    await act(async () => {
      handoverButton?.click();
    });

    expect(
      container.querySelector('[data-testid="gift-recipient-send-now"]')?.getAttribute(
        'aria-pressed'
      )
    ).toBe('false');
    expect(handoverButton?.getAttribute('aria-pressed')).toBe('true');
    const hint = container.querySelector('[data-testid="gift-recipient-send-hint"]')?.textContent;
    expect(hint).toBe(
      'Nie wyślemy żadnego e-maila do odbiorcy — voucher przekażesz samodzielnie.'
    );
    expect(hint).not.toMatch(/data|termin|scheduled/i);
  });
});
