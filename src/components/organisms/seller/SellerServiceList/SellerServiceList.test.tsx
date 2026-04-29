import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: 'a' }));
vi.mock('@/lib/constants', () => ({ SELLER_SERVICE_LIST_PAGE_SIZE: 10 }));
vi.mock('@/components/molecules/PriceDisplay/PriceDisplay', () => ({
  PriceDisplay: 'mock-price',
}));

// useState mock — controlled via a module-level variable
let mockShowAll = false;
const mockSetShowAll = vi.fn((val: boolean) => { mockShowAll = val; });

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    useState: (init: unknown) => {
      // Only intercept the showAll boolean state
      if (typeof init === 'boolean') {
        return [mockShowAll, mockSetShowAll];
      }
      return actual.useState(init);
    },
  };
});

import type { HttpTypes } from '@medusajs/types';
import { SellerServiceList } from './SellerServiceList';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function findAll(element: React.ReactNode, predicate: (el: ReactEl) => boolean): ReactEl[] {
  if (!React.isValidElement(element)) return [];
  const results: ReactEl[] = [];
  if (predicate(element as ReactEl)) results.push(element as ReactEl);
  const children = React.Children.toArray((element as ReactEl).props.children as React.ReactNode);
  for (const child of children) {
    results.push(...findAll(child, predicate));
  }
  return results;
}

function findFirst(
  element: React.ReactNode,
  predicate: (el: ReactEl) => boolean
): ReactEl | null {
  const all = findAll(element, predicate);
  return all.length > 0 ? all[0] : null;
}

function collectText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  const children = React.Children.toArray((node as ReactEl).props.children as React.ReactNode);
  return children.map(collectText).join('');
}

function makeProduct(id: string, handle?: string): HttpTypes.StoreProduct {
  return {
    id,
    title: `Produkt ${id}`,
    handle: handle ?? `produkt-${id}`,
    variants: [
      {
        id: `var-${id}`,
        calculated_price: { calculated_amount: 10000 } as any,
      } as any,
    ],
  } as HttpTypes.StoreProduct;
}

function makeProducts(count: number): HttpTypes.StoreProduct[] {
  return Array.from({ length: count }, (_, i) => makeProduct(`p${i + 1}`));
}

describe('SellerServiceList', () => {
  it('returns null when products is empty', () => {
    const result = SellerServiceList({ products: [] });
    expect(result).toBeNull();
  });

  describe('heading', () => {
    it('renders "Zabiegi i usługi" heading', () => {
      const el = SellerServiceList({ products: makeProducts(1) }) as ReactEl;
      expect(collectText(el)).toContain('Zabiegi i usługi');
    });
  });

  describe('with ≤10 products (showAll = false)', () => {
    it('renders all 5 products as list items', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(5) }) as ReactEl;
      const links = findAll(el, e => e.type === 'a');
      expect(links).toHaveLength(5);
    });

    it('renders all 10 products (boundary)', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(10) }) as ReactEl;
      const links = findAll(el, e => e.type === 'a');
      expect(links).toHaveLength(10);
    });

    it('does NOT render "Pokaż więcej" for ≤10 products', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(10) }) as ReactEl;
      const text = collectText(el);
      expect(text).not.toContain('Pokaż więcej');
    });
  });

  describe('with >10 products, showAll = false', () => {
    it('renders only first 10 products', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(15) }) as ReactEl;
      const links = findAll(el, e => e.type === 'a');
      expect(links).toHaveLength(10);
    });

    it('renders "Pokaż więcej" button', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(15) }) as ReactEl;
      const btn = findFirst(el, e => e.type === 'button');
      expect(btn).not.toBeNull();
      expect(collectText(btn!)).toContain('Pokaż więcej');
    });

    it('"Pokaż więcej" button shows remaining count', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(15) }) as ReactEl;
      const text = collectText(el);
      expect(text).toContain('(5)');
    });

    it('calls setShowAll(true) on button click', () => {
      mockShowAll = false;
      mockSetShowAll.mockClear();
      const el = SellerServiceList({ products: makeProducts(15) }) as ReactEl;
      const btn = findFirst(el, e => e.type === 'button') as ReactEl;
      const onClick = btn.props.onClick as () => void;
      onClick();
      expect(mockSetShowAll).toHaveBeenCalledWith(true);
    });
  });

  describe('with >10 products, showAll = true', () => {
    it('renders all 15 products', () => {
      mockShowAll = true;
      const el = SellerServiceList({ products: makeProducts(15) }) as ReactEl;
      const links = findAll(el, e => e.type === 'a');
      expect(links).toHaveLength(15);
    });

    it('does NOT render "Pokaż więcej" button when showAll = true', () => {
      mockShowAll = true;
      const el = SellerServiceList({ products: makeProducts(15) }) as ReactEl;
      const btn = findFirst(el, e => e.type === 'button');
      expect(btn).toBeNull();
    });
  });

  describe('product links', () => {
    it('links "Kup voucher" to /products/[handle]', () => {
      mockShowAll = false;
      const product = makeProduct('p1', 'masaz-relaksacyjny');
      const el = SellerServiceList({ products: [product] }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a') as ReactEl;
      expect(link.props.href).toBe('/products/masaz-relaksacyjny');
    });

    it('renders product title', () => {
      mockShowAll = false;
      const product = makeProduct('p1');
      (product as any).title = 'Masaż klasyczny';
      const el = SellerServiceList({ products: [product] }) as ReactEl;
      expect(collectText(el)).toContain('Masaż klasyczny');
    });

    it('renders PriceDisplay with calculated_amount from first variant', () => {
      mockShowAll = false;
      const product = makeProduct('p1');
      const el = SellerServiceList({ products: [product] }) as ReactEl;
      const priceEl = findFirst(el, e => e.type === 'mock-price');
      expect(priceEl).not.toBeNull();
      expect(priceEl!.props.amountInCents).toBe(10000);
    });

    it('renders "Kup voucher" text', () => {
      mockShowAll = false;
      const el = SellerServiceList({ products: makeProducts(1) }) as ReactEl;
      expect(collectText(el)).toContain('Kup voucher');
    });
  });
});
