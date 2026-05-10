/**
 * StateCard — unit tests
 *
 * v1.7.0 Story 2.1 AC3: Each variant (empty/error/unavailable) is visually
 * and semantically distinct with one clear next action.
 *
 * Coverage:
 *   - empty variant: role="region", neutral surface class, icon+title+description
 *   - error variant: role="alert", aria-live="assertive", negative surface
 *   - unavailable variant: role="status", aria-live="polite", warning surface
 *   - action slot rendered when provided
 *   - custom icon overrides default icon
 *   - data-testid propagated
 *   - aria-label = title for SR
 *
 * UX-PAT-4 full-state coverage: each variant has distinct semantics.
 * Story 0.9 contract: no empty-as-failure masking (each variant is separate component).
 */
import React from 'react';
import { describe, expect, it } from 'vitest';

import { StateCard } from '../StateCard/StateCard';

type ReactEl = React.ReactElement<Record<string, unknown>>;

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

describe('StateCard', () => {
  describe('empty variant', () => {
    it('renders role=region for non-critical empty content', () => {
      const el = <StateCard variant="empty" title="Brak produktów" />;
      const root = el as ReactEl;
      expect(root.props.role).toBe('region');
    });

    it('has aria-label matching title', () => {
      const el = <StateCard variant="empty" title="Brak wyników" />;
      const root = el as ReactEl;
      expect(root.props['aria-label']).toBe('Brak wyników');
    });

    it('renders title and description text', () => {
      const el = <StateCard variant="empty" title="Koszyk jest pusty" description="Dodaj produkty, aby kontynuować" />;
      const text = collectText(el);
      expect(text.join(' ')).toContain('Koszyk jest pusty');
      expect(text.join(' ')).toContain('Dodaj produkty, aby kontynuować');
    });

    it('renders without description when omitted', () => {
      const el = <StateCard variant="empty" title="Brak wyników" />;
      const text = collectText(el);
      expect(text.join(' ')).toContain('Brak wyników');
    });

    it('uses neutral surface container classes', () => {
      const el = <StateCard variant="empty" title="test" />;
      const root = el as ReactEl;
      const className = String(root.props.className || '');
      expect(className).toContain('bg-secondary');
    });

    it('does not have aria-live (non-critical)', () => {
      const el = <StateCard variant="empty" title="Brak wyników" />;
      const root = el as ReactEl;
      expect(root.props['aria-live']).toBeUndefined();
    });
  });

  describe('error variant', () => {
    it('renders role=alert for error state', () => {
      const el = <StateCard variant="error" title="Wystąpił błąd" />;
      const root = el as ReactEl;
      expect(root.props.role).toBe('alert');
    });

    it('has aria-live=assertive for urgent announcement', () => {
      const el = <StateCard variant="error" title="Błąd serwera" />;
      const root = el as ReactEl;
      expect(root.props['aria-live']).toBe('assertive');
    });

    it('uses negative surface container classes', () => {
      const el = <StateCard variant="error" title="Błąd" />;
      const root = el as ReactEl;
      const className = String(root.props.className || '');
      expect(className).toContain('bg-negative-secondary');
    });
  });

  describe('unavailable variant', () => {
    it('renders role=status for unavailable state', () => {
      const el = <StateCard variant="unavailable" title="Produkt niedostępny" />;
      const root = el as ReactEl;
      expect(root.props.role).toBe('status');
    });

    it('has aria-live=polite for polite announcement', () => {
      const el = <StateCard variant="unavailable" title="Chwilowo niedostępne" />;
      const root = el as ReactEl;
      expect(root.props['aria-live']).toBe('polite');
    });

    it('uses warning surface container classes', () => {
      const el = <StateCard variant="unavailable" title="Niedostępne" />;
      const root = el as ReactEl;
      const className = String(root.props.className || '');
      expect(className).toContain('bg-warning-secondary');
    });
  });

  describe('action slot (UX-PAT-4: one clear next action)', () => {
    it('renders action when provided', () => {
      const action = <button data-testid="cta-button">Przeglądaj</button>;
      const el = <StateCard variant="empty" title="Brak produktów" action={action} />;
      const found = findByProp(el, 'data-testid', 'cta-button');
      expect(found).not.toBeNull();
    });

    it('does not render action wrapper when action is omitted', () => {
      const el = <StateCard variant="empty" title="Brak produktów" />;
      // No CTA button testid present
      const found = findByProp(el, 'data-testid', 'cta-button');
      expect(found).toBeNull();
    });
  });

  describe('icon slot', () => {
    it('renders custom icon when provided', () => {
      const customIcon = <svg data-testid="custom-icon" />;
      const el = <StateCard variant="empty" title="test" icon={customIcon} />;
      const found = findByProp(el, 'data-testid', 'custom-icon');
      expect(found).not.toBeNull();
    });
  });

  describe('data-testid', () => {
    it('defaults to state-card-{variant}', () => {
      const el = <StateCard variant="empty" title="test" />;
      const root = el as ReactEl;
      expect(root.props['data-testid']).toBe('state-card-empty');
    });

    it('accepts custom data-testid', () => {
      const el = <StateCard variant="error" title="test" data-testid="custom-state" />;
      const root = el as ReactEl;
      expect(root.props['data-testid']).toBe('custom-state');
    });
  });

  describe('Story 0.9 contract: no empty-as-failure masking', () => {
    it('empty and error produce different role', () => {
      const empty = (<StateCard variant="empty" title="Brak" />) as ReactEl;
      const error = (<StateCard variant="error" title="Błąd" />) as ReactEl;
      expect(empty.props.role).not.toBe(error.props.role);
    });

    it('error and unavailable produce different container classes', () => {
      const error = (<StateCard variant="error" title="Błąd" />) as ReactEl;
      const unavail = (<StateCard variant="unavailable" title="Niedostępne" />) as ReactEl;
      expect(error.props.className).not.toBe(unavail.props.className);
    });
  });
});
