/**
 * Bramka runtime dla inwariantu tożsamości pozycji koszyka.
 *
 * Reprodukuje dokładnie zgłoszony objaw:
 *   Each child in a list should have a unique "key" prop.
 *   Check the render method of `MiniCartDrawer`.
 *
 * Test istnieje, bo sam typ `id: string` w StoreCartLineItemOptimisticUpdate jest
 * bramką wyłącznie kompilacyjną (`tsc` NIE wchodzi w `pnpm test`). Tu mierzymy
 * zachowanie: pozycja zbudowana przez `buildOptimisticLineItemId` renderuje się
 * bez ostrzeżenia o kluczach, a pozycja bez `id` — z ostrzeżeniem.
 */
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  MiniCartDrawer,
  type CartItem,
} from '@/components/organisms/MiniCartDrawer/MiniCartDrawer';
import { buildOptimisticLineItemId } from '@/lib/helpers/optimistic-line-item';

const messages = {
  mini_cart: {
    aria_label: 'Koszyk',
    title: 'Koszyk',
    close: 'Zamknij',
    empty_title: 'Pusto',
    empty_cta: 'Wróć',
    remove: 'Usuń',
    discount: 'Rabat',
    discount_placeholder: 'Kod',
    apply: 'Zastosuj',
    subtotal: 'Suma',
    total: 'Razem',
    shipping_estimate: 'Dostawa',
    checkout: 'Do kasy',
    continue_shopping: 'Kontynuuj',
  },
  common: { loading: 'Ładowanie' },
};

const KEY_WARNING = /unique "key" prop/i;

function renderAndCollectKeyWarnings(items: CartItem[]): string[] {
  const captured: string[] = [];
  const collect = (...args: unknown[]) => {
    captured.push(args.map(String).join(' '));
  };
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(collect);
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(collect);

  try {
    renderToStaticMarkup(
      <NextIntlClientProvider locale="pl" messages={messages}>
        <MiniCartDrawer
          open
          items={items}
          subtotal={100}
          currency="PLN"
          locale="pl"
          onClose={() => {}}
        />
      </NextIntlClientProvider>
    );
  } finally {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  }

  return captured.filter(message => KEY_WARNING.test(message));
}

describe('MiniCartDrawer — inwariant tożsamości pozycji', () => {
  it('biegnie w trybie dev — inaczej React nie emituje ostrzeżeń i test przechodzi próżno', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
  });

  it('pozycja optymistyczna z buildOptimisticLineItemId renderuje się bez ostrzeżenia o kluczach', () => {
    const items: CartItem[] = [
      {
        id: buildOptimisticLineItemId('variant_01'),
        name: 'Produkt A',
        quantity: 1,
        unitPrice: 10,
      },
      {
        id: buildOptimisticLineItemId('variant_02'),
        name: 'Produkt B',
        quantity: 2,
        unitPrice: 20,
      },
    ];

    expect(renderAndCollectKeyWarnings(items)).toEqual([]);
  });

  it('pozycja bez id odtwarza zgłoszony błąd — dowód, że bramka mierzy właściwą rzecz', () => {
    const itemsWithoutId = [
      { id: undefined, name: 'Produkt A', quantity: 1, unitPrice: 10 },
      { id: undefined, name: 'Produkt B', quantity: 1, unitPrice: 10 },
    ] as unknown as CartItem[];

    const warnings = renderAndCollectKeyWarnings(itemsWithoutId);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('MiniCartDrawer');
  });
});
