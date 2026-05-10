import * as React from 'react';

import { describe, expect, it } from 'vitest';

import {
  CrossActorSyncBanner,
  type CrossActorSyncBannerProps,
  type CrossActorSyncVariant
} from '../CrossActorSyncBanner';

type ReactEl = React.ReactElement<Record<string, unknown>>;

const renderBanner = (props: CrossActorSyncBannerProps) =>
  (CrossActorSyncBanner as unknown as (p: CrossActorSyncBannerProps) => ReactEl)(props);

const getText = (node: React.ReactNode): string => {
  if (typeof node === 'string') {
    return node;
  }

  if (typeof node === 'number') {
    return String(node);
  }

  if (!React.isValidElement<Record<string, unknown>>(node)) {
    return '';
  }

  return React.Children.toArray(node.props.children as React.ReactNode)
    .map(getText)
    .join('');
};

const findByTestId = (node: React.ReactNode, testId: string): ReactEl | null => {
  if (!React.isValidElement<Record<string, unknown>>(node)) {
    return null;
  }

  const element = node as ReactEl;
  if (element.props['data-testid'] === testId) {
    return element;
  }

  for (const child of React.Children.toArray(element.props.children as React.ReactNode)) {
    const result = findByTestId(child, testId);
    if (result) {
      return result;
    }
  }

  return null;
};

describe('CrossActorSyncBanner type contract', () => {
  it('accepts sync_pending and stale as valid variant values', () => {
    const syncPending: CrossActorSyncVariant = 'sync_pending';
    const stale: CrossActorSyncVariant = 'stale';
    expect(syncPending).toBe('sync_pending');
    expect(stale).toBe('stale');
  });

  it('renders sync-pending as accessible status with UX State Contract fields', () => {
    const root = renderBanner({
      variant: 'sync_pending',
      stateOwner: 'salon-user',
      sourceOfTruth: 'Mercur voucher API',
      message: 'Voucher status may be temporarily out of sync.',
      'data-testid': 'voucher-cross-actor-sync-banner',
      action: React.createElement(
        'a',
        { 'data-testid': 'safe-next-action', href: '/pl/user/vouchers' },
        'Go to vouchers list'
      )
    });

    expect(root.props.role).toBe('status');
    expect(root.props['aria-live']).toBe('polite');
    expect(root.props['data-testid']).toBe('voucher-cross-actor-sync-banner');
    expect(root.props['data-sync-variant']).toBe('sync_pending');
    expect(root.props['data-state-owner']).toBe('salon-user');
    expect(root.props['data-source-of-truth']).toBe('Mercur voucher API');
    expect(getText(root)).toContain('Voucher status may be temporarily out of sync.');
    expect(findByTestId(root, 'safe-next-action')?.props.href).toBe('/pl/user/vouchers');
  });

  it('renders stale without collapsing to a generic empty or error state', () => {
    const root = renderBanner({
      variant: 'stale',
      stateOwner: 'admin',
      sourceOfTruth: 'Medusa order API',
      message: 'Order state may be stale.'
    });

    expect(root.props.role).toBe('status');
    expect(root.props['data-sync-variant']).toBe('stale');
    expect(root.props['data-state-owner']).toBe('admin');
    expect(root.props['data-source-of-truth']).toBe('Medusa order API');
    expect(getText(root)).toContain('Order state may be stale.');
    expect(root.props.role).not.toBe('alert');
  });
});
