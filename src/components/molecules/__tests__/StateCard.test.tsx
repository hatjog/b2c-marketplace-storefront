/**
 * StateCard — unit tests
 *
 * v1.7.0 Story 2.1 AC3: Each variant (empty/error/unavailable) is visually
 * and semantically distinct with one clear next action.
 *
 * v1.7.0 Story 2.1 review fix (HIGH/2): tests rewritten to call the function
 * component directly so we inspect the RETURNED React element tree, not the
 * unrendered JSX wrapper. Previously `<StateCard.../>` produced an element of
 * type `StateCard` whose props were just the input props — assertions never
 * reached the actual implementation.
 *
 * Coverage:
 *   - empty variant: role="region", neutral surface class, icon+title+description
 *   - error variant: role="alert", aria-live="assertive", negative surface
 *   - unavailable variant: role="status", aria-live="polite", warning surface
 *   - action slot rendered when provided
 *   - custom icon overrides default icon
 *   - data-testid propagated
 *   - aria-label = title for SR
 *   - icon backgrounds use --bb-icon-bg-* tokens (review MEDIUM fix)
 *   - title rendered as h2 by default + heading-level prop (review LOW fix)
 *
 * UX-PAT-4 full-state coverage: each variant has distinct semantics.
 * Story 0.9 contract: no empty-as-failure masking (each variant is separate component).
 */
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { StateCard } from '../StateCard/StateCard';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const render = (props: Parameters<typeof StateCard>[0]) =>
  (StateCard as unknown as (p: typeof props) => ReactEl)(props);

function findByProp(
  node: React.ReactNode,
  propKey: string,
  propValue: unknown,
): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  const el = node as ReactEl;
  if (el.props[propKey] === propValue) return el;
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
  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, acc));
    return acc;
  }
  if (React.isValidElement<Record<string, unknown>>(node)) {
    collectText(node.props.children as React.ReactNode, acc);
  }
  return acc;
}

function findHeadingOfType(node: React.ReactNode, target: string | null): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  const el = node as ReactEl;
  const type = el.type;
  if (typeof type === 'string' && /^h[1-6]$/.test(type)) {
    if (target === null || type === target) return el;
  }
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    const found = findHeadingOfType(child, target);
    if (found) return found;
  }
  return null;
}

function findStyleWithBgVar(node: React.ReactNode, varName: string): ReactEl | null {
  if (!React.isValidElement<Record<string, unknown>>(node)) return null;
  const el = node as ReactEl;
  const style = el.props.style as Record<string, string> | undefined;
  if (style && typeof style.backgroundColor === 'string' && style.backgroundColor.includes(varName)) {
    return el;
  }
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    const found = findStyleWithBgVar(child, varName);
    if (found) return found;
  }
  return null;
}

