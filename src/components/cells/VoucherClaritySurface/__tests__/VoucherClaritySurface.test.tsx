/**
 * VoucherClaritySurface unit tests — v1.7.0 Story 2.3
 *
 * Test coverage (per Testing Requirements in story spec):
 * - UX-CMP-2 content assertions: price, voucher value, validity, realization rules,
 *   refund/cancellation, merchant identity and next action visible
 * - warning/pending and error/recovery variants: distinct headline, status text,
 *   exactly one next-action CTA, no raw API error visible
 * - Semantic rules list rendering (<ul>)
 * - Color-not-only-channel: status text present in every non-default state
 * - Variant API surface for condensed / warning / error (Stories 2.4/2.5/2.6 handoff)
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
        validity_to_confirm: 'Okres ważności zostanie potwierdzony.',
        validity_help_link: 'Zasady realizacji',
        realization_rules_label: 'Zasady realizacji',
        refund_policy_label: 'Polityka zwrotów i anulowania:',
        refund_policy_link: 'Sprawdź zasady',
        merchant_label: 'Salon',
        merchant_link_aria: params ? `Przejdź do profilu salonu ${params.name}` : 'Przejdź do profilu salonu',
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

// Mock @/icons
vi.mock('@/icons', () => ({
  CalendarIcon: () => React.createElement('span', { 'data-testid': 'calendar-icon' }),
}));

// Mock @/lib/utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | boolean | undefined | null)[]) =>
    classes.filter(Boolean).join(' '),
}));

import { VoucherClaritySurface } from '../VoucherClaritySurface';
import type { VoucherClaritySurfaceProps } from '../VoucherClaritySurface';

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

/** Flatten element tree to visible text string */
function getText(el: React.ReactNode): string {
  if (typeof el === 'string') return el;
  if (typeof el === 'number') return String(el);
  if (!React.isValidElement(el)) return '';
  const children = React.Children.toArray((el as ReactEl).props.children as React.ReactNode);
  return children.map(getText).join('');
}

function makeProps(overrides: Partial<VoucherClaritySurfaceProps> = {}): VoucherClaritySurfaceProps {
  return {
    title: 'Zabieg Złote Zawijanie',
    price: '250,00 zł',
    voucherValue: 'Voucher 300 zł',
    validityWording: '12 miesięcy od daty zakupu',
    realizationRules: [
      { text: 'Realizacja w salonie Beauty & Co' },
      { text: 'Wcześniejsza rezerwacja wymagana' },
    ],
    refundCancellationInfo: 'Możliwy zwrot do 14 dni od zakupu',
    merchantName: 'Beauty & Co',
    merchantHandle: 'beauty-co',
    variant: 'default' as const,
    ...overrides,
  };
}

