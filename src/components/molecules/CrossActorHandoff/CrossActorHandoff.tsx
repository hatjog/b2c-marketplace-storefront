/**
 * CrossActorHandoff — Trust Presence Invariant #5 implementation.
 *
 * v1.8.0 Story 1.5: Payment Status Surface 6 States.
 *
 * Surfaces dual-actor transparency: what the customer should do NOW (forYou)
 * and what the system is doing on their behalf (forUs). W1-08 payment-status
 * cross-actor section per UX SSOT.
 *
 * Presentational only — no client directive, no hooks.
 * Labels (labelForYou/labelForUs) are passed from parent with i18n context (M4 fix).
 */

import React from 'react';

export interface CrossActorHandoffProps {
  forYou: string;
  forUs: string;
  /** Localized label for "Co dalej dla Ciebie:" — passed from parent useTranslations context */
  labelForYou?: string;
  /** Localized label for "Co dalej dla nas:" — passed from parent useTranslations context */
  labelForUs?: string;
  'data-testid'?: string;
}

export function CrossActorHandoff({
  forYou,
  forUs,
  labelForYou = 'Co dalej dla Ciebie:',
  labelForUs = 'Co dalej dla nas:',
  'data-testid': testId = 'cross-actor-handoff',
}: CrossActorHandoffProps): React.ReactElement {
  return (
    <div
      className="rounded-sm border border-[var(--bb-border-pending,#e2e0db)] bg-stone-50 px-4 py-3 text-sm text-secondary"
      data-testid={testId}
    >
      <div className="space-y-1.5">
        <p>
          <span className="font-medium text-primary">{labelForYou}</span>{' '}
          {forYou}
        </p>
        <p>
          <span className="font-medium text-primary">{labelForUs}</span>{' '}
          {forUs}
        </p>
      </div>
    </div>
  );
}
