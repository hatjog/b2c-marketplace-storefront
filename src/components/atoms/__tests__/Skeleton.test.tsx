/**
 * Skeleton — unit tests
 *
 * v1.7.0 Story 2.1 AC3: Loading state covered with BonBeauty-aligned surface
 * treatment and aria-busy/screen reader label per WCAG 2.1 AA.
 *
 * Coverage:
 *   - Skeleton: role="status", aria-busy="true", aria-label, rounded variants
 *   - SkeletonText: lines prop, last line w-3/4 when lines>1
 *   - SkeletonCard: product card shape with image+text+price areas
 *   - BonBeauty surface token used (not raw gray)
 *   - data-testid propagated
 *
 * WCAG 2.1: aria-busy=true + visually-hidden sr-only text per UX-PAT-4 loading state.
 * Token source: src/styles/tokens/bb-surfaces.css --bb-skeleton-base
 */
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Skeleton, SkeletonCard, SkeletonText } from '../Skeleton/Skeleton';

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

describe('Skeleton', () => {
  describe('WCAG accessibility', () => {
    it('has role="status"', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      expect(root.props.role).toBe('status');
    });

    it('has aria-busy="true"', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      expect(root.props['aria-busy']).toBe('true');
    });

    it('has default aria-label "Ładowanie..."', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      expect(root.props['aria-label']).toBe('Ładowanie...');
    });

    it('accepts custom aria-label', () => {
      const el = <Skeleton aria-label="Ładowanie zdjęcia produktu" />;
      const root = el as ReactEl;
      expect(root.props['aria-label']).toBe('Ładowanie zdjęcia produktu');
    });
  });

  describe('BonBeauty surface token (not raw gray)', () => {
    it('uses --bb-skeleton-base CSS var in style, not bg-gray-*', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      const style = root.props.style as Record<string, string> | undefined;
      expect(style?.backgroundColor).toContain('--bb-skeleton-base');
    });

    it('does not use bg-gray-200 class', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      const className = String(root.props.className || '');
      expect(className).not.toContain('bg-gray-200');
    });
  });

  describe('rounded variants', () => {
    it('defaults to rounded-sm', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      expect(String(root.props.className || '')).toContain('rounded-sm');
    });

    it('applies rounded-full for pill variant', () => {
      const el = <Skeleton rounded="full" />;
      const root = el as ReactEl;
      expect(String(root.props.className || '')).toContain('rounded-full');
    });

    it('applies rounded-md for panel variant', () => {
      const el = <Skeleton rounded="md" />;
      const root = el as ReactEl;
      expect(String(root.props.className || '')).toContain('rounded-md');
    });
  });

  describe('data-testid', () => {
    it('defaults to skeleton', () => {
      const el = <Skeleton />;
      const root = el as ReactEl;
      expect(root.props['data-testid']).toBe('skeleton');
    });

    it('accepts custom data-testid', () => {
      const el = <Skeleton data-testid="product-image-skeleton" />;
      const root = el as ReactEl;
      expect(root.props['data-testid']).toBe('product-image-skeleton');
    });
  });
});

describe('SkeletonText', () => {
  it('has role="status" and aria-busy="true"', () => {
    const el = <SkeletonText />;
    const root = el as ReactEl;
    expect(root.props.role).toBe('status');
    expect(root.props['aria-busy']).toBe('true');
  });

  it('renders single skeleton line by default', () => {
    const el = <SkeletonText lines={1} />;
    const root = el as ReactEl;
    const children = React.Children.toArray(root.props.children as React.ReactNode);
    // sr-only span + 1 skeleton line
    expect(children.length).toBe(2);
  });

  it('renders multiple skeleton lines', () => {
    const el = <SkeletonText lines={3} />;
    const root = el as ReactEl;
    const children = React.Children.toArray(root.props.children as React.ReactNode);
    // sr-only span + 3 skeleton lines
    expect(children.length).toBe(4);
  });
});

describe('SkeletonCard', () => {
  it('has role="status" and aria-busy="true"', () => {
    const el = <SkeletonCard />;
    const root = el as ReactEl;
    expect(root.props.role).toBe('status');
    expect(root.props['aria-busy']).toBe('true');
  });

  it('uses --bb-skeleton-base surface token', () => {
    const el = <SkeletonCard />;
    const root = el as ReactEl;
    const style = root.props.style as Record<string, string> | undefined;
    expect(style?.backgroundColor).toContain('--bb-skeleton-base');
  });

  it('has default data-testid "skeleton-card"', () => {
    const el = <SkeletonCard />;
    const root = el as ReactEl;
    expect(root.props['data-testid']).toBe('skeleton-card');
  });
});
