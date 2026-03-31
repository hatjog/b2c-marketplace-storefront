import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/icons', () => ({
  FacebookIcon: 'mock-facebook-icon',
  InstagramIcon: 'mock-instagram-icon',
  EarthIcon: 'mock-earth-icon',
}));

import { SellerSocialLinks } from './SellerSocialLinks';

// ---------------------------------------------------------------------------
// Tree traversal helper
// ---------------------------------------------------------------------------

function findAll(
  element: React.ReactElement | null,
  predicate: (el: React.ReactElement) => boolean,
): React.ReactElement[] {
  if (!element || !React.isValidElement(element)) return [];
  const el = element as React.ReactElement<Record<string, unknown>>;
  const results: React.ReactElement[] = [];
  if (predicate(el)) results.push(el);
  const children = React.Children.toArray(el.props?.children ?? []);
  for (const child of children) {
    if (React.isValidElement(child)) {
      results.push(...findAll(child as React.ReactElement, predicate));
    }
  }
  return results;
}

function findLinks(root: React.ReactElement): React.ReactElement[] {
  return findAll(root, el => el.type === 'a');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SellerSocialLinks — null/empty states (AC1)', () => {
  it('returns null when socialLinks is null', () => {
    const result = SellerSocialLinks({ socialLinks: null });
    expect(result).toBeNull();
  });

  it('returns null when socialLinks is undefined', () => {
    const result = SellerSocialLinks({});
    expect(result).toBeNull();
  });

  it('returns null when all values are null', () => {
    const result = SellerSocialLinks({
      socialLinks: { instagram: null, facebook: null, tiktok: null, website: null },
    });
    expect(result).toBeNull();
  });

  it('returns null when all values are undefined', () => {
    const result = SellerSocialLinks({ socialLinks: {} });
    expect(result).toBeNull();
  });
});

describe('SellerSocialLinks — renders only non-null links (AC1)', () => {
  it('renders Instagram link with correct href and attributes', () => {
    const result = SellerSocialLinks({
      socialLinks: { instagram: 'https://instagram.com/salon', facebook: null },
    }) as React.ReactElement;
    const links = findLinks(result);
    expect(links).toHaveLength(1);
    expect(links[0].props.href).toBe('https://instagram.com/salon');
    expect(links[0].props.target).toBe('_blank');
    expect(links[0].props.rel).toBe('noopener noreferrer');
    expect(links[0].props['aria-label']).toMatch(/instagram/i);
  });

  it('renders Facebook link when present', () => {
    const result = SellerSocialLinks({
      socialLinks: { facebook: 'https://facebook.com/salon', instagram: null },
    }) as React.ReactElement;
    const links = findLinks(result);
    expect(links).toHaveLength(1);
    expect(links[0].props.href).toBe('https://facebook.com/salon');
    expect(links[0].props['aria-label']).toMatch(/facebook/i);
  });

  it('renders TikTok link when present', () => {
    const result = SellerSocialLinks({
      socialLinks: { tiktok: 'https://tiktok.com/@salon' },
    }) as React.ReactElement;
    const links = findLinks(result);
    expect(links).toHaveLength(1);
    expect(links[0].props.href).toBe('https://tiktok.com/@salon');
    expect(links[0].props['aria-label']).toMatch(/tiktok/i);
  });

  it('renders website link when present', () => {
    const result = SellerSocialLinks({
      socialLinks: { website: 'https://salon.pl' },
    }) as React.ReactElement;
    const links = findLinks(result);
    expect(links).toHaveLength(1);
    expect(links[0].props.href).toBe('https://salon.pl');
    expect(links[0].props['aria-label']).toMatch(/strona/i);
  });

  it('renders only non-null links when partial', () => {
    const result = SellerSocialLinks({
      socialLinks: { instagram: 'https://instagram.com/salon', facebook: null, tiktok: null },
    }) as React.ReactElement;
    const links = findLinks(result);
    expect(links).toHaveLength(1);
    expect(links[0].props.href).toBe('https://instagram.com/salon');
  });

  it('renders all four links when all present', () => {
    const result = SellerSocialLinks({
      socialLinks: {
        instagram: 'https://instagram.com/salon',
        facebook: 'https://facebook.com/salon',
        tiktok: 'https://tiktok.com/@salon',
        website: 'https://salon.pl',
      },
    }) as React.ReactElement;
    const links = findLinks(result);
    expect(links).toHaveLength(4);
  });
});

describe('SellerSocialLinks — ARIA labels present (AC1)', () => {
  it('all links have aria-label', () => {
    const result = SellerSocialLinks({
      socialLinks: {
        instagram: 'https://instagram.com/salon',
        facebook: 'https://facebook.com/salon',
        tiktok: 'https://tiktok.com/@salon',
        website: 'https://salon.pl',
      },
    }) as React.ReactElement;
    const links = findLinks(result);
    for (const link of links) {
      expect(link.props['aria-label']).toBeTruthy();
    }
  });
});
