import React from 'react';

import { describe, expect, it, vi } from 'vitest';

import { SellerHero } from './SellerHero';

vi.mock('next/image', () => ({ default: 'mock-image' }));

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

function findFirst(element: React.ReactNode, predicate: (el: ReactEl) => boolean): ReactEl | null {
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
        photo: 'https://example.com/hero.jpg'
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img).not.toBeNull();
      expect(img!.props.src).toBe('https://example.com/hero.jpg');
      expect(img!.props.alt).toBe('Salon Złoty');
    });

    it('applies priority prop to image for LCP', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg'
      }) as ReactEl;

      const img = findFirst(el, e => e.type === 'mock-image');
      expect(img!.props.priority).toBe(true);
    });

    it('renders gold scrim overlay', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg'
      }) as ReactEl;

      const overlay = findFirst(el, e => e.props['data-testid'] === 'seller-hero-gold-scrim');
      expect(overlay).not.toBeNull();
    });

    it('renders default italic tagline text', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg'
      }) as ReactEl;

      const text = collectText(el);
      expect(text).toContain('Salon partnerski BonBeauty');
    });

    it('renders custom tagline text', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: 'https://example.com/x.jpg',
        tagline: 'Partner platynowy'
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

      const fallback = findFirst(el, e => e.props['data-testid'] === 'seller-hero');
      expect(fallback).not.toBeNull();
    });

    it('renders monogram and tagline text in fallback', () => {
      const el = SellerHero({ name: 'Salon', photo: null }) as ReactEl;

      const monogram = findFirst(el, e => e.props['data-testid'] === 'seller-hero-monogram');
      expect(monogram).not.toBeNull();
      const text = collectText(el);
      expect(text).toContain('Salon partnerski BonBeauty');
    });

    it('does not render verified mark unless seller is verified', () => {
      const el = SellerHero({ name: 'Salon', photo: null }) as ReactEl;

      const mark = findFirst(el, e => e.props['data-testid'] === 'seller-hero-verified-mark');
      expect(mark).toBeNull();
    });

    it('renders verified mark only when seller is verified', () => {
      const el = SellerHero({
        name: 'Salon',
        photo: null,
        verified: true,
        verifiedLabel: 'Zweryfikowany salon'
      }) as ReactEl;

      const mark = findFirst(el, e => e.props['data-testid'] === 'seller-hero-verified-mark');
      expect(mark).not.toBeNull();
    });
  });
});
