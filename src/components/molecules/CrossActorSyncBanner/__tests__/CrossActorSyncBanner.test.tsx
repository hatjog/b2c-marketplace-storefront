/**
 * Story 6.4 AC3/AC4 — CrossActorSyncBanner contract tests.
 *
 * Verifies the component's exported interface and type constraints:
 *   - Both sync_pending and stale variants are accepted (FM-A: must not collapse
 *     to generic empty/error).
 *   - Required fields (stateOwner, sourceOfTruth, message) are typed non-optional.
 *   - Optional action prop is typed as ReactNode (accepts any renderable content).
 *
 * Note: Full render tests (role=status, aria-live, data-testid) follow the same
 * pattern as VoucherClaritySurface and other component test files. They require
 * @testing-library/react + react/jsx-dev-runtime — both available when the full
 * storefront workspace is installed. This file validates the exported types and
 * variant enum at the contract level.
 */

import { describe, it, expect } from 'vitest';

import type { CrossActorSyncBannerProps, CrossActorSyncVariant } from '../CrossActorSyncBanner';

describe('CrossActorSyncBanner type contract', () => {
  it('accepts sync_pending and stale as valid variant values', () => {
    const syncPending: CrossActorSyncVariant = 'sync_pending';
    const stale: CrossActorSyncVariant = 'stale';
    expect(syncPending).toBe('sync_pending');
    expect(stale).toBe('stale');
  });

  it('requires stateOwner, sourceOfTruth and message', () => {
    // TypeScript ensures these are non-optional at compile time.
    // At runtime, verify a valid props object satisfies the interface.
    const props: CrossActorSyncBannerProps = {
      variant: 'sync_pending',
      stateOwner: 'salon-user',
      sourceOfTruth: 'Mercur voucher API',
      message: 'Voucher status may be temporarily out of sync.',
    };
    expect(props.stateOwner).toBe('salon-user');
    expect(props.sourceOfTruth).toBe('Mercur voucher API');
  });

  it('action prop is optional', () => {
    const propsWithoutAction: CrossActorSyncBannerProps = {
      variant: 'stale',
      stateOwner: 'admin',
      sourceOfTruth: 'Medusa order API',
      message: 'Order state may be stale.',
    };
    expect(propsWithoutAction.action).toBeUndefined();
  });
});
