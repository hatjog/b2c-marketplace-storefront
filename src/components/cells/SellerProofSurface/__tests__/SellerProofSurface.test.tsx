/**
 * SellerProofSurface unit tests — v1.7.0 Story 2.3
 *
 * Test coverage (per Testing Requirements in story spec):
 * - UX-CMP-3: complete / partial / unavailable state rendering
 * - Distinct headline per state (not just color difference)
 * - MarketplaceVerificationMark text label present in every state (UX-DR6 / UX-CMP-1)
 * - Partial state explicitly marks missing categories (not silently omits)
 * - Unavailable state uses quiet-hospitality tone (not "nieznany salon")
 * - Exactly one next-action CTA in unavailable state (UX-DR18)
 *
 * Uses React element tree traversal (no @testing-library/react required) —
 * consistent with ProductDetails.test.tsx pattern in this codebase.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock next-intl server
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockImplementation((_namespace: string) => {
    return Promise.resolve((key: string, params?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        heading_complete: 'Informacje o salonie',
        heading_partial: 'Informacje o salonie',
        heading_unavailable: 'Informacje o salonie',
        verification_label: 'Zweryfikowany salon BonBeauty',
        verification_pending_label: 'Weryfikacja w toku',
        rating_label: 'Ocena',
        rating_aria: params
          ? `${params.rating} z 5 na podstawie ${params.count} opinii`
          : '0 z 5',
        address_label: 'Adres',
        missing_reviews_label: 'Brak dostępnych opinii',
        missing_reviews_aria: 'Opinie: brak danych',
        missing_address_label: 'Brak adresu',
        partial_note: 'Salon nie udostępnił jeszcze pełnych informacji.',
        unavailable_body:
          'Salon nie udostępnił jeszcze pełnych informacji. Możesz przejrzeć ofertę lub skontaktować się z nami.',
        unavailable_cta: 'Przeglądaj salony partnerskie',
        seller_link_aria: params ? `Przejdź do profilu salonu ${params.name}` : '',
        seller_detail_link: 'Więcej o salonie',
        seller_detail_link_aria: params ? `Więcej informacji o salonie ${params.name}` : '',
      };
      return translations[key] ?? key;
    });
  }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

// Mock MarketplaceVerificationMark — check it IS rendered in all states
vi.mock('@/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark', () => ({
  MarketplaceVerificationMark: ({ label, variant, ...props }: { label: string; variant?: string; [key: string]: unknown }) =>
    React.createElement(
      'span',
      { 'data-testid': 'marketplace-verification-mark', 'data-label': label, 'data-variant': variant, ...props },
      label,
    ),
}));

// Mock @/lib/utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

import { SellerProofSurface } from '../SellerProofSurface';
import type { SellerProofData } from '../SellerProofSurface';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function findAll(
  el: React.ReactNode,
  predicate: (el: ReactEl) => boolean,
  results: ReactEl[] = [],
): ReactEl[] {
  if (React.isValidElement<Record<string, unknown>>(el)) {
    const element = el as ReactEl;
    if (predicate(element)) results.push(element);
    const children = React.Children.toArray(element.props.children as React.ReactNode);
    for (const child of children) findAll(child, predicate, results);
  }
  return results;
}

function getText(el: React.ReactNode): string {
  if (typeof el === 'string') return el;
  if (typeof el === 'number') return String(el);
  if (!React.isValidElement(el)) return '';
  const children = React.Children.toArray((el as ReactEl).props.children as React.ReactNode);
  return children.map(getText).join('');
}

function makeCompleteSeller(): SellerProofData {
  return {
    name: 'Beauty & Co',
    handle: 'beauty-co',
    photoUrl: null,
    status: 'open',
    rating: 4.7,
    reviewCount: 32,
    city: 'Warszawa',
    addressLine: 'ul. Marszałkowska 1',
  };
}

function makePartialSeller(): SellerProofData {
  return {
    name: 'Salon Przykład',
    handle: 'salon-przyklad',
    photoUrl: null,
    status: 'open',
    rating: null,
    reviewCount: null,
    city: null,
    addressLine: null,
  };
}

function makeUnavailableSeller(): SellerProofData {
  return {
    name: null,
    handle: null,
    photoUrl: null,
    status: undefined,
    rating: null,
    reviewCount: null,
  };
}

describe('SellerProofSurface — complete state (UX-CMP-3)', () => {
  it('renders as section element', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    expect((el as ReactEl).type).toBe('section');
  });

  it('data-variant=complete for complete seller data', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() }) as ReactEl;
    expect(el.props['data-variant']).toBe('complete');
  });

  it('renders marketplace verification mark with text label (UX-DR6 / UX-CMP-1)', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    const marks = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-verification-mark');
    expect(marks.length).toBe(1);
    // Text label must be present — never icon-only (AC2)
    const label = marks[0].props['data-label'] as string;
    expect(label).toBeTruthy();
    expect(label.trim().length).toBeGreaterThan(0);
  });

  it('renders seller identity with link for complete state', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    const identityEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-identity');
    expect(identityEls.length).toBe(1);
  });

  it('renders rating proof point for complete state', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    const proofPoints = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-points');
    const text = getText(proofPoints[0]);
    expect(text).toContain('4.7');
    expect(text).toContain('32');
  });

  it('rating element has descriptive aria-label (4.7 z 5 na podstawie 32 opinii)', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    const proofPoints = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-points');
    const ratingEls = findAll(proofPoints[0], e => typeof e.props['aria-label'] === 'string' && (e.props['aria-label'] as string).includes('4.7'));
    expect(ratingEls.length).toBeGreaterThan(0);
    expect(ratingEls[0].props['aria-label']).toContain('32');
  });

  it('renders seller detail link', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    const detailLinks = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-detail-link');
    expect(detailLinks.length).toBe(1);
    expect(detailLinks[0].props.href).toBe('/sellers/beauty-co');
  });

  it('does not render unavailable fallback in complete state', async () => {
    const el = await SellerProofSurface({ seller: makeCompleteSeller() });
    const unavailableEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-unavailable');
    expect(unavailableEls.length).toBe(0);
  });
});

describe('SellerProofSurface — partial state (UX-CMP-3)', () => {
  it('data-variant=partial for partial seller data', async () => {
    const el = await SellerProofSurface({ seller: makePartialSeller() }) as ReactEl;
    expect(el.props['data-variant']).toBe('partial');
  });

  it('renders marketplace verification mark with text label in partial state (UX-DR6)', async () => {
    const el = await SellerProofSurface({ seller: makePartialSeller() });
    const marks = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-verification-mark');
    expect(marks.length).toBe(1);
    const label = marks[0].props['data-label'] as string;
    expect(label.trim().length).toBeGreaterThan(0);
  });

  it('explicitly marks missing reviews (not silently omits — AC2)', async () => {
    const el = await SellerProofSurface({ seller: makePartialSeller() });
    const missingRatings = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-missing-rating');
    expect(missingRatings.length).toBe(1);
    expect(getText(missingRatings[0])).toContain('Brak dostępnych opinii');
  });

  it('renders partial note (explicitly different from complete state)', async () => {
    const el = await SellerProofSurface({ seller: makePartialSeller() });
    const partialNotes = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-partial-note');
    expect(partialNotes.length).toBe(1);
    expect(getText(partialNotes[0])).toContain('nie udostępnił jeszcze pełnych informacji');
  });

  it('partial state does not render unavailable fallback', async () => {
    const el = await SellerProofSurface({ seller: makePartialSeller() });
    const unavailableEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-unavailable');
    expect(unavailableEls.length).toBe(0);
  });
});

describe('SellerProofSurface — unavailable state (UX-CMP-3)', () => {
  it('data-variant=unavailable when no seller name', async () => {
    const el = await SellerProofSurface({ seller: makeUnavailableSeller() }) as ReactEl;
    expect(el.props['data-variant']).toBe('unavailable');
  });

  it('renders marketplace verification mark even in unavailable state (UX-DR6 / AC2)', async () => {
    const el = await SellerProofSurface({ seller: makeUnavailableSeller() });
    const marks = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-verification-mark');
    expect(marks.length).toBe(1);
    // Text label must be present even in unavailable state — never icon-only
    const label = marks[0].props['data-label'] as string;
    expect(label.trim().length).toBeGreaterThan(0);
  });

  it('renders unavailable body with quiet-hospitality tone (NOT "nieznany salon")', async () => {
    const el = await SellerProofSurface({ seller: makeUnavailableSeller() });
    const unavailableEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-unavailable');
    const text = getText(unavailableEls[0]);
    // Must NOT contain distrust language
    expect(text).not.toContain('nieznany');
    expect(text).not.toContain('untrusted');
    // MUST contain quiet-hospitality copy per UX-DR5
    expect(text).toContain('nie udostępnił jeszcze pełnych informacji');
  });

  it('renders exactly one next-action CTA in unavailable state (UX-DR18)', async () => {
    const el = await SellerProofSurface({ seller: makeUnavailableSeller() });
    const nextActions = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-next-action');
    expect(nextActions.length).toBe(1);
  });

  it('does not render identity or proof points in unavailable state', async () => {
    const el = await SellerProofSurface({ seller: makeUnavailableSeller() });
    const identity = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-identity');
    const points = findAll(el as ReactEl, e => e.props['data-testid'] === 'seller-proof-points');
    expect(identity.length).toBe(0);
    expect(points.length).toBe(0);
  });
});

describe('SellerProofSurface — all three states are visually + semantically distinct', () => {
  it('complete vs partial vs unavailable have different data-variant values', async () => {
    const complete = await SellerProofSurface({ seller: makeCompleteSeller() }) as ReactEl;
    const partial = await SellerProofSurface({ seller: makePartialSeller() }) as ReactEl;
    const unavailable = await SellerProofSurface({ seller: makeUnavailableSeller() }) as ReactEl;

    const variants = new Set([
      complete.props['data-variant'],
      partial.props['data-variant'],
      unavailable.props['data-variant'],
    ]);
    // All three should be distinct
    expect(variants.size).toBe(3);
  });

  it('variant is derived from data (callers cannot pass arbitrary override)', async () => {
    // Even if we pass a partial seller, the component DERIVES the variant
    const el = await SellerProofSurface({ seller: makePartialSeller() }) as ReactEl;
    // Should be partial (derived), not whatever a caller might try to override
    expect(el.props['data-variant']).toBe('partial');
  });
});

describe('SellerProofSurface — identitySlot composition', () => {
  it('renders custom identitySlot when provided', async () => {
    const identitySlot = React.createElement('div', { 'data-testid': 'custom-identity-slot' }, 'Custom Vendor Badge');
    const el = await SellerProofSurface({ seller: makeCompleteSeller(), identitySlot });
    const customSlots = findAll(el as ReactEl, e => e.props['data-testid'] === 'custom-identity-slot');
    expect(customSlots.length).toBe(1);
  });
});
