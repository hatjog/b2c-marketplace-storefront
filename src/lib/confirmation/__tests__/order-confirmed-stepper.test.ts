import { describe, expect, it } from 'vitest';

import {
  buildConfirmationStepperState,
  buildConfirmationStepperStateFrom,
  CONFIRMATION_MAX_POLL_DURATION_MS,
  deriveVoucherPipelineStatus,
  getGeneratingElapsedSeconds,
  isSecondTierGenerating,
  maskEmail,
  normalizeEntitlementPipelineStatus,
  normalizeVoucherPipelineStatus,
  shouldStopConfirmationPolling
} from '../order-confirmed-stepper';

describe('order-confirmed-stepper', () => {
  it('masks buyer email in a stable way', () => {
    expect(maskEmail('anna.nowak@example.com')).toBe('a********k@e*****e.com');
  });

  it('falls back to safe placeholder for malformed email', () => {
    expect(maskEmail('invalid')).toBe('***@***');
  });

  it('maps pending payment aliases to pending_payment', () => {
    expect(normalizeVoucherPipelineStatus('pending_psp_confirmation')).toBe('pending_payment');
    expect(normalizeVoucherPipelineStatus('pending_psp')).toBe('pending_payment');
  });

  it('maps entitlement statuses to voucher pipeline stages', () => {
    expect(normalizeEntitlementPipelineStatus('ISSUED')).toBe('email_sent');
    expect(normalizeEntitlementPipelineStatus('ACTIVE')).toBe('recipient_opened');
    expect(normalizeEntitlementPipelineStatus('unknown')).toBeNull();
  });

  it('builds fail-soft stepper when backend step2-4 signal is missing', () => {
    const state = buildConfirmationStepperState('paid');

    expect(state.activeStepId).toBe('voucher_generating');
    expect(state.steps).toEqual([
      { id: 'paid', state: 'done' },
      { id: 'voucher_generating', state: 'active' },
      { id: 'email_sent', state: 'future' },
      { id: 'recipient_opened', state: 'future' }
    ]);
  });

  it('moves to step 3 when voucher is issued', () => {
    const state = buildConfirmationStepperState('voucher_issued');

    expect(state.activeStepId).toBe('email_sent');
    expect(state.steps[0].state).toBe('done');
    expect(state.steps[1].state).toBe('done');
    expect(state.steps[2].state).toBe('active');
  });

  it('marks full completion when recipient opened voucher', () => {
    const state = buildConfirmationStepperState('recipient_opened');

    expect(state.activeStepId).toBeNull();
    expect(state.steps.every(step => step.state === 'done')).toBe(true);
  });

  it('stops polling at email_sent and recipient_opened', () => {
    expect(shouldStopConfirmationPolling('voucher_issued')).toBe(true);
    expect(shouldStopConfirmationPolling('email_sent')).toBe(true);
    expect(shouldStopConfirmationPolling('recipient_opened')).toBe(true);
    expect(shouldStopConfirmationPolling('voucher_generating')).toBe(false);
  });

  it('derives pipeline status from entitlements before payment proxy status', () => {
    expect(deriveVoucherPipelineStatus('pending_psp_confirmation', [{ status: 'ISSUED' }])).toBe(
      'email_sent'
    );
    expect(deriveVoucherPipelineStatus('paid', [{ status: 'ACTIVE' }])).toBe('recipient_opened');
  });

  // ── v1.15.0 Story 3.7 (AC3) — porażka MA reprezentację ──────────────────

  it('mapuje realne stany ledgera dostarczeń, których enum wcześniej nie znał', () => {
    // Źródło: `DELIVERY_DISPATCH_STATES` w
    // `GP/backend/.../voucher-delivery/delivery-state.ts`.
    expect(normalizeEntitlementPipelineStatus('dead_lettered')).toBe('delivery_failed');
    expect(normalizeEntitlementPipelineStatus('failed')).toBe('delivery_retrying');
    expect(normalizeEntitlementPipelineStatus('retrying')).toBe('delivery_retrying');
    // `degraded` w kontrakcie znaczy: mail POSZEDŁ. Porażką NIE jest.
    expect(normalizeEntitlementPipelineStatus('degraded')).toBe('email_sent');
  });

  it('mapuje terminalne stany płatności, które wcześniej spadały na unknown', () => {
    for (const raw of ['failed_retryable', 'failed_nonretryable', 'expired', 'support_required']) {
      expect(normalizeVoucherPipelineStatus(raw)).toBe('payment_failed');
    }
  });

  it('dead_lettered wygrywa z sygnałem sukcesu innego uprawnienia tego zamówienia', () => {
    expect(
      deriveVoucherPipelineStatus('paid', [{ status: 'issued' }, { status: 'dead_lettered' }])
    ).toBe('delivery_failed');
  });

  it('stany terminalne porażki KOŃCZĄ odpytywanie', () => {
    expect(shouldStopConfirmationPolling('delivery_failed')).toBe(true);
    expect(shouldStopConfirmationPolling('payment_failed')).toBe(true);
    expect(shouldStopConfirmationPolling('timed_out')).toBe(true);
    // Ponawiana dostawa jeszcze się nie skończyła — kontrakt ledgera dopuszcza retry.
    expect(shouldStopConfirmationPolling('delivery_retrying')).toBe(false);
    expect(shouldStopConfirmationPolling('unknown')).toBe(false);
  });

  it('unknown NIE renderuje już kroku „generujemy" (AD-19)', () => {
    // Przed tą story `getActiveIndex('unknown')` zwracało 1 z komentarzem
    // „fail-soft" — czyli wartość spoza dziedziny wyglądała jak praca w toku.
    expect(buildConfirmationStepperStateFrom('unknown').activeStepId).toBeNull();
    expect(buildConfirmationStepperStateFrom('delivery_failed').activeStepId).toBeNull();
    expect(buildConfirmationStepperStateFrom('payment_failed').activeStepId).toBeNull();
    expect(buildConfirmationStepperStateFrom('timed_out').activeStepId).toBeNull();
  });

  it('ponawiana dostawa zatrzymuje się na kroku WYSYŁKI, nie na generowaniu', () => {
    expect(buildConfirmationStepperStateFrom('delivery_retrying').activeStepId).toBe('email_sent');
  });

  it('limit zegarowy jest ten sam, co u pollera obok — jedna dyscyplina, nie dwie', async () => {
    const { MAX_POLL_DURATION_MS } = await import('@/lib/payment/payment-status-poller');
    expect(CONFIRMATION_MAX_POLL_DURATION_MS).toBe(MAX_POLL_DURATION_MS);
  });

  // ── review-fix LOW-1 ──────────────────────────────────────────────────────
  //
  // `getActiveIndex('unknown')` już nie renderowało spinnera, ale
  // `getCompletedThroughIndex('unknown')` nadal zwracało 0 — czyli krok
  // „Opłacone" dostawał stan `done` i haczyk ✓. `unknown` powstaje m.in. gdy
  // OBA odczyty padły, więc powierzchnia stwierdzała fakt zapłaty nie mając
  // ani jednego udanego odczytu. Resztka fail-soft w drugiej funkcji modułu.
  it('unknown nie oznacza ŻADNEGO kroku jako zrobiony (AD-19)', () => {
    const steps = buildConfirmationStepperStateFrom('unknown').steps;
    expect(steps.every(step => step.state === 'future')).toBe(true);
  });

  it('timed_out ŚWIADOMIE zostawia krok „Opłacone" jako zrobiony', () => {
    // Rozstrzygnięcie odwrotne niż dla `unknown` i zapisane: do przekroczenia
    // limitu pętla zwykle potwierdziła płatność, a cofnięcie haczyka mówiłoby
    // „nie zapłaciłaś" nad realnie obciążoną kartą.
    const steps = buildConfirmationStepperStateFrom('timed_out').steps;
    expect(steps[0].state).toBe('done');
    expect(steps.slice(1).every(step => step.state === 'future')).toBe(true);
  });

  it('tracks elapsed seconds and second-tier threshold', () => {
    const elapsed = getGeneratingElapsedSeconds(1_000, 92_300);
    expect(elapsed).toBe(91);
    expect(isSecondTierGenerating(elapsed)).toBe(true);
    expect(isSecondTierGenerating(89)).toBe(false);
  });
});
