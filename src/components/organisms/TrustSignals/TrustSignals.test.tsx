import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('next/link', () => ({
  default: 'a',
}));

import { TrustSignals } from './TrustSignals';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function resolveElement(el: ReactEl): React.ReactNode {
  if (typeof el.type === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (el.type as (props: any) => React.ReactNode)(el.props);
  }

  return el;
}

function findAll(
  el: React.ReactNode,
  predicate: (el: ReactEl) => boolean,
  results: ReactEl[] = [],
): ReactEl[] {
  if (React.isValidElement<Record<string, unknown>>(el)) {
    const element = resolveElement(el as ReactEl);
    if (!React.isValidElement<Record<string, unknown>>(element)) {
      return results;
    }

    const resolvedElement = element as ReactEl;
    if (predicate(resolvedElement)) results.push(resolvedElement);
    const children = React.Children.toArray(resolvedElement.props.children as React.ReactNode);
    for (const child of children) {
      findAll(child, predicate, results);
    }
  }
  return results;
}

function findText(el: React.ReactNode, text: string): boolean {
  if (typeof el === 'string') return el.includes(text);
  if (React.isValidElement<Record<string, unknown>>(el)) {
    const element = resolveElement(el as ReactEl);
    if (!React.isValidElement<Record<string, unknown>>(element)) {
      return false;
    }

    const resolvedElement = element as ReactEl;
    const innerHtml = (resolvedElement.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html;
    if (typeof innerHtml === 'string' && innerHtml.includes(text)) {
      return true;
    }
    const children = React.Children.toArray(resolvedElement.props.children as React.ReactNode);
    return children.some(c => findText(c, text));
  }
  return false;
}

describe('TrustSignals', () => {
  const signals = ['Signal 1', 'Signal 2', 'Signal 3'];

  it('renders null when signals is empty', () => {
    expect(TrustSignals({ variant: 'full', signals: [] })).toBeNull();
  });

  it('renders null for compact variant when signals is empty', () => {
    expect(TrustSignals({ variant: 'compact', signals: [] })).toBeNull();
  });

  it('full variant: wrapper has role=region and aria-label', () => {
    const result = TrustSignals({ variant: 'full', signals, detailsUrl: '/zasady' }) as ReactEl;
    expect(result.props.role).toBe('region');
    expect(result.props['aria-label']).toBe('Gwarancje BonBeauty');
  });

  it('full variant: renders checkmark spans for each signal', () => {
    const result = TrustSignals({ variant: 'full', signals, detailsUrl: '/zasady' }) as ReactEl;
    const checkmarks = findAll(result, el => el.type === 'span' && el.props.children === '✓');
    expect(checkmarks).toHaveLength(3);
  });

  it('full variant: renders Szczegóły link', () => {
    const result = TrustSignals({ variant: 'full', signals, detailsUrl: '/zasady' }) as ReactEl;
    const links = findAll(result, el => el.type === 'a');
    expect(links).toHaveLength(1);
    expect(links[0].props.href).toBe('/zasady');
    expect(findText(links[0], 'Szczegóły')).toBe(true);
  });

  it('full variant: no link when detailsUrl absent', () => {
    const result = TrustSignals({ variant: 'full', signals }) as ReactEl;
    const links = findAll(result, el => el.type === 'a');
    expect(links).toHaveLength(0);
  });

  it('full variant: 4 signals → only 3 shown (TRUST_SIGNALS_MAX)', () => {
    const fourSignals = ['A', 'B', 'C', 'D'];
    const result = TrustSignals({ variant: 'full', signals: fourSignals, detailsUrl: '/zasady' }) as ReactEl;
    const checkmarks = findAll(result, el => el.type === 'span' && el.props.children === '✓');
    expect(checkmarks).toHaveLength(3);
  });

  it('compact variant: wrapper has role=region and aria-label', () => {
    const result = TrustSignals({ variant: 'compact', signals }) as ReactEl;
    expect(result.props.role).toBe('region');
    expect(result.props['aria-label']).toBe('Gwarancje BonBeauty');
  });

  it('compact variant: no details link', () => {
    const result = TrustSignals({ variant: 'compact', signals, detailsUrl: '/zasady' }) as ReactEl;
    const links = findAll(result, el => el.type === 'a');
    expect(links).toHaveLength(0);
  });

  it('compact variant: renders all signal texts', () => {
    const result = TrustSignals({ variant: 'compact', signals }) as ReactEl;
    for (const signal of signals) {
      expect(findText(result, signal)).toBe(true);
    }
  });

  it('compact variant: renders checkmark for each signal', () => {
    const result = TrustSignals({ variant: 'compact', signals }) as ReactEl;
    const checkmarks = findAll(result, el => el.type === 'span' && el.props.children === '✓');
    expect(checkmarks).toHaveLength(3);
  });

  it('sanitizes partner-controlled HTML in signals', () => {
    const result = TrustSignals({
      variant: 'full',
      signals: ['Safe <strong>signal</strong><script>alert(1)</script>'],
    }) as ReactEl;
    const htmlNodes = findAll(
      result,
      el => typeof (el.props.dangerouslySetInnerHTML as { __html?: string } | undefined)?.__html === 'string'
    );

    expect(htmlNodes).toHaveLength(1);
    expect((htmlNodes[0].props.dangerouslySetInnerHTML as { __html: string }).__html).toContain('<strong>signal</strong>');
    expect((htmlNodes[0].props.dangerouslySetInnerHTML as { __html: string }).__html).not.toContain('<script>');
  });
});
