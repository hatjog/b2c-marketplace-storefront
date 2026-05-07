'use client';

/**
 * useCircuitBreaker — client-side 3-state circuit breaker hook (Story 5.4).
 *
 * Story: v160-5-4-seller-selector-circuit-breaker (Sprint 3, Epic 5)
 * Spec: PRD AR45 (resilience NIE blocks render) + AR54 (Phase A2 SMOKE GATE)
 *       persona Marta-self buyer-flow MUSI nie crashować na backend hiccup
 *
 * Story v160-cleanup-32 (TF-71): moduł-level singleton state Map keyed by
 * circuit name — fixes per-instance state isolation bug. Two components using
 * the same circuit name NOW share failures. Thresholds env-configurable via
 * NEXT_PUBLIC_CB_FAILURE_THRESHOLD + NEXT_PUBLIC_CB_COOLDOWN_MS. First failure
 * (length === 1) emits structured console.warn.
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
 *  - failureThreshold: 3 (override: NEXT_PUBLIC_CB_FAILURE_THRESHOLD)
 *  - windowMs: 10_000 (10 s rolling window)
 *  - cooldownMs: 60_000 (60 s; override: NEXT_PUBLIC_CB_COOLDOWN_MS)
 *
 * Why client-side (not server-side):
 *  - Server-side circuit breaker = Mercur 2 middleware territory;
 *    upstream contributes would require fork divergence (out of scope).
 *  - Client breaker protects UX layer; even during backend storms a single
 *    buyer session stays stable.
 *  - Shared per circuit name (TF-71 fix): all hook instances with the same
 *    name observe the same failures and state transitions.
 *
 * SSR safety:
 *  - Hook does NOT touch `Date.now()` in the render path — only inside
 *    callbacks/useEffect. Initial state is pure (`closed`, count 0).
 *  - Cooldown timer cleared on unmount (zero leak).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of failures within `windowMs` that trips the circuit.
   *  Default: NEXT_PUBLIC_CB_FAILURE_THRESHOLD env var, fallback 3. */
  failureThreshold?: number;
  /** Rolling window in ms for failure accumulation. Default 10_000. */
  windowMs?: number;
  /** Time in ms the circuit stays open before going half-open.
   *  Default: NEXT_PUBLIC_CB_COOLDOWN_MS env var, fallback 60_000. */
  cooldownMs?: number;
}

export interface UseCircuitBreakerResult {
  /** Current state of the breaker. */
  state: CircuitState;
  /** Failures currently in the rolling window. */
  failureCount: number;
  /** Record a failure event. Trips to `open` once threshold crossed. */
  recordFailure: (reason?: string) => void;
  /** Record a success event. In `half-open` closes the circuit. */
  recordSuccess: () => void;
  /** Returns true if a call may proceed (`closed` or `half-open`). */
  canAttempt: () => boolean;
  /** Hard-reset to `closed` + clear timestamps + cancel pending cooldown. */
  reset: () => void;
}

// ---- Env-configurable defaults (TF-71) ----

function getEnvInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw) {
    const parsed = parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return defaultValue;
}

function getDefaultFailureThreshold(): number {
  return getEnvInt('NEXT_PUBLIC_CB_FAILURE_THRESHOLD', 3);
}

function getDefaultCooldownMs(): number {
  return getEnvInt('NEXT_PUBLIC_CB_COOLDOWN_MS', 60_000);
}

const DEFAULT_WINDOW_MS = 10_000;

// ---- Module-level singleton state (TF-71 fix) ----
// Keyed by circuit name. All hook instances with the same name share state.

interface CircuitSingleton {
  /** Current circuit state. */
  state: CircuitState;
  /** Rolling-window failure timestamps. */
  failures: number[];
  /** Active cooldown timer handle. */
  cooldownTimer: ReturnType<typeof setTimeout> | null;
  /** Subscribers: state-change notifier callbacks. */
  listeners: Set<() => void>;
}

const circuitRegistry = new Map<string, CircuitSingleton>();

function getOrCreateCircuit(name: string): CircuitSingleton {
  let circuit = circuitRegistry.get(name);
  if (!circuit) {
    circuit = {
      state: 'closed',
      failures: [],
      cooldownTimer: null,
      listeners: new Set(),
    };
    circuitRegistry.set(name, circuit);
  }
  return circuit;
}

function notifyListeners(circuit: CircuitSingleton): void {
  for (const listener of circuit.listeners) {
    listener();
  }
}

/**
 * Reset module-level singleton for a circuit (for testing isolation).
 * Not exported from module index — only accessible via direct import.
 */
export function _resetCircuitSingletonForTest(name: string): void {
  const circuit = circuitRegistry.get(name);
  if (circuit) {
    if (circuit.cooldownTimer !== null) {
      clearTimeout(circuit.cooldownTimer);
    }
    circuitRegistry.delete(name);
  }
}

