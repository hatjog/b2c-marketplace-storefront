'use client';

/**
 * useCircuitBreaker — client-side 3-state circuit breaker hook (Story 5.4).
 *
 * Story: v160-5-4-seller-selector-circuit-breaker (Sprint 3, Epic 5)
 * Spec: PRD AR45 (resilience NIE blocks render) + AR54 (Phase A2 SMOKE GATE)
 *       persona Marta-self buyer-flow MUSI nie crashować na backend hiccup
 *
 * State machine:
 *  - `closed`    (default) — normal flow; `recordFailure` accumulates
 *                            timestamps in a rolling window.
 *  - `open`      — failureThreshold reached; `canAttempt` returns false;
 *                  consumer renders fallback UX. After `cooldownMs` the
 *                  state auto-transitions to `half-open`.
 *  - `half-open` — single test call permitted; success → `closed`;
 *                  failure → back to `open` with fresh cooldown.
 *
 * Defaults (per Story 5.4 Dev Notes — industry baseline):
 *  - failureThreshold: 3
 *  - windowMs: 10_000 (10 s rolling window)
 *  - cooldownMs: 60_000 (60 s)
 *
 * Why client-side (not server-side):
 *  - Server-side circuit breaker = Mercur 2 middleware territory;
 *    upstream contributes would require fork divergence (out of scope).
 *  - Client breaker protects UX layer; even during backend storms a single
 *    buyer session stays stable.
 *  - Per-instance state (NOT shared across tabs/users) — acceptable for
 *    v1.6.0 scale (10–100 concurrent buyers).
 *
 * SSR safety:
 *  - Hook does NOT touch `Date.now()` in the render path — only inside
 *    callbacks/useEffect. Initial state is pure (`closed`, count 0).
 *  - Cooldown timer cleared on unmount (zero leak).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of failures within `windowMs` that trips the circuit. Default 3. */
  failureThreshold?: number;
  /** Rolling window in ms for failure accumulation. Default 10_000. */
  windowMs?: number;
  /** Time in ms the circuit stays open before going half-open. Default 60_000. */
  cooldownMs?: number;
}

export interface UseCircuitBreakerResult {
  /** Current state of the breaker. */
  state: CircuitState;
  /** Failures currently in the rolling window. */
  failureCount: number;
  /** Record a failure event. Trips to `open` once threshold crossed. */
  recordFailure: () => void;
  /** Record a success event. In `half-open` closes the circuit. */
  recordSuccess: () => void;
  /** Returns true if a call may proceed (`closed` or `half-open`). */
  canAttempt: () => boolean;
  /** Hard-reset to `closed` + clear timestamps + cancel pending cooldown. */
  reset: () => void;
}

const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_COOLDOWN_MS = 60_000;

export const useCircuitBreaker = (
  config: CircuitBreakerConfig = {},
): UseCircuitBreakerResult => {
  const {
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    windowMs = DEFAULT_WINDOW_MS,
    cooldownMs = DEFAULT_COOLDOWN_MS,
  } = config;

  const [state, setState] = useState<CircuitState>('closed');
  const [failureCount, setFailureCount] = useState<number>(0);

  // Rolling-window failure timestamps. Held in a ref so successive
  // recordFailure invocations within the same render cycle accumulate
  // correctly (state batching could otherwise drop intermediate values).
  const failureTimestampsRef = useRef<number[]>([]);
  // Cooldown timer handle; cleared on unmount or reset.
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mounted guard: prevents setState after unmount during async cooldown.
  const isMountedRef = useRef<boolean>(true);

  const clearCooldownTimer = useCallback(() => {
    if (cooldownTimerRef.current !== null) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, []);

  const scheduleHalfOpen = useCallback(() => {
    clearCooldownTimer();
    cooldownTimerRef.current = setTimeout(() => {
      cooldownTimerRef.current = null;
      if (!isMountedRef.current) return;
      // Atomic transition: only flip if still `open`.
      setState((prev) => (prev === 'open' ? 'half-open' : prev));
    }, cooldownMs);
  }, [clearCooldownTimer, cooldownMs]);

  const recordFailure = useCallback(() => {
    const now = Date.now();
    const cutoff = now - windowMs;
    // Drop stale timestamps outside the window, then append the new failure.
    const fresh = failureTimestampsRef.current.filter((ts) => ts >= cutoff);
    fresh.push(now);
    failureTimestampsRef.current = fresh;
    setFailureCount(fresh.length);

    setState((prev) => {
      if (prev === 'half-open') {
        // Test call failed → re-open with a fresh cooldown.
        scheduleHalfOpen();
        return 'open';
      }
      if (prev === 'closed' && fresh.length >= failureThreshold) {
        scheduleHalfOpen();
        return 'open';
      }
      return prev;
    });
  }, [windowMs, failureThreshold, scheduleHalfOpen]);

  const recordSuccess = useCallback(() => {
    setState((prev) => {
      if (prev === 'half-open') {
        failureTimestampsRef.current = [];
        setFailureCount(0);
        clearCooldownTimer();
        return 'closed';
      }
      // In `closed` state, success acts as a soft reset of stale failures.
      if (prev === 'closed' && failureTimestampsRef.current.length > 0) {
        failureTimestampsRef.current = [];
        setFailureCount(0);
      }
      return prev;
    });
  }, [clearCooldownTimer]);

  const canAttempt = useCallback((): boolean => {
    return state !== 'open';
  }, [state]);

  const reset = useCallback(() => {
    clearCooldownTimer();
    failureTimestampsRef.current = [];
    setFailureCount(0);
    setState('closed');
  }, [clearCooldownTimer]);

  // Cleanup on unmount: cancel pending cooldown timer + flag unmount.
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (cooldownTimerRef.current !== null) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  return { state, failureCount, recordFailure, recordSuccess, canAttempt, reset };
};
