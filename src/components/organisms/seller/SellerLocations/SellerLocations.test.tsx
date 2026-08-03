import React from 'react';
import { describe, expect, it } from 'vitest';

import { SellerLocations } from './SellerLocations';

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

describe('SellerLocations', () => {
  describe('empty/null states', () => {
    it('returns null when locations is undefined', () => {
      const result = SellerLocations({ locations: undefined });
      expect(result).toBeNull();
    });

    it('returns null when locations is null', () => {
      const result = SellerLocations({ locations: null });
      expect(result).toBeNull();
    });

    it('returns null when locations is empty array', () => {
      const result = SellerLocations({ locations: [] });
      expect(result).toBeNull();
    });
  });

  describe('with full address (address_line + postal_code + city)', () => {
    const locations = [
      {
        address_line: 'ul. Złota 1',
        postal_code: '00-001',
        city: 'Warszawa',
        country_code: 'pl',
      },
    ];

    it('renders section with aria-label', () => {
      const el = SellerLocations({ locations }) as ReactEl;
      const section = findFirst(el, e => e.type === 'section');
      expect(section!.props['aria-label']).toBe('Lokalizacje salonu');
    });

    it('displays full formatted address', () => {
      const el = SellerLocations({ locations }) as ReactEl;
      const text = collectText(el);
      expect(text).toContain('ul. Złota 1');
      expect(text).toContain('00-001 Warszawa');
    });

    it('renders Google Maps link when address_line and city present', () => {
      const el = SellerLocations({ locations }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      expect(link).not.toBeNull();
      expect(link!.props.href as string).toContain('maps.google.com');
    });

    it('Maps link uses encodeURIComponent on address parts', () => {
      const locWithPolish = [
        {
          address_line: 'ul. Łódzka 5',
          postal_code: '90-001',
          city: 'Łódź',
          country_code: 'pl',
        },
      ];
      const el = SellerLocations({ locations: locWithPolish }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      const href = link!.props.href as string;
      expect(href).toContain(encodeURIComponent('ul. Łódzka 5'));
      expect(href).toContain(encodeURIComponent('Łódź'));
    });

    it('Maps link opens in new tab with noopener', () => {
      const el = SellerLocations({ locations }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      expect(link!.props.target).toBe('_blank');
      expect(link!.props.rel).toBe('noopener noreferrer');
    });
  });

  describe('Maps link conditionally hidden', () => {
    it('hides Maps link when city is missing', () => {
      const locations = [
        {
          address_line: 'ul. Złota 1',
          postal_code: '00-001',
          city: null,
          country_code: 'pl',
        },
      ];
      const el = SellerLocations({ locations }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      expect(link).toBeNull();
    });

    it('hides Maps link when address_line is missing', () => {
      const locations = [
        {
          address_line: null,
          postal_code: '00-001',
          city: 'Warszawa',
          country_code: 'pl',
        },
      ];
      const el = SellerLocations({ locations }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      expect(link).toBeNull();
    });

    it('shows address text even when Maps link hidden (city missing)', () => {
      const locations = [
        {
          address_line: 'ul. Złota 1',
          postal_code: '00-001',
          city: null,
          country_code: 'pl',
        },
      ];
      const el = SellerLocations({ locations }) as ReactEl;
      const text = collectText(el);
      expect(text).toContain('ul. Złota 1');
    });
  });

  describe('Maps URL format', () => {
    it('uses correct maps.google.com base URL', () => {
      const locations = [
        {
          address_line: 'ul. Nowa 10',
          postal_code: '31-001',
          city: 'Kraków',
          country_code: 'pl',
        },
      ];
      const el = SellerLocations({ locations }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      expect((link!.props.href as string).startsWith('https://maps.google.com/?q=')).toBe(true);
    });

    it('includes postal_code in Maps URL', () => {
      const locations = [
        {
          address_line: 'ul. Nowa 10',
          postal_code: '31-001',
          city: 'Kraków',
          country_code: 'pl',
        },
      ];
      const el = SellerLocations({ locations }) as ReactEl;
      const link = findFirst(el, e => e.type === 'a');
      expect((link!.props.href as string)).toContain(encodeURIComponent('31-001'));
    });
  });

  describe('multiple locations', () => {
    it('renders all locations', () => {
      const locations = [
        { address_line: 'ul. A 1', city: 'Warszawa', postal_code: '00-001', country_code: 'pl' },
        { address_line: 'ul. B 2', city: 'Kraków', postal_code: '31-001', country_code: 'pl' },
      ];
      const el = SellerLocations({ locations }) as ReactEl;
      const links = findAll(el, e => e.type === 'a');
      expect(links).toHaveLength(2);
    });
  });
});
