import React from 'react';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs } from './Breadcrumbs';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function findAll(
  element: React.ReactNode,
  predicate: (el: ReactEl) => boolean,
): ReactEl[] {
  if (!React.isValidElement(element)) return [];
  const results: ReactEl[] = [];
  if (predicate(element as ReactEl)) results.push(element as ReactEl);
  const children = React.Children.toArray(
    (element as ReactEl).props.children as React.ReactNode,
  );
  for (const child of children) {
    results.push(...findAll(child, predicate));
  }
  return results;
}

function findFirst(
  element: React.ReactNode,
  predicate: (el: ReactEl) => boolean,
): ReactEl | null {
  const all = findAll(element, predicate);
  return all.length > 0 ? all[0] : null;
}

function collectTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  const children = React.Children.toArray(
    (node as ReactEl).props.children as React.ReactNode,
  );
  return children.map(collectTextContent).join('');
}

const HOME = { label: 'Strona główna', href: '/' };
const CAT = { label: 'Masaże', href: '/kategoria/masaze' };
const PRODUCT = { label: 'Masaż gorącymi kamieniami', href: '/products/masaz' };

describe('Breadcrumbs', () => {
  it('returns null when items array is empty', () => {
    const result = Breadcrumbs({ items: [] });
    expect(result).toBeNull();
  });

  it('renders <nav aria-label="Breadcrumb"> as root element', () => {
    const result = Breadcrumbs({ items: [HOME, CAT] }) as ReactEl;
    expect(result).not.toBeNull();
    expect(result.type).toBe('nav');
    expect(result.props['aria-label']).toBe('Breadcrumb');
  });

  it('renders all item labels for full items array', () => {
    const result = Breadcrumbs({ items: [HOME, CAT, PRODUCT] }) as ReactEl;
    const text = collectTextContent(result);
    expect(text).toContain(HOME.label);
    expect(text).toContain(CAT.label);
    expect(text).toContain(PRODUCT.label);
  });

  it('renders single item without separator', () => {
    const result = Breadcrumbs({ items: [HOME] }) as ReactEl;
    const separators = findAll(
      result,
      (el) =>
        el.type === 'span' &&
        el.props['aria-hidden'] === 'true' &&
        collectTextContent(el) === '>',
    );
    expect(separators).toHaveLength(0);
  });

  it('renders both items for 2-item array on any screen size (no truncation)', () => {
    const result = Breadcrumbs({ items: [HOME, CAT] }) as ReactEl;
    const text = collectTextContent(result);
    expect(text).toContain(HOME.label);
    expect(text).toContain(CAT.label);
    // No ellipsis element for 2 items
    const ellipsis = findAll(
      result,
      (el) =>
        el.type === 'li' &&
        typeof el.props.className === 'string' &&
        el.props.className.includes('sm:hidden'),
    );
    expect(ellipsis).toHaveLength(0);
  });

  it('includes mobile ellipsis ol for 3+ items (mobile truncation)', () => {
    const result = Breadcrumbs({ items: [HOME, CAT, PRODUCT] }) as ReactEl;
    // Mobile ellipsis is rendered as a second <ol> with aria-hidden="true"
    const mobileOl = findFirst(
      result,
      (el) =>
        el.type === 'ol' &&
        el.props['aria-hidden'] === 'true',
    );
    expect(mobileOl).not.toBeNull();
    const text = collectTextContent(mobileOl!);
    expect(text).toContain('…');
  });

  it('hides middle items on mobile using hidden sm:inline-flex class', () => {
    const result = Breadcrumbs({ items: [HOME, CAT, PRODUCT] }) as ReactEl;
    const middleLi = findFirst(
      result,
      (el) =>
        el.type === 'li' &&
        typeof el.props.className === 'string' &&
        el.props.className.includes('hidden sm:inline-flex'),
    );
    expect(middleLi).not.toBeNull();
    const text = collectTextContent(middleLi!);
    expect(text).toContain(CAT.label);
  });

  it('injects <script type="application/ld+json"> with BreadcrumbList schema', () => {
    const result = Breadcrumbs({ items: [HOME, CAT] }) as ReactEl;
    const scriptEl = findFirst(
      result,
      (el) =>
        el.type === 'script' && el.props.type === 'application/ld+json',
    );
    expect(scriptEl).not.toBeNull();
    const rawContent = scriptEl!.props.children as string;
    const parsed = JSON.parse(rawContent);
    expect(parsed['@type']).toBe('BreadcrumbList');
    expect(parsed['@context']).toBe('https://schema.org');
  });

  it('JSON-LD itemListElement contains correct position and name for each item', () => {
    const items = [HOME, CAT, PRODUCT];
    const result = Breadcrumbs({ items }) as ReactEl;
    const scriptEl = findFirst(
      result,
      (el) => el.type === 'script' && el.props.type === 'application/ld+json',
    )!;
    const parsed = JSON.parse(scriptEl.props.children as string);
    const elements = parsed.itemListElement as Array<{
      '@type': string;
      position: number;
      name: string;
    }>;
    expect(elements).toHaveLength(3);
    expect(elements[0].position).toBe(1);
    expect(elements[0].name).toBe(HOME.label);
    expect(elements[1].position).toBe(2);
    expect(elements[1].name).toBe(CAT.label);
    expect(elements[2].position).toBe(3);
    expect(elements[2].name).toBe(PRODUCT.label);
  });
});
