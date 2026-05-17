/**
 * payment-status-poller.ts — pure polling scheduler for pending_psp state.
 *
 * v1.8.0 Story 1.5: Payment Status Surface 6 States.
 *
 * Extracted from usePaymentStatusPoll to enable direct unit testing without
 * React hooks (no renderHook / @testing-library required). The hook is a
 * thin wrapper around this module.
 *
 * Spec constants (UX SSOT §8.3, EDP9):
 *   Poll interval: 5s (LP4)
 *   Max duration: 10 min (wall-clock hard cap)
 *   Second-tier threshold: 90s (EDP9)
 *   Countdown: 5s visual countdown per tick
 *
 * ARCH-007: Customer-facing storefront only.
 */

import type { BackendPaymentStatusResponse, PaymentStatusV180 } from './payment-status-v180-adapter';
import { resolveStatusFromResponse, TERMINAL_STATUSES_V180 } from './payment-status-v180-adapter';

export const POLL_INTERVAL_MS = 5_000;
export const MAX_POLL_DURATION_MS = 600_000; // 10 min
export const SECOND_TIER_THRESHOLD_MS = 90_000; // 90s (EDP9)
export const COUNTDOWN_SECONDS = 5;

export interface PaymentStatusPollerCallbacks {
  onStatusChange: (status: PaymentStatusV180, data: BackendPaymentStatusResponse) => void;
  onCountdownTick: (countdown: number, totalElapsedSeconds: number, isSecondTier: boolean) => void;
  onError?: (err: Error) => void;
}

export interface PaymentStatusPoller {
  start: (overrideStartTime?: number) => void;
  stop: () => void;
}

export function createPaymentStatusPoller(
  orderId: string,
  callbacks: PaymentStatusPollerCallbacks,
): PaymentStatusPoller {
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let abortCtrl: AbortController | null = null;
  let startTime: number | null = null;
  let active = false;

  function clearTimers() {
    if (pollTimer !== null) { clearTimeout(pollTimer); pollTimer = null; }
    if (countdownTimer !== null) { clearInterval(countdownTimer); countdownTimer = null; }
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null; }
  }

  function getElapsedSeconds(): number {
    if (startTime === null) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
  }

  function isSecondTier(): boolean {
    return getElapsedSeconds() >= SECOND_TIER_THRESHOLD_MS / 1000;
  }

  function startCountdown() {
    let remaining = COUNTDOWN_SECONDS;
    callbacks.onCountdownTick(remaining, getElapsedSeconds(), isSecondTier());

    if (countdownTimer !== null) { clearInterval(countdownTimer); }

    countdownTimer = setInterval(() => {
      remaining -= 1;
      callbacks.onCountdownTick(remaining, getElapsedSeconds(), isSecondTier());
      if (remaining <= 0 && countdownTimer !== null) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }, 1_000);
  }

  function schedulePoll() {
    if (!active) return;
    startCountdown();

    pollTimer = setTimeout(async () => {
      if (!active) return;

      // Wall-clock hard cap — always expires (not support_required on timeout,
      // support_required arrives via backend response before timeout; L4 acceptable deviation)
      if (startTime !== null && Date.now() - startTime >= MAX_POLL_DURATION_MS) {
        active = false;
        clearTimers();
        callbacks.onStatusChange('expired', {
          status: 'expired',
          last_checked_at: new Date().toISOString(),
          recommended_action_key: 'return_to_cart',
        });
        return;
      }

      const ctrl = new AbortController();
      abortCtrl = ctrl;

      try {
        const res = await fetch(`/api/v1/orders/${orderId}/payment-status`, {
          cache: 'no-store',
          signal: ctrl.signal,
        });

        if (!res.ok) {
          if (!active) return;
          schedulePoll();
          return;
        }

        const data = (await res.json()) as BackendPaymentStatusResponse;
        const resolved = resolveStatusFromResponse(data);

        if (!active) return;
        callbacks.onStatusChange(resolved, data);

        if (TERMINAL_STATUSES_V180.has(resolved)) {
          active = false;
          clearTimers();
          return;
        }

        schedulePoll();
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (!active) return;
        callbacks.onError?.(err as Error);
        schedulePoll();
      }
    }, POLL_INTERVAL_MS);
  }

  return {
    start(overrideStartTime?: number) {
      active = true;
      startTime = overrideStartTime ?? Date.now();
      schedulePoll();
    },
    stop() {
      active = false;
      clearTimers();
    },
  };
}