describe('StateCard', () => {
  describe('empty variant', () => {
    it('renders role=region for non-critical empty content', () => {
      const root = render({ variant: 'empty', title: 'Brak produktów' });
      expect(root.props.role).toBe('region');
    });

    it('has aria-label matching title', () => {
      const root = render({ variant: 'empty', title: 'Brak wyników' });
      expect(root.props['aria-label']).toBe('Brak wyników');
    });

    it('renders title and description text', () => {
      const root = render({
        variant: 'empty',
        title: 'Koszyk jest pusty',
        description: 'Dodaj produkty, aby kontynuować',
      });
      const text = collectText(root);
      expect(text.join(' ')).toContain('Koszyk jest pusty');
      expect(text.join(' ')).toContain('Dodaj produkty, aby kontynuować');
    });

    it('renders without description when omitted', () => {
      const root = render({ variant: 'empty', title: 'Brak wyników' });
      const text = collectText(root);
      expect(text.join(' ')).toContain('Brak wyników');
    });

    it('uses neutral surface container classes', () => {
      const root = render({ variant: 'empty', title: 'test' });
      const className = String(root.props.className || '');
      expect(className).toContain('bg-secondary');
    });

    it('does not have aria-live (non-critical)', () => {
      const root = render({ variant: 'empty', title: 'Brak wyników' });
      expect(root.props['aria-live']).toBeUndefined();
    });
  });

  describe('error variant', () => {
    it('renders role=alert for error state', () => {
      const root = render({ variant: 'error', title: 'Wystąpił błąd' });
      expect(root.props.role).toBe('alert');
    });

    it('has aria-live=assertive for urgent announcement', () => {
      const root = render({ variant: 'error', title: 'Błąd serwera' });
      expect(root.props['aria-live']).toBe('assertive');
    });

    it('uses negative surface container classes', () => {
      const root = render({ variant: 'error', title: 'Błąd' });
      const className = String(root.props.className || '');
      expect(className).toContain('bg-negative-secondary');
    });
  });

  describe('unavailable variant', () => {
    it('renders role=status for unavailable state', () => {
      const root = render({ variant: 'unavailable', title: 'Produkt niedostępny' });
      expect(root.props.role).toBe('status');
    });

    it('has aria-live=polite for polite announcement', () => {
      const root = render({ variant: 'unavailable', title: 'Chwilowo niedostępne' });
      expect(root.props['aria-live']).toBe('polite');
    });

    it('uses warning surface container classes', () => {
      const root = render({ variant: 'unavailable', title: 'Niedostępne' });
      const className = String(root.props.className || '');
      expect(className).toContain('bg-warning-secondary');
    });
  });

  describe('action slot (UX-PAT-4: one clear next action)', () => {
    it('renders action when provided', () => {
      const root = render({
        variant: 'empty',
        title: 'Brak produktów',
        action: <button data-testid="cta-button">Przeglądaj</button>,
      });
      const found = findByProp(root, 'data-testid', 'cta-button');
      expect(found).not.toBeNull();
    });

    it('does not render action wrapper when action is omitted', () => {
      const root = render({ variant: 'empty', title: 'Brak produktów' });
      const found = findByProp(root, 'data-testid', 'cta-button');
      expect(found).toBeNull();
    });
  });

  describe('icon slot', () => {
    it('renders custom icon when provided', () => {
      const root = render({
        variant: 'empty',
        title: 'test',
        icon: <svg data-testid="custom-icon" />,
      });
      const found = findByProp(root, 'data-testid', 'custom-icon');
      expect(found).not.toBeNull();
    });
  });

  describe('data-testid', () => {
    it('defaults to state-card-{variant}', () => {
      const root = render({ variant: 'empty', title: 'test' });
      expect(root.props['data-testid']).toBe('state-card-empty');
    });

    it('accepts custom data-testid', () => {
      const root = render({ variant: 'error', title: 'test', 'data-testid': 'custom-state' });
      expect(root.props['data-testid']).toBe('custom-state');
    });
  });

  describe('Story 0.9 contract: no empty-as-failure masking', () => {
    it('empty and error produce different role', () => {
      const empty = render({ variant: 'empty', title: 'Brak' });
      const error = render({ variant: 'error', title: 'Błąd' });
      expect(empty.props.role).not.toBe(error.props.role);
    });

    it('error and unavailable produce different container classes', () => {
      const error = render({ variant: 'error', title: 'Błąd' });
      const unavail = render({ variant: 'unavailable', title: 'Niedostępne' });
      expect(error.props.className).not.toBe(unavail.props.className);
    });
  });

  describe('icon backgrounds use BonBeauty tokens (review MEDIUM fix)', () => {
    it('empty variant uses --bb-icon-bg-empty token', () => {
      const root = render({ variant: 'empty', title: 'X' });
      const wrapper = findStyleWithBgVar(root, '--bb-icon-bg-empty');
      expect(wrapper).not.toBeNull();
    });

    it('error variant uses --bb-icon-bg-error token (no hardcoded RGBA)', () => {
      const root = render({ variant: 'error', title: 'X' });
      const wrapper = findStyleWithBgVar(root, '--bb-icon-bg-error');
      expect(wrapper).not.toBeNull();
    });

    it('unavailable variant uses --bb-icon-bg-unavailable token', () => {
      const root = render({ variant: 'unavailable', title: 'X' });
      const wrapper = findStyleWithBgVar(root, '--bb-icon-bg-unavailable');
      expect(wrapper).not.toBeNull();
    });
  });

  describe('title heading semantics (review LOW fix)', () => {
    it('renders title as <h2> by default for landmark heading navigation', () => {
      const root = render({ variant: 'empty', title: 'Brak produktów' });
      const heading = findHeadingOfType(root, 'h2');
      expect(heading).not.toBeNull();
    });

    it('honors titleAs="h3" override', () => {
      const root = render({ variant: 'error', title: 'Błąd', titleAs: 'h3' });
      const heading = findHeadingOfType(root, 'h3');
      expect(heading).not.toBeNull();
    });
  });
});
