'use client';

/**
 * usePaymentStatusPoll — auto-polling hook for pending_psp payment state.
 *
 * v1.8.0 Story 1.5: Payment Status Surface 6 States.
 *
 * Fixed 5s poll interval (no backoff — EDP9 spec requirement).
 * Max 10 min wall-clock, then transitions to expired.
 * Second-tier threshold: 90s (EDP9 / UX SSOT §8.3).
 * prefers-reduced-motion does not affect poll logic — only UI animations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BackendPaymentStatusResponse, PaymentStatusV180 } from '@/lib/payment/payment-status-v180-adapter';
import { resolveStatusFromResponse, TERMINAL_STATUSES_V180 } from '@/lib/payment/payment-status-v180-adapter';

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 600_000; // 10 min
const SECOND_TIER_THRESHOLD_MS = 90_000; // 90s (EDP9)
const COUNTDOWN_SECONDS = 5;

export interface UsePaymentStatusPollParams {
  orderId: string;
  enabled: boolean;
  onStatusChange: (status: PaymentStatusV180, data: BackendPaymentStatusResponse) => void;
  onError?: (err: Error) => void;
}

export interface UsePaymentStatusPollResult {
  countdown: number;
  isSecondTier: boolean;
  secondsTotalElapsed: number;
}

export function usePaymentStatusPoll({
  orderId,
  enabled,
  onStatusChange,
  onError,
}: UsePaymentStatusPollParams): UsePaymentStatusPollResult {
  const [countdown, setCountdown] = useState<number>(COUNTDOWN_SECONDS);
  const [isSecondTier, setIsSecondTier] = useState(false);
  const [secondsTotalElapsed, setSecondsTotalElapsed] = useState(0);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const activeRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current !== null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(COUNTDOWN_SECONDS);

    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
    }

    let remaining = COUNTDOWN_SECONDS;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);

      if (startTimeRef.current !== null) {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setSecondsTotalElapsed(elapsed);
        setIsSecondTier(elapsed >= SECOND_TIER_THRESHOLD_MS / 1000);
      }

      if (remaining <= 0 && countdownTimerRef.current !== null) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1_000);
  }, []);

  const schedulePoll = useCallback(() => {
    if (!activeRef.current) return;

    startCountdown();

    pollTimerRef.current = setTimeout(async () => {
      if (!activeRef.current) return;

      // Wall-clock guard — transition to expired after 10 min
      if (startTimeRef.current !== null) {
        const elapsed = Date.now() - startTimeRef.current;
        if (elapsed >= MAX_POLL_DURATION_MS) {
          activeRef.current = false;
          clearTimers();
          const expiredResponse: BackendPaymentStatusResponse = {
            status: 'expired',
            last_checked_at: new Date().toISOString(),
            recommended_action_key: 'return_to_cart',
          };
          onStatusChange('expired', expiredResponse);
          return;
        }
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch(`/api/v1/orders/${orderId}/payment-status`, {
          cache: 'no-store',
          signal: ctrl.signal,
        });

        if (!res.ok) {
          if (!activeRef.current) return;
          schedulePoll();
          return;
        }

        const data = (await res.json()) as BackendPaymentStatusResponse;
        const resolved = resolveStatusFromResponse(data);

        if (!activeRef.current) return;

        onStatusChange(resolved, data);

        if (TERMINAL_STATUSES_V180.has(resolved)) {
          activeRef.current = false;
          clearTimers();
          return;
        }

        schedulePoll();
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (!activeRef.current) return;
        onError?.(err as Error);
        schedulePoll();
      }
    }, POLL_INTERVAL_MS);
  }, [orderId, onStatusChange, onError, clearTimers, startCountdown]);

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false;
      clearTimers();
      setCountdown(COUNTDOWN_SECONDS);
      setIsSecondTier(false);
      setSecondsTotalElapsed(0);
      startTimeRef.current = null;
      return;
    }

    activeRef.current = true;
    startTimeRef.current = Date.now();
    schedulePoll();

    return () => {
      activeRef.current = false;
      clearTimers();
    };
  // schedulePoll is stable via useCallback deps; enabled/orderId are the real triggers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, orderId]);

  return { countdown, isSecondTier, secondsTotalElapsed };
}
