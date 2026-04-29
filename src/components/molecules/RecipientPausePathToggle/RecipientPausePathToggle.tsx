'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { pauseRecipient } from '@/actions/voucher-consent';
import {
  createPersistedStateMachine,
  type PersistedStateMachine
} from '@/lib/state-machine/create-persisted-state-machine';

/**
 * <RecipientPausePathToggle> — UX-DR5 SC-3 ambivalence pause path.
 *
 * 5-state machine per Pattern 5 (consent-moment-spec.md):
 *   default → considering → paused → timeout → withdrawn
 *
 * Transitions (sole legal events):
 *   default     → considering    on `START_CONSIDERING`
 *   considering → paused         on `PAUSE`
 *   considering → default        on `CANCEL`
 *   paused      → timeout        on `EXPIRE`
 *   paused      → considering    on `RESUME`
 *   paused      → withdrawn      on `WITHDRAW`
 *   timeout     → withdrawn      on `WITHDRAW`
 *
 * AC mappings:
 *   AC-VPII-2.1-07 — 5-state happy path; AC-RECIPIENT-PAUSE-PATH-01.
 *   AC-VPII-2.1-03 — every visible string from next-intl `voucher.consent.pause.*`.
 *
 * Telemetry: each transition emits `pauseRecipient` Server Action with
 * the new pause-state label. Storage holds state name + timestamps only —
 * NEVER PII (Risk #5 mitigation).
 */

export type PauseState = 'default' | 'considering' | 'paused' | 'timeout' | 'withdrawn';
export type PauseEvent =
  | 'START_CONSIDERING'
  | 'CANCEL'
  | 'PAUSE'
  | 'EXPIRE'
  | 'RESUME'
  | 'WITHDRAW';

export const PAUSE_TRANSITIONS = {
  default: { START_CONSIDERING: 'considering' },
  considering: { PAUSE: 'paused', CANCEL: 'default' },
  paused: { EXPIRE: 'timeout', RESUME: 'considering', WITHDRAW: 'withdrawn' },
  timeout: { WITHDRAW: 'withdrawn' },
  withdrawn: {}
} as const satisfies Record<PauseState, Partial<Record<PauseEvent, PauseState>>>;

export interface RecipientPausePathToggleProps {
  token: string;
  locale: string;
  /** Optional initial state for SSR hydration / Storybook. */
  initialState?: PauseState;
  /** Pause-window in ms before EXPIRE auto-fires. Default 14 days per Sally. */
  pauseTimeoutMs?: number;
  /** Test seam — replace machine factory in unit tests. */
  factory?: typeof createPersistedStateMachine;
}

const DEFAULT_PAUSE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export function RecipientPausePathToggle({
  token,
  locale,
  initialState = 'default',
  pauseTimeoutMs = DEFAULT_PAUSE_TIMEOUT_MS,
  factory = createPersistedStateMachine
}: RecipientPausePathToggleProps): JSX.Element {
  const t = useTranslations('voucher.consent.pause');

  const machine: PersistedStateMachine<PauseState, PauseEvent> = useMemo(
    () =>
      factory<PauseState, PauseEvent>({
        id: `voucher-pause-${token}`,
        initial: initialState,
        transitions: PAUSE_TRANSITIONS
      }),
    [factory, token, initialState]
  );

  const [state, setState] = useState<PauseState>(machine.getState());

  useEffect(() => {
    const unsubscribe = machine.subscribe((snapshot) => setState(snapshot.state));
    return () => {
      unsubscribe();
    };
  }, [machine]);

  // Auto-expire after configured window when state is `paused`.
  useEffect(() => {
    if (state !== 'paused') return;
    const timer = window.setTimeout(() => {
      machine.send('EXPIRE');
      void emit('timeout');
    }, pauseTimeoutMs);
    return () => window.clearTimeout(timer);
  }, [state, pauseTimeoutMs, machine]);

  async function emit(pauseStateLabel: 'considering' | 'paused' | 'timeout' | 'withdrawn'): Promise<void> {
    const formData = new FormData();
    formData.set('token', token);
    formData.set('locale', locale);
    formData.set('pause_state', pauseStateLabel);
    formData.set('surface', 'js');
    await pauseRecipient(formData);
  }

  function transition(event: PauseEvent, label?: 'considering' | 'paused' | 'timeout' | 'withdrawn'): void {
    const next = machine.send(event);
    if (next && label) {
      void emit(label);
    }
  }

  return (
    <section
      aria-label={t('region_aria')}
      data-testid="pause-path-region"
      data-state={state}
      className="rounded-sm border border-tertiary p-4"
    >
      <h3 className="heading-sm mb-2">{t('heading')}</h3>
      <p className="mb-3 text-sm">{t(`description_${state}` as const)}</p>

      <div className="flex flex-wrap gap-2">
        {state === 'default' ? (
          <button
            type="button"
            data-testid="pause-cta-consider"
            onClick={() => transition('START_CONSIDERING', 'considering')}
            className="min-h-12 min-w-12 rounded-sm border border-tertiary px-4 py-3 text-sm"
          >
            {t('cta_consider')}
          </button>
        ) : null}

        {state === 'considering' ? (
          <>
            <button
              type="button"
              data-testid="pause-cta-pause"
              onClick={() => transition('PAUSE', 'paused')}
              className="min-h-12 min-w-12 rounded-sm bg-action px-4 py-3 text-sm text-action-on-primary"
            >
              {t('cta_pause')}
            </button>
            <button
              type="button"
              data-testid="pause-cta-cancel"
              onClick={() => transition('CANCEL')}
              className="min-h-12 min-w-12 rounded-sm border border-tertiary px-4 py-3 text-sm"
            >
              {t('cta_cancel')}
            </button>
          </>
        ) : null}

        {state === 'paused' ? (
          <>
            <button
              type="button"
              data-testid="pause-cta-resume"
              onClick={() => transition('RESUME', 'considering')}
              className="min-h-12 min-w-12 rounded-sm border border-tertiary px-4 py-3 text-sm"
            >
              {t('cta_resume')}
            </button>
            <button
              type="button"
              data-testid="pause-cta-withdraw"
              onClick={() => transition('WITHDRAW', 'withdrawn')}
              className="min-h-12 min-w-12 rounded-sm border border-action px-4 py-3 text-sm text-action"
            >
              {t('cta_withdraw')}
            </button>
          </>
        ) : null}

        {state === 'timeout' ? (
          <button
            type="button"
            data-testid="pause-cta-withdraw-timeout"
            onClick={() => transition('WITHDRAW', 'withdrawn')}
            className="min-h-12 min-w-12 rounded-sm border border-action px-4 py-3 text-sm text-action"
          >
            {t('cta_withdraw')}
          </button>
        ) : null}
      </div>
    </section>
  );
}
