import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => {
    const isValidSrc =
      typeof src === 'string' && (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://'));

    if (!isValidSrc) {
      throw new TypeError("Failed to construct 'URL': Invalid URL");
    }

    return React.createElement('img', { alt, src });
  }
}));

// CartDropdownItem calls useTranslations('seller.cart') (added 2026-05-07); the
// unit renders it without a NextIntlClientProvider, so stub next-intl to a
// passthrough that echoes the key.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key
}));

import { CartDropdownItem } from './CartDropdownItem';

describe('CartDropdownItem', () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID;
  });

  it('renders runtime asset thumbnails without throwing', () => {
    process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'bonbeauty';

    const item = {
      compare_at_unit_price: 0,
      id: 'item_01',
      product_title: 'Mezoterapia bezigłowa',
      quantity: 1,
      subtotal: 12900,
      thumbnail: 'assets/products/mezoterapia-beziglowa.jpg',
      variant: {
        options: []
      }
    } as any;

    const markup = renderToStaticMarkup(
      React.createElement(CartDropdownItem, {
        item,
        currency_code: 'pln'
      })
    );

    expect(markup).toContain('/api/runtime-market-assets/bonbeauty/assets/products/mezoterapia-beziglowa.jpg');
  });
});