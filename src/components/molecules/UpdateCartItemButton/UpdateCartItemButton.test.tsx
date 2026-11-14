import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/providers', () => ({
  useCartContext: () => ({ updateCartItem: async () => undefined, isUpdatingItem: false })
}));
vi.mock('@/lib/helpers/toast', () => ({ toast: { error: () => undefined } }));
vi.mock('@/components/atoms', () => ({
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />
}));

import { UpdateCartItemButton } from './UpdateCartItemButton';

function buttons(html: string): Array<{ label: string; disabled: boolean }> {
  return [...html.matchAll(/<button([^>]*)>/g)].map(m => ({
    label: /aria-label="([^"]+)"/.exec(m[1])?.[1] ?? '',
    disabled: /\sdisabled=""/.test(m[1])
  }));
}

describe('Story 3.3 AC2 — UpdateCartItemButton blokuje zmianę ilości linii voucherowej', () => {
  it('linia voucherowa (quantityLocked) ⇒ oba przyciski zablokowane + czytelna informacja', () => {
    const html = renderToStaticMarkup(
      <UpdateCartItemButton quantity={1} lineItemId="li_v" quantityLocked />
    );
    expect(buttons(html)).toEqual([
      { label: 'quantity_decrease_aria', disabled: true },
      { label: 'quantity_increase_aria', disabled: true }
    ]);
    expect(html).toContain('cart-item-voucher-quantity-locked');
    expect(html).toContain('voucher_quantity_locked');
  });

  it('linia nie-voucherowa ⇒ zwiększanie ilości dostępne (bez zmian zachowania)', () => {
    const html = renderToStaticMarkup(<UpdateCartItemButton quantity={2} lineItemId="li_p" />);
    expect(buttons(html)).toEqual([
      { label: 'quantity_decrease_aria', disabled: false },
      { label: 'quantity_increase_aria', disabled: false }
    ]);
    expect(html).not.toContain('cart-item-voucher-quantity-locked');
  });
});
