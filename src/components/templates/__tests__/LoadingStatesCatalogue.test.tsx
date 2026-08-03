import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { LOADING_STATE_IDS } from '@/lib/wave5/catalogues';

import { LoadingStatesCatalogue } from '../LoadingStatesCatalogue';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function render(props: Parameters<typeof LoadingStatesCatalogue>[0]) {
  return (LoadingStatesCatalogue as unknown as (value: typeof props) => ReactEl)(props);
}

function collectPatternIds(node: React.ReactNode, acc: string[] = []): string[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return acc;
  const el = node as ReactEl;
  const testId = el.props['data-testid'];
  if (typeof testId === 'string' && testId.startsWith('loading-pattern-')) {
    acc.push(testId);
  }
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  children.forEach((child) => collectPatternIds(child, acc));
  return acc;
}

function collectBusyNodes(node: React.ReactNode): number {
  if (!React.isValidElement<Record<string, unknown>>(node)) return 0;
  const el = node as ReactEl;
  const hit =
    el.props['data-testid'] && String(el.props['data-testid']).startsWith('loading-pattern-')
      ? 1
      : 0;
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  return hit + children.reduce<number>((sum, child) => sum + collectBusyNodes(child), 0);
}

describe('LoadingStatesCatalogue', () => {
  it('renders all six LP patterns and exposes busy regions', () => {
    const root = render({
      title: 'Loading',
      description: 'Desc',
      patterns: LOADING_STATE_IDS.map((code) => ({
        code,
        title: code,
        body: 'Body',
      })),
    });

    expect(collectPatternIds(root)).toHaveLength(6);
    expect(collectBusyNodes(root)).toBe(6);
  });
});
