/**
 * Chip — unit tests
 *
 * v1.7.0 Story 2.1 AC3 + review HIGH/2: covers default / hover / selected /
 * disabled / color states. Hover class must be the token-bound
 * `hover:bg-component-secondary` (NOT raw `hover:bg-gray-200`).
 *
 * Coverage matrix:
 *   - selected → border-primary class
 *   - disabled → cursor-not-allowed + text-disabled, no hover bg, tabIndex=-1
 *   - hover precedence: selected wins over hover (no hover class when selected)
 *   - color swatch: w-40px + h-40px applied; backgroundColor inline style
 *   - data-disabled attribute reflects disabled prop
 */
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from '../Chip/Chip';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const callChip = (props: Parameters<typeof Chip>[0]) =>
  (Chip as unknown as (p: typeof props) => ReactEl)(props);

describe('Chip', () => {
  describe('default / hover (token-bound)', () => {
    it('applies hover:bg-component-secondary when not disabled and not selected', () => {
      const rendered = callChip({ value: 'M' });
      expect(String(rendered.props.className)).toContain('hover:bg-component-secondary');
    });

    it('does NOT use raw hover:bg-gray-200 (Story 2.1 token migration)', () => {
      const rendered = callChip({ value: 'M' });
      expect(String(rendered.props.className)).not.toContain('hover:bg-gray-200');
    });
  });

  describe('selected state', () => {
    it('applies border-primary', () => {
      const rendered = callChip({ value: 'M', selected: true });
      expect(String(rendered.props.className)).toContain('border-primary');
    });

    it('does NOT apply hover bg when selected (precedence)', () => {
      const rendered = callChip({ value: 'M', selected: true });
      expect(String(rendered.props.className)).not.toContain('hover:bg-component-secondary');
    });
  });

  describe('disabled state', () => {
    it('applies cursor-not-allowed + text-disabled and tabIndex=-1', () => {
      const rendered = callChip({ value: 'M', disabled: true });
      expect(String(rendered.props.className)).toContain('cursor-not-allowed');
      expect(String(rendered.props.className)).toContain('text-disabled');
      expect(rendered.props.tabIndex).toBe(-1);
    });

    it('exposes data-disabled="true" attribute', () => {
      const rendered = callChip({ value: 'M', disabled: true });
      expect(rendered.props['data-disabled']).toBe(true);
    });

    it('does not invoke onSelect when disabled', () => {
      const onSelect = vi.fn();
      const rendered = callChip({ value: 'M', disabled: true, onSelect });
      // onClick is undefined when disabled
      expect(rendered.props.onClick).toBeUndefined();
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('color swatch', () => {
    it('renders 40x40 frame and inline backgroundColor on swatch span', () => {
      const rendered = callChip({ value: '#FF0000', color: true });
      expect(String(rendered.props.className)).toContain('w-[40px]');
      expect(String(rendered.props.className)).toContain('h-[40px]');
      const child = rendered.props.children as ReactEl;
      expect(React.isValidElement(child)).toBe(true);
      const style = (child.props as Record<string, unknown>).style as Record<string, unknown> | undefined;
      expect(style?.backgroundColor).toBe('#FF0000');
    });
  });

  describe('default data-testid', () => {
    it('defaults to "chip"', () => {
      const rendered = callChip({ value: 'M' });
      expect(rendered.props['data-testid']).toBe('chip');
    });

    it('accepts data-testid override', () => {
      const rendered = callChip({ value: 'M', 'data-testid': 'size-chip-M' });
      expect(rendered.props['data-testid']).toBe('size-chip-M');
    });
  });

  describe('role and keyboard reachability', () => {
    it('renders role="button"', () => {
      const rendered = callChip({ value: 'M' });
      expect(rendered.props.role).toBe('button');
    });

    it('tabIndex=0 by default (focusable)', () => {
      const rendered = callChip({ value: 'M' });
      expect(rendered.props.tabIndex).toBe(0);
    });
  });

  // v1.7.0 Story 2.1 review-2 fix (HIGH/1, WCAG SC 2.1.1): role="button" with
  // onClick must also accept keyboard activation (Enter / Space).
  describe('keyboard activation (review-2 HIGH/1, WCAG SC 2.1.1)', () => {
    it('invokes onSelect on Enter', () => {
      const onSelect = vi.fn();
      const rendered = callChip({ value: 'M', onSelect });
      const handler = rendered.props.onKeyDown as (e: unknown) => void;
      expect(typeof handler).toBe('function');
      const event = { key: 'Enter', preventDefault: vi.fn() };
      handler(event);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('invokes onSelect on Space', () => {
      const onSelect = vi.fn();
      const rendered = callChip({ value: 'M', onSelect });
      const handler = rendered.props.onKeyDown as (e: unknown) => void;
      const event = { key: ' ', preventDefault: vi.fn() };
      handler(event);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does not invoke onSelect on other keys', () => {
      const onSelect = vi.fn();
      const rendered = callChip({ value: 'M', onSelect });
      const handler = rendered.props.onKeyDown as (e: unknown) => void;
      const event = { key: 'a', preventDefault: vi.fn() };
      handler(event);
      expect(onSelect).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not register keyboard handler when disabled', () => {
      const onSelect = vi.fn();
      const rendered = callChip({ value: 'M', onSelect, disabled: true });
      expect(rendered.props.onKeyDown).toBeUndefined();
    });

    it('sets aria-pressed when selected', () => {
      const rendered = callChip({ value: 'M', selected: true });
      expect(rendered.props['aria-pressed']).toBe(true);
    });

    it('sets aria-disabled when disabled', () => {
      const rendered = callChip({ value: 'M', disabled: true });
      expect(rendered.props['aria-disabled']).toBe(true);
    });
  });

  // v1.7.0 Story 2.1 review-2 fix (MEDIUM/3): color-swatch background only
  // accepts string `value` (CSS color literal); non-string values are ignored
  // (no `[object Object]` style leak).
  describe('color swatch typing (review-2 MEDIUM/3)', () => {
    it('does not set inline backgroundColor when value is not a string', () => {
      const rendered = callChip({ value: 42 as unknown as string, color: true });
      const child = rendered.props.children as ReactEl;
      const style = (child.props as Record<string, unknown>).style as Record<string, unknown> | undefined;
      expect(style?.backgroundColor).toBeUndefined();
    });
  });
});
