import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: 'mock-image' }));
vi.mock('next/link', () => ({ default: 'a' }));

import { getInitials, hashColor, SellerCard } from './SellerCard';

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

describe('SellerCard', () => {
  describe('with photo_url', () => {
    it('renders next/image when photo_url provided', () => {
      const el = SellerCard({
        name: 'Salon Złoty',
        handle: 'salon-zloty',
        photo_url: 'https://example.com/photo.jpg',
        city: 'Warszawa',
        product_count: 3
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img).not.toBeNull();
      expect(img!.props.src).toBe('https://example.com/photo.jpg');
      expect(img!.props.alt).toBe('Salon Złoty');
    });

    it('applies group-hover:scale-105 to image', () => {
      const el = SellerCard({
        name: 'Salon',
        handle: 'salon',
        photo_url: 'https://example.com/x.jpg',
        product_count: 1
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img!.props.className).toContain('group-hover:scale-105');
    });

    it('renders seller name and city', () => {
      const el = SellerCard({
        name: 'Salon Złoty',
        handle: 'salon-zloty',
        photo_url: 'https://example.com/x.jpg',
        city: 'Kraków',
        product_count: 5
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Salon Złoty');
      expect(text).toContain('Kraków');
      expect(text).toContain('5 produktów');
    });
  });

  describe('fallback (no photo_url)', () => {
    it('does NOT render next/image when photo_url absent', () => {
      const el = SellerCard({
        name: 'Salon Cichy',
        handle: 'salon-cichy',
        product_count: 2
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img).toBeNull();
    });

    it('renders initials circle in fallback', () => {
      const el = SellerCard({
        name: 'Anna Kowalska',
        handle: 'anna-k',
        product_count: 2
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('AK');
    });

    it('renders gradient container in fallback', () => {
      const el = SellerCard({
        name: 'Salon Fallback',
        handle: 'fallback',
        product_count: 1
      }) as ReactEl;

      const gradientDiv = findFirst(
        el,
        e =>
          e.type === 'div' &&
          typeof e.props.style === 'object' &&
          String((e.props.style as Record<string, unknown>).background ?? '').includes('gradient')
      );
      expect(gradientDiv).not.toBeNull();
    });

    it('omits city when not provided', () => {
      const el = SellerCard({
        name: 'Salon X',
        handle: 'salon-x',
        product_count: 1
      }) as ReactEl;

      const text = collectText(el);
      expect(text).not.toContain('undefined');
    });
  });

  describe('district display (Story 6.2 AC3)', () => {
    it('renders district before city with middot separator', () => {
      const el = SellerCard({
        name: 'Salon Belle',
        handle: 'salon-belle',
        city: 'Warszawa',
        district: 'Praga-Południe',
        product_count: 12
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Praga-Południe · Warszawa');
      // No fallback '/' separator (old contract).
      expect(text).not.toContain('Praga-Południe / Warszawa');
    });

    it('renders only district when city is null without leading separator', () => {
      const el = SellerCard({
        name: 'Salon Mokotów',
        handle: 'salon-mokotow',
        city: null,
        district: 'Mokotów',
        product_count: 1
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Mokotów');
      expect(text).not.toContain('· Mokotów');
      expect(text).not.toContain('Mokotów ·');
    });

    it('renders only city when district is null without trailing separator', () => {
      const el = SellerCard({
        name: 'Salon Stare Miasto',
        handle: 'salon-sm',
        city: 'Warszawa',
        district: null,
        product_count: 1
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Warszawa');
      expect(text).not.toContain('· Warszawa');
      expect(text).not.toContain('Warszawa ·');
    });

    it('omits location line entirely when both city and district are null', () => {
      const el = SellerCard({
        name: 'Salon Anonymous',
        handle: 'anon',
        city: null,
        district: null,
        product_count: 1
      }) as ReactEl;

      const text = collectText(el);
      expect(text).not.toContain('·');
      expect(text).not.toContain('undefined');
    });
  });

  describe('hover and navigation', () => {
    it('wraps card in link pointing to /sellers/[handle]', () => {
      const el = SellerCard({
        name: 'Salon',
        handle: 'moj-salon',
        product_count: 1
      }) as ReactEl;

      expect(el.type).toBe('a');
      expect(el.props.href).toBe('/sellers/moj-salon');
    });

    it('applies hover translate classes to root element', () => {
      const el = SellerCard({
        name: 'Salon',
        handle: 'moj-salon',
        product_count: 1
      }) as ReactEl;

      expect(el.props.className).toContain('hover:-translate-y-0.5');
      expect(el.props.className).toContain('hover:shadow-lg');
    });
  });
});

describe('getInitials', () => {
  it('returns first letter of single word', () => {
    expect(getInitials('Anna')).toBe('A');
  });

  it('returns first letters of two words', () => {
    expect(getInitials('Anna Kowalska')).toBe('AK');
  });

  it('returns max 2 letters for 3-word name', () => {
    expect(getInitials('Jan Maria Kowalski')).toBe('JM');
  });

  it('handles extra spaces', () => {
    expect(getInitials('  Jan  Kowalski  ')).toBe('JK');
  });

  it('returns uppercase initials', () => {
    expect(getInitials('adam nowak')).toBe('AN');
  });

  it('handles single character name', () => {
    expect(getInitials('A')).toBe('A');
  });

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('');
  });

  it('handles names with special Polish characters', () => {
    expect(getInitials('Żaneta Ćwiklińska')).toBe('ŻĆ');
  });
});

describe('hashColor', () => {
  it('returns a non-empty string', () => {
    expect(hashColor('test-handle')).toBeTruthy();
  });

  it('returns a bg-* Tailwind class', () => {
    const color = hashColor('salon-one');
    expect(color).toMatch(/^bg-/);
  });

  it('uses token-driven avatar backgrounds', () => {
    const colors = ['salon-one', 'salon-two', 'salon-three', 'salon-four'].map(hashColor);
    const legacyRawPalettes = new RegExp(['amb', 'er-|emer', 'ald-'].join(''));
    expect(colors.every(color => color.includes('var(--'))).toBe(true);
    expect(colors.join(' ')).not.toMatch(legacyRawPalettes);
  });

  it('returns deterministic result for same handle', () => {
    expect(hashColor('stable-handle')).toBe(hashColor('stable-handle'));
  });

  it('returns different colors for clearly different handles', () => {
    // Not guaranteed to differ but handles with very different char sums should
    const colors = ['a', 'bbbbb', 'ccccccccc', 'dddddddddddddd'].map(hashColor);
    const unique = new Set(colors);
    // At least 2 unique colors from 4 different handles
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });
});