describe('VoucherClaritySurface — UX-CMP-2 content assertions', () => {
  it('renders as a section element (semantic structure)', async () => {
    const el = await VoucherClaritySurface(makeProps());
    expect((el as ReactEl).type).toBe('section');
  });

  it('has aria-labelledby attribute (semantic section)', async () => {
    const el = await VoucherClaritySurface(makeProps()) as ReactEl;
    expect(el.props['aria-labelledby']).toBeTruthy();
  });

  it('has data-testid=voucher-clarity-surface', async () => {
    const el = await VoucherClaritySurface(makeProps()) as ReactEl;
    expect(el.props['data-testid']).toBe('voucher-clarity-surface');
  });

  it('title renders as h2 heading (UX-CMP-2: price visible context)', async () => {
    const el = await VoucherClaritySurface(makeProps({ title: 'Test Voucher' }));
    const headings = findAll(el as ReactEl, e => e.type === 'h2');
    expect(headings.length).toBeGreaterThan(0);
    const headingText = getText(headings[0]);
    expect(headingText).toContain('Test Voucher');
  });

  it('renders price in data-testid=voucher-clarity-price (UX-CMP-2: price visible)', async () => {
    const el = await VoucherClaritySurface(makeProps({ price: '250,00 zł' }));
    const priceEls = findAll(el as ReactEl, e => {
      return typeof e.props['data-testid'] === 'string' && e.props['data-testid'] === 'voucher-clarity-price';
    });
    expect(priceEls.length).toBe(1);
    expect(getText(priceEls[0])).toContain('250,00 zł');
  });

  it('renders voucher value (UX-CMP-2: voucher value visible)', async () => {
    const el = await VoucherClaritySurface(makeProps({ price: '250,00 zł', voucherValue: 'Voucher 300 zł' }));
    const priceEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-price');
    expect(getText(priceEls[0])).toContain('Voucher 300 zł');
  });

  it('renders validity in data-testid=voucher-clarity-validity', async () => {
    const el = await VoucherClaritySurface(makeProps({ validityWording: '12 miesięcy od daty zakupu' }));
    const validityEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-validity');
    expect(validityEls.length).toBe(1);
    expect(getText(validityEls[0])).toContain('12 miesięcy od daty zakupu');
  });

  it('shows validity-to-confirm fallback with link when no validityWording (one interaction away)', async () => {
    const el = await VoucherClaritySurface(makeProps({ validityWording: null }));
    const validityEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-validity');
    const text = getText(validityEls[0]);
    expect(text).toContain('Okres ważności zostanie potwierdzony.');
    // Help link present — Link component has href prop (may be wrapped as component, not 'a' in tree)
    const links = findAll(validityEls[0], e => typeof e.props['href'] === 'string');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders realization rules as semantic <ul> list (not concatenated string)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      realizationRules: [
        { text: 'Reguła pierwsza' },
        { text: 'Reguła druga' },
      ],
    }));
    const rulesEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-rules');
    expect(rulesEls.length).toBe(1);
    const lists = findAll(rulesEls[0], e => e.type === 'ul');
    expect(lists.length).toBe(1);
    const items = findAll(lists[0], e => e.type === 'li');
    expect(items.length).toBe(2);
    expect(getText(items[0])).toContain('Reguła pierwsza');
    expect(getText(items[1])).toContain('Reguła druga');
  });

  it('does not render rules section when realizationRules is empty', async () => {
    const el = await VoucherClaritySurface(makeProps({ realizationRules: [] }));
    const rulesEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-rules');
    expect(rulesEls.length).toBe(0);
  });

  it('renders refund/cancellation info (UX-CMP-2: refund visible)', async () => {
    const el = await VoucherClaritySurface(makeProps({ refundCancellationInfo: 'Zwrot do 14 dni' }));
    const refundEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-refund');
    expect(refundEls.length).toBe(1);
    expect(getText(refundEls[0])).toContain('Zwrot do 14 dni');
  });

  it('shows refund policy link when no refundCancellationInfo (one interaction away)', async () => {
    const el = await VoucherClaritySurface(makeProps({ refundCancellationInfo: null }));
    const refundEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-refund');
    // Link component has href prop (may be component reference, not 'a' string in tree)
    const links = findAll(refundEls[0], e => typeof e.props['href'] === 'string');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders merchant identity (UX-CMP-2: merchant identity visible)', async () => {
    const el = await VoucherClaritySurface(makeProps({ merchantName: 'Beauty & Co', merchantHandle: 'beauty-co' }));
    const merchantEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-merchant');
    expect(merchantEls.length).toBe(1);
    expect(getText(merchantEls[0])).toContain('Beauty & Co');
  });

  it('merchant renders as link to /sellers/[handle]', async () => {
    const el = await VoucherClaritySurface(makeProps({ merchantName: 'Beauty & Co', merchantHandle: 'beauty-co' }));
    const merchantEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-merchant');
    // Link has href prop — search by href rather than element type
    const links = findAll(merchantEls[0], e => typeof e.props['href'] === 'string' && (e.props['href'] as string).includes('/sellers/'));
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].props.href).toBe('/sellers/beauty-co');
  });

  it('renders CTA slot when provided (UX-CMP-2: next action visible)', async () => {
    const ctaSlot = React.createElement('button', { 'data-testid': 'test-cta' }, 'Podaruj tę chwilę');
    const el = await VoucherClaritySurface(makeProps({ ctaSlot }));
    const ctaEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-cta');
    expect(ctaEls.length).toBe(1);
  });
});

