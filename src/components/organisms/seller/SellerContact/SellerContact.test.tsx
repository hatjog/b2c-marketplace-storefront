import React from 'react';
import { describe, expect, it } from 'vitest';

import { SellerContact } from './SellerContact';

type ReactEl = React.ReactElement<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Tree traversal helper
// ---------------------------------------------------------------------------

function findAll(
  element: ReactEl | null,
  predicate: (el: ReactEl) => boolean,
): ReactEl[] {
  if (!element || !React.isValidElement<Record<string, unknown>>(element)) return [];
  const el = element as ReactEl;
  const results: ReactEl[] = [];
  if (predicate(el)) results.push(el);
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    if (React.isValidElement<Record<string, unknown>>(child)) {
      results.push(...findAll(child as ReactEl, predicate));
    }
  }
  return results;
}

function findLinks(root: ReactEl): ReactEl[] {
  return findAll(root, el => el.type === 'a');
}

function findText(root: React.ReactElement | null, text: string): boolean {
  if (!root) return false;
  const str = JSON.stringify(root);
  return str.includes(text);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SellerContact — phone link (AC2)', () => {
  it('renders phone as tel: link', () => {
    const result = SellerContact({ phone: '+48 123 456 789' }) as ReactEl;
    const links = findLinks(result);
    const telLink = links.find(l => String(l.props.href).startsWith('tel:'));
    expect(telLink).toBeDefined();
    expect(telLink!.props.href).toBe('tel:+48 123 456 789');
  });

  it('tel link has aria-label', () => {
    const result = SellerContact({ phone: '+48 111 222 333' }) as ReactEl;
    const links = findLinks(result);
    const telLink = links.find(l => String(l.props.href).startsWith('tel:'));
    expect(telLink!.props['aria-label']).toBeTruthy();
  });
});

describe('SellerContact — email link (AC2)', () => {
  it('renders email as mailto: link', () => {
    const result = SellerContact({ email: 'salon@example.com' }) as ReactEl;
    const links = findLinks(result);
    const mailLink = links.find(l => String(l.props.href).startsWith('mailto:'));
    expect(mailLink).toBeDefined();
    expect(mailLink!.props.href).toBe('mailto:salon@example.com');
  });

  it('mailto link has aria-label', () => {
    const result = SellerContact({ email: 'test@test.pl' }) as ReactEl;
    const links = findLinks(result);
    const mailLink = links.find(l => String(l.props.href).startsWith('mailto:'));
    expect(mailLink!.props['aria-label']).toBeTruthy();
  });
});

describe('SellerContact — both phone and email (AC2)', () => {
  it('renders both tel and mailto links', () => {
    const result = SellerContact({
      phone: '+48 111 222 333',
      email: 'test@test.pl',
    }) as ReactEl;
    const links = findLinks(result);
    const hrefs = links.map(l => String(l.props.href));
    expect(hrefs.some(h => h.startsWith('tel:'))).toBe(true);
    expect(hrefs.some(h => h.startsWith('mailto:'))).toBe(true);
  });
});

describe('SellerContact — fallback (AC2)', () => {
  it('renders BonBeauty fallback when both phone and email are null', () => {
    const result = SellerContact({ phone: null, email: null }) as ReactEl;
    expect(findText(result, 'BonBeauty')).toBe(true);
  });

  it('renders BonBeauty fallback when no props provided', () => {
    const result = SellerContact({}) as ReactEl;
    expect(findText(result, 'BonBeauty')).toBe(true);
  });

  it('does NOT render fallback when only phone is provided', () => {
    const result = SellerContact({ phone: '+48 999 888 777' }) as ReactEl;
    expect(findText(result, 'BonBeauty')).toBe(false);
  });

  it('does NOT render fallback when only email is provided', () => {
    const result = SellerContact({ email: 'a@b.pl' }) as ReactEl;
    expect(findText(result, 'BonBeauty')).toBe(false);
  });
});
