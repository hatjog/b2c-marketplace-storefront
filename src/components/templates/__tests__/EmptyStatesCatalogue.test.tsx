import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { EMPTY_STATE_PATTERN_IDS } from '@/lib/wave5/catalogues';

import { EmptyStatesCatalogue } from '../EmptyStatesCatalogue';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function render(props: Parameters<typeof EmptyStatesCatalogue>[0]) {
  return (EmptyStatesCatalogue as unknown as (value: typeof props) => ReactEl)(props);
}

function countByTestId(node: React.ReactNode, prefix: string): number {
  if (!React.isValidElement<Record<string, unknown>>(node)) return 0;
  const el = node as ReactEl;
  const hit = typeof el.props['data-testid'] === 'string' && String(el.props['data-testid']).startsWith(prefix) ? 1 : 0;
  const children = React.Children.toArray(el.props.children as React.ReactNode);
  return hit + children.reduce<number>((sum, child) => sum + countByTestId(child, prefix), 0);
}

describe('EmptyStatesCatalogue', () => {
  it('renders all eight ES patterns', () => {
    const root = render({
      locale: 'pl',
      title: 'Catalogue',
      description: 'Desc',
      patterns: EMPTY_STATE_PATTERN_IDS.map((id, index) => ({
        id,
        code: `ES${index + 1}`,
        title: `Pattern ${index + 1}`,
        body: 'Body',
        note: 'Passive',
      })),
    });

    expect(countByTestId(root, 'empty-pattern-')).toBe(8);
  });
});