describe('VoucherClaritySurface — warning/pending variant (UX-DR21: not color-only)', () => {
  it('renders status banner with text label (not color-only)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'warning',
      status: {
        kind: 'unavailable',
        message: 'Voucher tymczasowo niedostępny',
        nextAction: { href: '/categories', label: 'Wróć do listy' },
      },
    }));
    const banners = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-status-banner');
    expect(banners.length).toBe(1);
    // Text label must be present (not color-only — AC1 + UX-DR21)
    expect(getText(banners[0])).toContain('Voucher tymczasowo niedostępny');
  });

  it('renders status banner with role=status (live region for AT)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'warning',
      status: { kind: 'unavailable', message: 'Voucher tymczasowo niedostępny' },
    }));
    const statusEls = findAll(el as ReactEl, e => e.props['role'] === 'status');
    expect(statusEls.length).toBeGreaterThan(0);
  });

  it('renders exactly one next-action CTA for warning variant (UX-DR18)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'warning',
      status: {
        kind: 'unavailable',
        message: 'Voucher tymczasowo niedostępny',
        nextAction: { href: '/categories', label: 'Wróć do listy' },
      },
    }));
    const ctas = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-next-action');
    expect(ctas.length).toBe(1);
  });

  it('data-variant=warning for warning state', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'warning',
      status: { kind: 'unavailable', message: 'Niedostępny' },
    })) as ReactEl;
    expect(el.props['data-variant']).toBe('warning');
  });

  it('does NOT contain raw API errors or variant codes (UX-DR18)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'warning',
      status: { kind: 'unavailable', message: 'Voucher tymczasowo niedostępny' },
    }));
    const text = getText(el as ReactEl);
    expect(text).not.toContain('500');
    expect(text).not.toContain('variant_id');
    expect(text).not.toContain('inventory_quantity');
    expect(text).not.toContain('TypeError');
  });
});

describe('VoucherClaritySurface — error/recovery variant', () => {
  it('renders status banner with distinct headline for error variant', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'error',
      status: {
        kind: 'expired',
        message: 'Voucher niedostępny',
        nextAction: { href: '/categories', label: 'Wróć do listy' },
      },
    }));
    const banners = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-status-banner');
    expect(getText(banners[0])).toContain('Voucher niedostępny');
  });

  it('renders exactly one next-action CTA for error variant (UX-DR18)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'error',
      status: {
        kind: 'expired',
        message: 'Voucher niedostępny',
        nextAction: { href: '/categories', label: 'Wróć do listy' },
      },
    }));
    const ctas = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-next-action');
    expect(ctas.length).toBe(1);
  });

  it('data-variant=error for error state (distinct from warning)', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'error',
      status: { kind: 'expired', message: 'Niedostępny' },
    })) as ReactEl;
    expect(el.props['data-variant']).toBe('error');
  });
});

describe('VoucherClaritySurface — condensed variant (for Stories 2.4/2.5/2.6)', () => {
  it('does not render realization rules in condensed variant', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'condensed',
      realizationRules: [{ text: 'Zasada realizacji' }],
    }));
    const rulesEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-rules');
    expect(rulesEls.length).toBe(0);
  });

  it('does not render refund/cancellation in condensed variant', async () => {
    const el = await VoucherClaritySurface(makeProps({
      variant: 'condensed',
      refundCancellationInfo: 'Zwrot do 14 dni',
    }));
    const refundEls = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-refund');
    expect(refundEls.length).toBe(0);
  });

  it('data-variant=condensed for condensed state', async () => {
    const el = await VoucherClaritySurface(makeProps({ variant: 'condensed' })) as ReactEl;
    expect(el.props['data-variant']).toBe('condensed');
  });
});

describe('VoucherClaritySurface — default state does not render status banner', () => {
  it('no status banner in default variant', async () => {
    const el = await VoucherClaritySurface(makeProps({ variant: 'default', status: undefined }));
    const banners = findAll(el as ReactEl, e => e.props['data-testid'] === 'voucher-clarity-status-banner');
    expect(banners.length).toBe(0);
  });
});
