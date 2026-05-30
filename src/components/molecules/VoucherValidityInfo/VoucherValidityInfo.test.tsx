import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/icons', () => ({
  CalendarIcon: 'calendar-icon-mock',
}));

import { VoucherValidityInfo } from './VoucherValidityInfo';

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
    for (const child of children) {
      findAll(child, predicate, results);
    }
  }
  return results;
}

function findText(el: React.ReactNode, text: string): boolean {
  if (typeof el === 'string') return el.includes(text);
  if (React.isValidElement<Record<string, unknown>>(el)) {
    const element = el as ReactEl;
    const children = React.Children.toArray(element.props.children as React.ReactNode);
    return children.some(c => findText(c, text));
  }
  return false;
}

describe('VoucherValidityInfo', () => {
  it('returns null when both props are null', () => {
    expect(VoucherValidityInfo({ validityPeriod: null, defaultInfo: null })).toBeNull();
  });

  it('shows validityPeriod when provided', () => {
    const result = VoucherValidityInfo({ validityPeriod: '12 miesięcy', defaultInfo: null }) as ReactEl;
    expect(result).not.toBeNull();
    expect(findText(result, '12 miesięcy')).toBe(true);
  });

  it('shows defaultInfo as fallback when validityPeriod is null', () => {
    const result = VoucherValidityInfo({ validityPeriod: null, defaultInfo: 'Ważny 6 miesięcy' }) as ReactEl;
    expect(result).not.toBeNull();
    expect(findText(result, 'Ważny 6 miesięcy')).toBe(true);
  });

  it('validityPeriod wins over defaultInfo when both set', () => {
    const result = VoucherValidityInfo({
      validityPeriod: '12 miesięcy',
      defaultInfo: 'Ważny 6 miesięcy',
    }) as ReactEl;
    expect(findText(result, '12 miesięcy')).toBe(true);
    expect(findText(result, 'Ważny 6 miesięcy')).toBe(false);
  });

  it('renders calendar icon', () => {
    const result = VoucherValidityInfo({ validityPeriod: '12 miesięcy', defaultInfo: null }) as ReactEl;
    const icons = findAll(result, el => el.type === 'calendar-icon-mock');
    expect(icons).toHaveLength(1);
  });

  it('has bb-card-muted class on wrapper', () => {
    const result = VoucherValidityInfo({ validityPeriod: '12 miesięcy', defaultInfo: null }) as ReactEl;
    expect(result.props.className).toContain('bb-card-muted');
  });
});
