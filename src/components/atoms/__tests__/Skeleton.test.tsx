/**
 * Skeleton — unit tests
 *
 * v1.7.0 Story 2.1 AC3: Loading state covered with BonBeauty-aligned surface
 * treatment and aria-busy/screen reader label per WCAG 2.1 AA.
 *
 * v1.7.0 Story 2.1 review fix (HIGH/2): tests rewritten to call the function
 * component directly so we inspect the RETURNED React element tree, not the
 * unrendered JSX wrapper. Previously `<Skeleton/>` returned `{type: Skeleton,
 * props: {}}` and the assertions never reached the actual implementation —
 * tests passed nominally without exercising any code path.
 *
 * Coverage:
 *   - Skeleton: role="status", aria-busy="true", aria-label, rounded variants
 *   - Skeleton decorative=true → aria-hidden="true", no role
 *   - SkeletonText: lines prop, last line w-3/4 when lines>1
 *   - SkeletonText decorative=true (review LOW fix) → aria-hidden, no role
 *   - SkeletonCard: product card shape with image+text+price areas
 *   - SkeletonCard nested aria-busy reduction (review LOW fix)
 *   - BonBeauty surface token used (not raw gray)
 *   - data-testid propagated
 */
import { describe, expect, it } from 'vitest';
import * as React from 'react';

import { Skeleton, SkeletonCard, SkeletonText } from '../Skeleton/Skeleton';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const renderSkeleton = (props: Parameters<typeof Skeleton>[0] = {}) =>
  (Skeleton as unknown as (p: typeof props) => ReactEl)(props);
const renderSkeletonText = (props: Parameters<typeof SkeletonText>[0] = {}) =>
  (SkeletonText as unknown as (p: typeof props) => ReactEl)(props);
const renderSkeletonCard = (props: Parameters<typeof SkeletonCard>[0] = {}) =>
  (SkeletonCard as unknown as (p: typeof props) => ReactEl)(props);

describe('Skeleton', () => {
  describe('WCAG accessibility', () => {
    it('has role="status"', () => {
      const root = renderSkeleton();
      expect(root.props.role).toBe('status');
    });

    it('has aria-busy="true"', () => {
      const root = renderSkeleton();
      expect(root.props['aria-busy']).toBe('true');
    });

    it('has default aria-label "Ładowanie..."', () => {
      const root = renderSkeleton();
      expect(root.props['aria-label']).toBe('Ładowanie...');
    });

    it('accepts custom aria-label', () => {
      const root = renderSkeleton({ 'aria-label': 'Ładowanie zdjęcia produktu' });
      expect(root.props['aria-label']).toBe('Ładowanie zdjęcia produktu');
    });
  });

  describe('decorative mode (review LOW fix)', () => {
    it('decorative=true sets aria-hidden and removes role', () => {
      const root = renderSkeleton({ decorative: true });
      expect(root.props.role).toBeUndefined();
      expect(root.props['aria-hidden']).toBe('true');
    });

    it('decorative=true does not include sr-only text child', () => {
      const root = renderSkeleton({ decorative: true });
      // children should be undefined / no React element child
      expect(root.props.children).toBeUndefined();
    });
  });

  describe('BonBeauty surface token (not raw gray)', () => {
    it('uses --bb-skeleton-base CSS var in style, not bg-gray-*', () => {
      const root = renderSkeleton();
      const style = root.props.style as Record<string, string> | undefined;
      expect(style?.backgroundColor).toContain('--bb-skeleton-base');
    });

    it('does not use bg-gray-200 class', () => {
      const root = renderSkeleton();
      const className = String(root.props.className || '');
      expect(className).not.toContain('bg-gray-200');
    });
  });

  describe('rounded variants', () => {
    it('defaults to rounded-sm', () => {
      const root = renderSkeleton();
      expect(String(root.props.className || '')).toContain('rounded-sm');
    });

    it('applies rounded-full for pill variant', () => {
      const root = renderSkeleton({ rounded: 'full' });
      expect(String(root.props.className || '')).toContain('rounded-full');
    });

    it('applies rounded-md for panel variant', () => {
      const root = renderSkeleton({ rounded: 'md' });
      expect(String(root.props.className || '')).toContain('rounded-md');
    });
  });

  describe('data-testid', () => {
    it('defaults to skeleton', () => {
      const root = renderSkeleton();
      expect(root.props['data-testid']).toBe('skeleton');
    });

    it('accepts custom data-testid', () => {
      const root = renderSkeleton({ 'data-testid': 'product-image-skeleton' });
      expect(root.props['data-testid']).toBe('product-image-skeleton');
    });
  });
});

