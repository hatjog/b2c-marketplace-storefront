/**
 * CrossActorSyncBanner — Story 6.4 AC4
 *
 * Renders a sync-pending or stale-data indicator when storefront state derived
 * from another actor (salon-user, admin, vendor) may not yet be reflected.
 *
 * UX State Contract fields (architecture §UX State Contract):
 *   state_owner     — actor whose mutation drives the state change
 *   source_of_truth — canonical data source for the displayed value
 *
 * Accessibility: role="status" + aria-live="polite" per WCAG 2.1 AA AC4.
 * FM-A discipline: sync-pending/stale MUST NOT be rendered as generic empty or
 * generic error states. This component renders a neutral, user-safe message with
 * one safe next action.
 *
 * DS boundary (ARCH-007): customer-facing storefront only.
 */

import type { ReactNode } from 'react';

export type CrossActorSyncVariant = 'sync_pending' | 'stale';

export interface CrossActorSyncBannerProps {
  /** UX State Contract: actor who owns the state transition. */
  stateOwner: string;
  /** UX State Contract: canonical data source for the displayed value. */
  sourceOfTruth: string;
  /** Variant drives copy and visual weight. */
  variant: CrossActorSyncVariant;
  /** Neutral user-facing message (no actor-internal info). */
  message: string;
  /** One safe user-appropriate next action (optional). */
  action?: ReactNode;
  /** data-testid for focused tests. */
  'data-testid'?: string;
}

export function CrossActorSyncBanner({
  stateOwner,
  sourceOfTruth,
  variant,
  message,
  action,
  'data-testid': testId = 'cross-actor-sync-banner'
}: CrossActorSyncBannerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={testId}
      data-sync-variant={variant}
      data-state-owner={stateOwner}
      data-source-of-truth={sourceOfTruth}
      className="flex flex-col gap-2 rounded-sm border border-tertiary bg-secondary px-4 py-3 text-sm text-secondary"
    >
      <span>{message}</span>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
