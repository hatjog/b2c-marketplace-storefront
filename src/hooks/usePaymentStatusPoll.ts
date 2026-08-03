'use client';

/**
 * usePaymentStatusPoll — auto-polling hook for pending_psp payment state.
 *
 * v1.8.0 Story 1.5: Payment Status Surface 6 States.
 *
 * Thin React wrapper around createPaymentStatusPoller (testable pure module).
 * Delegates all scheduling logic to the poller; manages React state lifecycle.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { BackendPaymentStatusResponse, PaymentStatusV180 } from '@/lib/payment/payment-status-v180-adapter';
import {
  COUNTDOWN_SECONDS,
  createPaymentStatusPoller,
  type PaymentStatusPoller,
} from '@/lib/payment/payment-status-poller';

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

  const pollerRef = useRef<PaymentStatusPoller | null>(null);

  const stableOnStatusChange = useCallback(onStatusChange, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stableOnError = useCallback(onError ?? (() => void 0), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled) {
      pollerRef.current?.stop();
      pollerRef.current = null;
      setCountdown(COUNTDOWN_SECONDS);
      setIsSecondTier(false);
      setSecondsTotalElapsed(0);
      return;
    }

    pollerRef.current = createPaymentStatusPoller(orderId, {
      onStatusChange: stableOnStatusChange,
      onCountdownTick: (cd, elapsed, secondTier) => {
        setCountdown(cd);
        setSecondsTotalElapsed(elapsed);
        setIsSecondTier(secondTier);
      },
      onError: stableOnError,
    });
    pollerRef.current.start();

    return () => {
      pollerRef.current?.stop();
      pollerRef.current = null;
    };
  }, [enabled, orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { countdown, isSecondTier, secondsTotalElapsed };
}
