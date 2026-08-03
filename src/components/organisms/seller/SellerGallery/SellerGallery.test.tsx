import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({ default: 'mock-image' }));

import { SellerGallery } from './SellerGallery';

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

describe('SellerGallery', () => {
  describe('empty/null states', () => {
    it('returns null when gallery is undefined', () => {
      const result = SellerGallery({ gallery: undefined, sellerName: 'Salon' });
      expect(result).toBeNull();
    });

    it('returns null when gallery is null', () => {
      const result = SellerGallery({ gallery: null, sellerName: 'Salon' });
      expect(result).toBeNull();
    });

    it('returns null when gallery is empty array', () => {
      const result = SellerGallery({ gallery: [], sellerName: 'Salon' });
      expect(result).toBeNull();
    });
  });

  describe('with gallery items', () => {
    const gallery = [
      { url: 'https://example.com/img1.jpg', alt: 'Opis zdjęcia' },
      { url: 'https://example.com/img2.jpg', alt: null },
      { url: 'https://example.com/img3.jpg' },
    ];

    it('renders a section with aria-label', () => {
      const el = SellerGallery({ gallery, sellerName: 'Piękny Salon' }) as ReactEl;
      const section = findFirst(el, e => e.type === 'section');
      expect(section).not.toBeNull();
      expect(section!.props['aria-label']).toBe('Galeria salonu');
    });

    it('renders correct number of images', () => {
      const el = SellerGallery({ gallery, sellerName: 'Piękny Salon' }) as ReactEl;
      const images = findAll(el, e => e.type === 'mock-image');
      expect(images).toHaveLength(3);
    });

    it('uses item.alt when available', () => {
      const el = SellerGallery({ gallery, sellerName: 'Piękny Salon' }) as ReactEl;
      const images = findAll(el, e => e.type === 'mock-image');
      expect(images[0].props.alt).toBe('Opis zdjęcia');
    });

    it('falls back to sellerName when item.alt is null', () => {
      const el = SellerGallery({ gallery, sellerName: 'Piękny Salon' }) as ReactEl;
      const images = findAll(el, e => e.type === 'mock-image');
      expect(images[1].props.alt).toBe('Piękny Salon');
    });

    it('falls back to sellerName when item.alt is undefined', () => {
      const el = SellerGallery({ gallery, sellerName: 'Piękny Salon' }) as ReactEl;
      const images = findAll(el, e => e.type === 'mock-image');
      expect(images[2].props.alt).toBe('Piękny Salon');
    });

    it('applies grid classes for 2-col mobile, 3-col desktop', () => {
      const el = SellerGallery({ gallery, sellerName: 'Salon' }) as ReactEl;
      const grid = findFirst(el, e =>
        typeof e.props.className === 'string' &&
        (e.props.className as string).includes('grid-cols-2') &&
        (e.props.className as string).includes('md:grid-cols-3')
      );
      expect(grid).not.toBeNull();
    });

    it('applies aspect-[4/3] to image wrapper', () => {
      const el = SellerGallery({ gallery, sellerName: 'Salon' }) as ReactEl;
      const wrapper = findFirst(el, e =>
        typeof e.props.className === 'string' &&
        (e.props.className as string).includes('aspect-[4/3]')
      );
      expect(wrapper).not.toBeNull();
    });

    it('uses object-cover on images', () => {
      const el = SellerGallery({ gallery, sellerName: 'Salon' }) as ReactEl;
      const images = findAll(el, e => e.type === 'mock-image');
      expect(images[0].props.className).toContain('object-cover');
    });

    it('uses correct src from gallery item', () => {
      const el = SellerGallery({ gallery, sellerName: 'Salon' }) as ReactEl;
      const images = findAll(el, e => e.type === 'mock-image');
      expect(images[0].props.src).toBe('https://example.com/img1.jpg');
    });
  });
});