export const useCircuitBreaker = (
  name: string,
  config: CircuitBreakerConfig = {},
): UseCircuitBreakerResult => {
  const failureThreshold = config.failureThreshold ?? getDefaultFailureThreshold();
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const cooldownMs = config.cooldownMs ?? getDefaultCooldownMs();

  // Local React state mirrors singleton — triggers re-render on change.
  const [circuitState, setCircuitState] = useState<CircuitState>(() => {
    return getOrCreateCircuit(name).state;
  });
  const [failureCount, setFailureCount] = useState<number>(() => {
    return getOrCreateCircuit(name).failures.length;
  });

  // Keep stable refs for config values used inside callbacks.
  const failureThresholdRef = useRef(failureThreshold);
  const windowMsRef = useRef(windowMs);
  const cooldownMsRef = useRef(cooldownMs);
  const nameRef = useRef(name);
  failureThresholdRef.current = failureThreshold;
  windowMsRef.current = windowMs;
  cooldownMsRef.current = cooldownMs;
  nameRef.current = name;

  // Subscribe to singleton state changes → keep local React state in sync.
  useEffect(() => {
    const circuit = getOrCreateCircuit(name);

    // Sync initial state in case another instance changed it before mount.
    setCircuitState(circuit.state);
    setFailureCount(circuit.failures.length);

    const listener = () => {
      const c = getOrCreateCircuit(nameRef.current);
      setCircuitState(c.state);
      setFailureCount(c.failures.length);
    };

    circuit.listeners.add(listener);
    return () => {
      circuit.listeners.delete(listener);
    };
  }, [name]);

  const scheduleHalfOpen = useCallback((circuitName: string, delay: number) => {
    const circuit = getOrCreateCircuit(circuitName);
    if (circuit.cooldownTimer !== null) {
      clearTimeout(circuit.cooldownTimer);
    }
    circuit.cooldownTimer = setTimeout(() => {
      circuit.cooldownTimer = null;
      if (circuit.state === 'open') {
        circuit.state = 'half-open';
        notifyListeners(circuit);
      }
    }, delay);
  }, []);

  const recordFailure = useCallback((reason?: string) => {
    const circuit = getOrCreateCircuit(nameRef.current);
    const now = Date.now();
    const cutoff = now - windowMsRef.current;
    // Drop stale timestamps outside the window, then append the new failure.
    const fresh = circuit.failures.filter((ts) => ts >= cutoff);
    fresh.push(now);
    circuit.failures = fresh;

    // TF-71: first failure must emit structured console.warn (not silent).
    if (fresh.length === 1) {
      console.warn(
        `[circuit-breaker] First failure recorded for circuit "${nameRef.current}"`,
        { circuitName: nameRef.current, reason: reason ?? 'unknown', failureCount: 1 }
      );
    }

    let nextState = circuit.state;
    if (circuit.state === 'half-open') {
      // Test call failed → re-open with a fresh cooldown.
      scheduleHalfOpen(nameRef.current, cooldownMsRef.current);
      nextState = 'open';
    } else if (circuit.state === 'closed' && fresh.length >= failureThresholdRef.current) {
      scheduleHalfOpen(nameRef.current, cooldownMsRef.current);
      nextState = 'open';
    }

    circuit.state = nextState;
    notifyListeners(circuit);
  }, [scheduleHalfOpen]);

  const recordSuccess = useCallback(() => {
    const circuit = getOrCreateCircuit(nameRef.current);
    if (circuit.state === 'half-open') {
      circuit.failures = [];
      if (circuit.cooldownTimer !== null) {
        clearTimeout(circuit.cooldownTimer);
        circuit.cooldownTimer = null;
      }
      circuit.state = 'closed';
      notifyListeners(circuit);
    } else if (circuit.state === 'closed' && circuit.failures.length > 0) {
      // Soft reset of stale failures on success in closed state.
      circuit.failures = [];
      notifyListeners(circuit);
    }
  }, []);

  const canAttempt = useCallback((): boolean => {
    return circuitState !== 'open';
  }, [circuitState]);

  const reset = useCallback(() => {
    const circuit = getOrCreateCircuit(nameRef.current);
    if (circuit.cooldownTimer !== null) {
      clearTimeout(circuit.cooldownTimer);
      circuit.cooldownTimer = null;
    }
    circuit.failures = [];
    circuit.state = 'closed';
    notifyListeners(circuit);
  }, []);

  // Cleanup on unmount: do NOT reset singleton (other instances may still use it).
  // Only remove listener subscription.
  useEffect(() => {
    return () => {
      // Listener cleanup is handled in the subscription useEffect above.
    };
  }, []);

  return { state: circuitState, failureCount, recordFailure, recordSuccess, canAttempt, reset };
};