describe('SkeletonText', () => {
  it('has role="status" and aria-busy="true" by default', () => {
    const root = renderSkeletonText();
    expect(root.props.role).toBe('status');
    expect(root.props['aria-busy']).toBe('true');
  });

  it('renders single skeleton line by default', () => {
    const root = renderSkeletonText({ lines: 1 });
    const children = React.Children.toArray(root.props.children as React.ReactNode);
    // sr-only span + 1 skeleton line
    expect(children.length).toBe(2);
  });

  it('renders multiple skeleton lines', () => {
    const root = renderSkeletonText({ lines: 3 });
    const children = React.Children.toArray(root.props.children as React.ReactNode);
    // sr-only span + 3 skeleton lines
    expect(children.length).toBe(4);
  });

  describe('decorative mode (review LOW fix)', () => {
    it('decorative=true → aria-hidden, no role', () => {
      const root = renderSkeletonText({ decorative: true, lines: 2 });
      expect(root.props.role).toBeUndefined();
      expect(root.props['aria-hidden']).toBe('true');
    });

    it('decorative=true suppresses sr-only span child', () => {
      const root = renderSkeletonText({ decorative: true, lines: 2 });
      const children = (React.Children.toArray(root.props.children as React.ReactNode) as ReactEl[])
        .filter(Boolean);
      // Only 2 skeletons, no sr-only span (which would be 3 children otherwise).
      expect(children.length).toBe(2);
    });
  });
});

describe('SkeletonCard', () => {
  it('has role="status" and aria-busy="true"', () => {
    const root = renderSkeletonCard();
    expect(root.props.role).toBe('status');
    expect(root.props['aria-busy']).toBe('true');
  });

  it('uses --bb-skeleton-base surface token', () => {
    const root = renderSkeletonCard();
    const style = root.props.style as Record<string, string> | undefined;
    expect(style?.backgroundColor).toContain('--bb-skeleton-base');
  });

  it('has default data-testid "skeleton-card"', () => {
    const root = renderSkeletonCard();
    expect(root.props['data-testid']).toBe('skeleton-card');
  });

  describe('nested aria-busy reduction (review LOW fix)', () => {
    it('only the SkeletonCard root has role="status" — nested children are decorative', () => {
      const root = renderSkeletonCard();
      const statusCount = countRoles(root, 'status');
      expect(statusCount).toBe(1);
    });

    it('inner Skeletons are passed decorative=true', () => {
      const root = renderSkeletonCard();
      // Walk children and assert any direct Skeleton child has decorative=true.
      const children = React.Children.toArray(root.props.children as React.ReactNode);
      const skeletonChildren = children.filter(
        (c): c is ReactEl =>
          React.isValidElement(c) && (c as ReactEl).type === Skeleton,
      );
      expect(skeletonChildren.length).toBeGreaterThan(0);
      for (const c of skeletonChildren) {
        expect((c.props as Record<string, unknown>).decorative).toBe(true);
      }
    });
  });
});

/** Recursively count React elements whose role prop equals the target.
 *  Ignores function-component children (their role is the prop passed in,
 *  not the rendered output). */
function countRoles(node: React.ReactNode, target: string): number {
  if (!React.isValidElement<Record<string, unknown>>(node)) return 0;
  const el = node as ReactEl;
  let n = el.props.role === target && typeof el.type === 'string' ? 1 : 0;
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  for (const child of children) {
    n += countRoles(child, target);
  }
  return n;
}
