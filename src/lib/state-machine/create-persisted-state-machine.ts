/**
 * createPersistedStateMachine — UX-DR6 shared utility.
 *
 * Factory for a typed reducer-based state machine with optional sessionStorage
 * persistence. First consumer: voucher-PII consent moment (Story 2-1).
 *
 * Persistence rules (Risk #5, security audit):
 *   - sessionStorage MUST contain only state names + transition timestamps.
 *   - Never persist PII payloads, tokens, or secrets.
 *   - Caller can opt out by passing `storage: 'memory'`.
 *
 * NOTE: This module is consumed in client components. It MUST NOT import any
 * server-only modules — keep the barrel exports clean per CLAUDE.md.
 *
 * ePrivacy gate (v160-cleanup-34 / TF-80):
 *   sessionStorage writes are gated on `requireCategory("preferences")`.
 *   Revocation: clearPreferencesStorage() clears `gp.fsm.*` keys.
 */

import { requireCategory } from '@/lib/consent';

export type TransitionMap<TState extends string, TEvent extends string> = Record<
  TState,
  Partial<Record<TEvent, TState>>
>;

export interface PersistedSnapshot<TState extends string, TEvent extends string> {
  state: TState;
  history: ReadonlyArray<{ event: TEvent; from: TState; to: TState; at: number }>;
}

export interface CreatePersistedStateMachineOptions<
  TState extends string,
  TEvent extends string
> {
  /** Stable id used as sessionStorage key suffix (`gp.fsm.<id>`). */
  id: string;
  initial: TState;
  transitions: TransitionMap<TState, TEvent>;
  /** Default `'session'` (sessionStorage). Use `'memory'` for SSR/no-JS paths. */
  storage?: 'session' | 'memory';
  /** Hard cap to keep sessionStorage payload tiny. Default 16. */
  maxHistory?: number;
}

export interface PersistedStateMachine<TState extends string, TEvent extends string> {
  getState(): TState;
  getSnapshot(): PersistedSnapshot<TState, TEvent>;
  /** Returns next state if transition is valid, otherwise `null` (no throw). */
  send(event: TEvent): TState | null;
  /** Restore from a snapshot (e.g. SSR hydration). */
  restore(snapshot: PersistedSnapshot<TState, TEvent>): void;
  /** Reset to `initial` and clear persisted snapshot. */
  reset(): void;
  /** Subscribe to state changes. */
  subscribe(listener: (snapshot: PersistedSnapshot<TState, TEvent>) => void): () => void;
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

function safeSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const probe = '__gp_fsm_probe__';
    window.sessionStorage.setItem(probe, '1');
    window.sessionStorage.removeItem(probe);
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function createPersistedStateMachine<TState extends string, TEvent extends string>(
  options: CreatePersistedStateMachineOptions<TState, TEvent>
): PersistedStateMachine<TState, TEvent> {
  const { id, initial, transitions, storage = 'session', maxHistory = 16 } = options;
  const key = `gp.fsm.${id}`;
  const listeners = new Set<(snapshot: PersistedSnapshot<TState, TEvent>) => void>();

  let snapshot: PersistedSnapshot<TState, TEvent> = {
    state: initial,
    history: []
  };

  const persistTarget = storage === 'session' ? safeSessionStorage() : null;

  function persist(): void {
    if (!persistTarget) return;
    // ePrivacy gate (TF-80): skip write if preferences consent not granted.
    if (!requireCategory('preferences')) return;
    try {
      const payload: PersistedSnapshot<TState, TEvent> = {
        state: snapshot.state,
        history: snapshot.history.slice(-maxHistory)
      };
      persistTarget.setItem(key, JSON.stringify(payload));
    } catch {
      /* quota / serialization errors are non-fatal — persistence is best-effort */
    }
  }

  function notify(): void {
    listeners.forEach((listener) => listener(snapshot));
  }

  function load(): void {
    if (!persistTarget) return;
    try {
      const raw = persistTarget.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedSnapshot<TState, TEvent>;
      if (parsed && typeof parsed.state === 'string' && Array.isArray(parsed.history)) {
        snapshot = {
          state: parsed.state,
          history: parsed.history.slice(-maxHistory)
        };
      }
    } catch {
      /* corrupt payload — fall back to initial */
    }
  }

  load();

  return {
    getState(): TState {
      return snapshot.state;
    },
    getSnapshot(): PersistedSnapshot<TState, TEvent> {
      return snapshot;
    },
    send(event: TEvent): TState | null {
      const candidate = transitions[snapshot.state]?.[event];
      if (!candidate) return null;
      const next: PersistedSnapshot<TState, TEvent> = {
        state: candidate,
        history: [
          ...snapshot.history,
          { event, from: snapshot.state, to: candidate, at: Date.now() }
        ].slice(-maxHistory)
      };
      snapshot = next;
      persist();
      notify();
      return candidate;
    },
    restore(next: PersistedSnapshot<TState, TEvent>): void {
      snapshot = {
        state: next.state,
        history: next.history.slice(-maxHistory)
      };
      persist();
      notify();
    },
    reset(): void {
      snapshot = { state: initial, history: [] };
      if (persistTarget) {
        try {
          persistTarget.removeItem(key);
        } catch {
          /* ignore */
        }
      }
      notify();
    },
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
