import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: 'mock-image' }));

import { SellerHero } from './SellerHero';

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

describe('SellerHero', () => {
  describe('with photo', () => {
    it('renders next/image with correct src and alt', () => {
      const el = SellerHero({
        name: 'Salon Złoty',
        photo: 'https://example.com/hero.jpg',
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img).not.toBeNull();
      expect(img!.props.src).toBe('https://example.com/hero.jpg');
      expect(img!.props.alt).toBe('Salon Złoty');
    });

    it('applies priority prop to image for LCP', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg',
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img!.props.priority).toBe(true);
    });

    it('renders gradient overlay', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg',
      }) as ReactEl;

      const overlay = findFirst(el, e =>
        typeof e.props.className === 'string' &&
        (e.props.className as string).includes('from-black/60')
      );
      expect(overlay).not.toBeNull();
    });

    it('renders default badge text', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg',
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Salon partnerski BonBeauty');
    });

    it('renders custom badge text', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg',
        badge: 'Partner platynowy',
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Partner platynowy');
    });
  });

  describe('fallback (no photo)', () => {
    it('does NOT render next/image when photo is null', () => {
      const el = SellerHero({ name: 'Salon', photo: null }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img).toBeNull();
    });

    it('does NOT render next/image when photo is undefined', () => {
      const el = SellerHero({ name: 'Salon' }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img).toBeNull();
    });

    it('renders fallback container with testid', () => {
      const el = SellerHero({ name: 'Salon', photo: null }) as ReactEl;

      const fallback = findFirst(el, e => e.props['data-testid'] === 'seller-hero-fallback');
      expect(fallback).not.toBeNull();
    });

    it('renders badge text in fallback', () => {
      const el = SellerHero({ name: 'Salon', photo: null }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Salon partnerski BonBeauty');
    });

    it('applies gradient background style in fallback', () => {
      const el = SellerHero({ name: 'Salon', photo: null }) as ReactEl;

      const fallback = findFirst(el, e => e.props['data-testid'] === 'seller-hero-fallback') as ReactEl;
      expect(fallback.props.style).toBeDefined();
      expect((fallback.props.style as Record<string, string>).background).toContain('gradient');
    });
  });
});
