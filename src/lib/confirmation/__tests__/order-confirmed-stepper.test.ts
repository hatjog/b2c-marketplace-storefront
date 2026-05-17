import { describe, expect, it } from 'vitest';

import {
  buildConfirmationStepperState,
  getGeneratingElapsedSeconds,
  isSecondTierGenerating,
  maskEmail,
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
    expect(shouldStopConfirmationPolling('email_sent')).toBe(true);
    expect(shouldStopConfirmationPolling('recipient_opened')).toBe(true);
    expect(shouldStopConfirmationPolling('voucher_generating')).toBe(false);
  });

  it('tracks elapsed seconds and second-tier threshold', () => {
    const elapsed = getGeneratingElapsedSeconds(1_000, 92_300);
    expect(elapsed).toBe(91);
    expect(isSecondTierGenerating(elapsed)).toBe(true);
    expect(isSecondTierGenerating(89)).toBe(false);
  });
});
