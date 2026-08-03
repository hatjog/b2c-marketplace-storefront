/**
 * Badge — unit tests
 *
 * v1.7.0 Story 2.1 AC3 + review HIGH/2: variants render token-bound
 * className chain, brand variant uses --gold-light + --brand-800 RGB tuple
 * (not hardcoded RGBA — review MEDIUM fix).
 *
 * Coverage matrix:
 *   - default / success / error / warning / info / brand / muted / unavailable
 *   - default data-testid is `badge-<variant>`
 *   - brand variant: variantStyles uses var(--gold-light) and var(--brand-800)
 *   - unavailable: visually distinct (opacity-60 + bg-disabled)
 */
import type * as React from 'react';
import { describe, expect, it } from 'vitest';

import { Badge } from '../Badge/Badge';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const callBadge = (props: Parameters<typeof Badge>[0]) =>
  (Badge as unknown as (p: typeof props) => ReactEl)(props);

describe('Badge', () => {
  describe('variant token wiring', () => {
    it.each([
      ['default', 'bg-action'],
      ['success', 'bg-positive-secondary'],
      ['error', 'bg-negative-secondary'],
      ['warning', 'bg-warning-secondary'],
      ['info', 'bg-blue-50'],
      ['muted', 'bg-secondary'],
      // v1.7.0 Story 2.1 review-2 fix (HIGH/2): unavailable now uses the warning
      // channel + dashed border (was bg-disabled — same antipattern fixed on Button).
      ['unavailable', 'bg-warning-secondary'],
    ] as const)('variant=%s wires class %s', (variant, expectedClass) => {
      const rendered = callBadge({ children: 'X', variant });
      expect(String(rendered.props.className)).toContain(expectedClass);
    });
  });

  describe('brand variant — token-bound style (review MEDIUM fix)', () => {
    it('uses var(--gold-light) for backgroundColor', () => {
      const rendered = callBadge({ children: 'X', variant: 'brand' });
      const style = rendered.props.style as Record<string, string> | undefined;
      expect(style?.backgroundColor).toContain('--gold-light');
    });

    it('uses var(--brand-800) RGB tuple for color (NOT hardcoded rgba(83,65,29))', () => {
      const rendered = callBadge({ children: 'X', variant: 'brand' });
      const style = rendered.props.style as Record<string, string> | undefined;
      expect(style?.color).toContain('--brand-800');
      // Negative assertion: must not be the bare literal anymore.
      expect(style?.color).not.toBe('rgba(83, 65, 29, 1)');
    });
  });

  describe('default data-testid', () => {
    it.each(['default', 'success', 'error', 'warning'] as const)(
      'variant=%s → data-testid=badge-<variant>',
      (variant) => {
        const rendered = callBadge({ children: 'X', variant });
        expect(rendered.props['data-testid']).toBe(`badge-${variant}`);
      },
    );

    it('accepts data-testid override', () => {
      const rendered = callBadge({ children: 'X', 'data-testid': 'shipping-status' });
      expect(rendered.props['data-testid']).toBe('shipping-status');
    });
  });

  describe('unavailable variant (Story 0.9 contract — visually distinct)', () => {
    // v1.7.0 Story 2.1 review-2 fix (HIGH/2): unavailable now uses the warning
    // channel + dashed border (non-color signal) — same pattern as Button.unavailable.
    it('uses warning-channel surface (not disabled token)', () => {
      const rendered = callBadge({ children: 'X', variant: 'unavailable' });
      const className = String(rendered.props.className);
      expect(className).toContain('bg-warning-secondary');
      expect(className).toContain('text-warning');
    });

    it('includes a dashed border as a non-color signal', () => {
      const rendered = callBadge({ children: 'X', variant: 'unavailable' });
      expect(String(rendered.props.className)).toContain('border-dashed');
    });

    it('produces a distinct className from the muted variant', () => {
      const unavailable = callBadge({ children: 'X', variant: 'unavailable' });
      const muted = callBadge({ children: 'X', variant: 'muted' });
      expect(unavailable.props.className).not.toEqual(muted.props.className);
    });

    it('no longer reuses the bg-disabled/text-disabled disabled-style surface', () => {
      const rendered = callBadge({ children: 'X', variant: 'unavailable' });
      const className = String(rendered.props.className);
      expect(className).not.toContain('bg-disabled');
      expect(className).not.toContain('text-disabled');
    });
  });
});
