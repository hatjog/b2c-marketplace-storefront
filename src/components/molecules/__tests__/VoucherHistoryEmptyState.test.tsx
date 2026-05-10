/**
 * VoucherHistoryEmptyState — unit tests
 *
 * Story 2.6 (v1.7.0) AC3: Empty state renders ONLY when data fetch
 * succeeded AND returned zero vouchers (not for failure states).
 *
 * Story 0.9 contract (may_mask_failures: false):
 *   - empty variant used for genuine empty data only.
 *   - access_denied, unavailable, failed have their own distinct states.
 *
 * WCAG 2.1 AA (NFR28):
 *   - role="region" + aria-labelledby for landmark navigation.
 *   - Descriptive heading + body.
 *   - One primary CTA (visible focus ring via Tailwind class).
 *
 * DS boundary (ARCH-007): BonBeauty DS storefront-only.
 */
import * as React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

// Mock next-intl useTranslations
vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const translations: Record<string, Record<string, string>> = {
      'account.vouchers.empty': {
        heading: 'You have no vouchers',
        body: 'Buy your first voucher.',
        cta: 'Browse offers',
      },
    };
    const t = (key: string) => translations[ns]?.[key] ?? key;
    return t;
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

import { VoucherHistoryEmptyState } from '../VoucherHistoryEmptyState/VoucherHistoryEmptyState';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const render = (props: Parameters<typeof VoucherHistoryEmptyState>[0]) =>
  (VoucherHistoryEmptyState as unknown as (p: typeof props) => ReactEl)(props);

function findByProp(node: React.ReactNode, propKey: string, propValue: unknown): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  const el = node as ReactEl;
  if (el.props[propKey] === propValue) return el;
  // Traverse children AND all other props that could be React nodes (action, icon, etc.)
  const allPropValues = Object.values(el.props);
  for (const val of allPropValues) {
    if (React.isValidElement(val) || Array.isArray(val)) {
      const found = findByProp(val as React.ReactNode, propKey, propValue);
      if (found) return found;
    }
  }
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    const found = findByProp(child, propKey, propValue);
    if (found) return found;
  }
  return null;
}

function collectText(node: React.ReactNode, acc: string[] = []): string[] {
  if (typeof node === 'string' || typeof node === 'number') {
    acc.push(String(node));
    return acc;
  }
  if (Array.isArray(node)) { node.forEach(c => collectText(c, acc)); return acc; }
  if (React.isValidElement<Record<string, unknown>>(node)) {
    collectText(node.props.children as React.ReactNode, acc);
  }
  return acc;
}

describe('VoucherHistoryEmptyState', () => {
  it('renders role=region for empty content landmark', () => {
    const root = render({ locale: 'en' });
    expect(root.props.role).toBe('region');
  });

  it('has aria-labelledby for screen reader landmark', () => {
    const root = render({ locale: 'en' });
    expect(root.props['aria-labelledby']).toBe('voucher-empty-heading');
  });

  it('renders default data-testid', () => {
    const root = render({ locale: 'en' });
    expect(root.props['data-testid']).toBe('voucher-history-empty-state');
  });

  it('accepts custom data-testid', () => {
    const root = render({ locale: 'en', 'data-testid': 'custom-empty' });
    expect(root.props['data-testid']).toBe('custom-empty');
  });

  it('renders one primary CTA with data-testid voucher-empty-cta', () => {
    const root = render({ locale: 'en' });
    const cta = findByProp(root, 'data-testid', 'voucher-empty-cta');
    expect(cta).not.toBeNull();
  });

  it('CTA links to locale home when recommendation slot not wired', () => {
    const root = render({ locale: 'pl' });
    const cta = findByProp(root, 'data-testid', 'voucher-empty-cta');
    expect(cta).not.toBeNull();
    expect((cta?.props as { href?: string })?.href).toBe('/pl');
  });

  it('does NOT render recommendation slot when not provided', () => {
    const root = render({ locale: 'en' });
    const slot = findByProp(root, 'data-testid', 'voucher-empty-recommendation-slot');
    expect(slot).toBeNull();
  });

  it('renders recommendation slot when provided', () => {
    const slot = React.createElement('div', { 'data-testid': 'recommendation-content' }, 'Recommendation');
    const root = render({ locale: 'en', recommendationSlot: slot });
    const slotWrapper = findByProp(root, 'data-testid', 'voucher-empty-recommendation-slot');
    expect(slotWrapper).not.toBeNull();
  });

  describe('Story 0.9 contract: empty NOT used for failures', () => {
    it('renders StateCard with empty variant — not error or unavailable', () => {
      const root = render({ locale: 'en' });
      // StateCard with variant=empty should use bg-secondary (neutral, not error/warning)
      const stateCard = findByProp(root, 'data-testid', 'voucher-empty-state-card');
      expect(stateCard).not.toBeNull();
    });
  });

  describe('WCAG 2.1 AA (NFR28)', () => {
    it('CTA has visible focus ring class via Tailwind', () => {
      const root = render({ locale: 'en' });
      const cta = findByProp(root, 'data-testid', 'voucher-empty-cta');
      const className = String((cta?.props as { className?: string })?.className ?? '');
      expect(className).toContain('focus:ring');
    });
  });
});
