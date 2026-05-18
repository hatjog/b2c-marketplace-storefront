import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');
  return {
    ...actual,
    useState: vi.fn(),
  };
});

vi.mock('@/lib/utils', () => ({
  cn: (...classes: Array<string | undefined | null | false>) => classes.filter(Boolean).join(' '),
}));

import { VoucherRulesCard } from '../VoucherRulesCard/VoucherRulesCard';

type ReactEl = React.ReactElement<Record<string, unknown>>;

function findAll(node: React.ReactNode, predicate: (el: ReactEl) => boolean): ReactEl[] {
  const results: ReactEl[] = [];
  if (!node || typeof node !== 'object') return results;

  if (React.isValidElement<Record<string, unknown>>(node)) {
    const el = node as ReactEl;
    if (predicate(el)) results.push(el);

    const children = React.Children.toArray(el.props.children as React.ReactNode);
    for (const child of children) {
      results.push(...findAll(child, predicate));
    }
  }

  return results;
}

function collectText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (!React.isValidElement<Record<string, unknown>>(node)) return '';
  return React.Children.toArray(node.props.children as React.ReactNode).map(collectText).join('');
}

describe('VoucherRulesCard', () => {
  it('renders collapsed by default with aria-expanded=false', () => {
    vi.mocked(React.useState).mockReturnValueOnce([false, vi.fn()]);

    const el = VoucherRulesCard({ locale: 'pl', 'data-testid': 'voucher-rules-card' }) as ReactEl;
    const button = findAll(el, element => element.type === 'button')[0];

    expect(el.props['data-testid']).toBe('voucher-rules-card');
    expect(button.props['aria-expanded']).toBe(false);
    expect(collectText(button.props.children)).toContain('Zasady vouchera');
  });

  it('renders expanded content with localized summary when open', () => {
    vi.mocked(React.useState).mockReturnValueOnce([true, vi.fn()]);

    const el = VoucherRulesCard({
      locale: 'en',
      defaultOpen: true,
      rules: {
        validityMonths: 12,
        extension: {
          allowed: true,
          paid: true,
          feePct: 15,
          maxExtensionMonths: 3,
        },
        cancellation: 'Cancel with the salon at least 24h in advance.',
        refundChannel: 'Refund back to the original payment method.',
        noShow: 'Missing the appointment without notice may void the voucher.',
      },
    }) as ReactEl;

    const button = findAll(el, element => element.type === 'button')[0];
    const text = collectText(el);

    expect(button.props['aria-expanded']).toBe(true);
    expect(text).toContain('Voucher valid for 12 months');
    expect(text).toContain('You can extend the voucher by 3 months for an extra 15%.');
    expect(text).toContain('Refund back to the original payment method.');
  });
});
