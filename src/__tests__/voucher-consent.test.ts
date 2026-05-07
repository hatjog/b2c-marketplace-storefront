import { describe, expect, it } from 'vitest';

import {
  buildAuditPayload,
  type ConsentAuditAction
} from '@/lib/voucher-consent/buildAuditPayload';
import { createPersistedStateMachine } from '@/lib/state-machine/create-persisted-state-machine';
import { PAUSE_TRANSITIONS, type PauseEvent, type PauseState } from '@/components/molecules/RecipientPausePathToggle';

/**
 * Unit coverage for STORY-2-1 voucher PII consent moment.
 *
 * Maps to:
 *   AC-VPII-2.1-04 — buildAuditPayload contract + chained-tx invariants
 *   AC-VPII-2.1-05 — withdrawal requires compensates_audit_id
 *   AC-VPII-2.1-07 — RecipientPausePathToggle 5-state transitions per Pattern 5
 */

describe('buildAuditPayload — AC-VPII-2.1-04 / AC-VPII-2.1-05', () => {
  const baseInput = {
    token: 'tok-123',
    locale: 'pl',
    surface: 'js' as const,
    occurredAt: 1714521600000
  };

  it('builds a grant payload with schema_version=1 and ISO timestamp', () => {
    const payload = buildAuditPayload({ ...baseInput, action: 'grant' });
    expect(payload).toMatchObject({
      action: 'grant',
      token: 'tok-123',
      locale: 'pl',
      surface: 'js',
      schema_version: 1
    });
    expect(payload.occurred_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // Privacy boundary: payload MUST NOT contain PII fields.
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('phone');
    expect(payload).not.toHaveProperty('message');
  });

  it('rejects withdrawal without compensates_audit_id (D-66 contract)', () => {
    expect(() =>
      buildAuditPayload({ ...baseInput, action: 'withdraw' })
    ).toThrow(/compensatesAuditId/);
  });

  it('emits compensates_audit_id on withdrawal', () => {
    const payload = buildAuditPayload({
      ...baseInput,
      action: 'withdraw',
      compensatesAuditId: 'audit-grant-1'
    });
    expect(payload.compensates_audit_id).toBe('audit-grant-1');
  });

  it('rejects pause without pauseState (UX-DR5 5-state)', () => {
    expect(() => buildAuditPayload({ ...baseInput, action: 'pause' })).toThrow(
      /pauseState/
    );
  });

  it.each<ConsentAuditAction>(['grant', 'withdraw', 'pause'])(
    'returns schema_version=1 for %s',
    (action) => {
      const payload = buildAuditPayload({
        ...baseInput,
        action,
        compensatesAuditId: action === 'withdraw' ? 'a1' : undefined,
        pauseState: action === 'pause' ? 'considering' : undefined
      });
      expect(payload.schema_version).toBe(1);
    }
  );
});

describe('createPersistedStateMachine — UX-DR6 shared utility', () => {
  it('starts at the initial state', () => {
    const m = createPersistedStateMachine<'a' | 'b', 'GO'>({
      id: 'test-init',
      initial: 'a',
      transitions: { a: { GO: 'b' }, b: {} },
      storage: 'memory'
    });
    expect(m.getState()).toBe('a');
  });

  it('transitions only along the declared map', () => {
    const m = createPersistedStateMachine<'a' | 'b' | 'c', 'GO' | 'BACK'>({
      id: 'test-trans',
      initial: 'a',
      transitions: { a: { GO: 'b' }, b: { BACK: 'a' }, c: {} },
      storage: 'memory'
    });
    expect(m.send('GO')).toBe('b');
    expect(m.send('GO')).toBe(null); // illegal — no transition declared
    expect(m.getState()).toBe('b');
    expect(m.send('BACK')).toBe('a');
  });

  it('keeps history bounded by maxHistory', () => {
    const m = createPersistedStateMachine<'a' | 'b', 'TOGGLE'>({
      id: 'test-hist',
      initial: 'a',
      transitions: { a: { TOGGLE: 'b' }, b: { TOGGLE: 'a' } },
      storage: 'memory',
      maxHistory: 3
    });
    for (let i = 0; i < 10; i += 1) m.send('TOGGLE');
    expect(m.getSnapshot().history.length).toBe(3);
  });

  it('notifies subscribers on state change', () => {
    const m = createPersistedStateMachine<'a' | 'b', 'GO'>({
      id: 'test-sub',
      initial: 'a',
      transitions: { a: { GO: 'b' }, b: {} },
      storage: 'memory'
    });
    let calls = 0;
    const off = m.subscribe(() => {
      calls += 1;
    });
    m.send('GO');
    m.send('GO'); // illegal, must not notify
    off();
    m.send('GO');
    expect(calls).toBe(1);
  });
});

describe('RecipientPausePathToggle — AC-VPII-2.1-07 5-state machine', () => {
  type Step = { from: PauseState; event: PauseEvent; to: PauseState | null };

  const happyPath: Step[] = [
    { from: 'default', event: 'START_CONSIDERING', to: 'considering' },
    { from: 'considering', event: 'PAUSE', to: 'paused' },
    { from: 'paused', event: 'EXPIRE', to: 'timeout' },
    { from: 'timeout', event: 'WITHDRAW', to: 'withdrawn' }
  ];

  it.each(happyPath)(
    'transitions $from --$event--> $to',
    ({ from, event, to }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PAUSE_TRANSITIONS[from] as any)[event]).toBe(to);
    }
  );

  it('disallows skipping intermediate states (no default → withdrawn)', () => {
    expect(PAUSE_TRANSITIONS.default).not.toHaveProperty('WITHDRAW');
    expect(PAUSE_TRANSITIONS.considering).not.toHaveProperty('WITHDRAW');
  });

  it('terminal state withdrawn has no outgoing transitions', () => {
    expect(Object.keys(PAUSE_TRANSITIONS.withdrawn)).toHaveLength(0);
  });

  it('paused → resume returns to considering (Sally pattern 5)', () => {
    expect(PAUSE_TRANSITIONS.paused.RESUME).toBe('considering');
  });
});
