/**
 * v1.15.0 Story 3.7 (AC3, AC4) — KONIEC ODPYTYWANIA mierzony LICZBĄ ŻĄDAŃ.
 *
 * Każdy przypadek w tym pliku pęka po zepsuciu JEDNEGO mechanizmu:
 *  • zdjęcie stanów porażki z `TERMINAL_CONFIRMATION_STATUSES` → pętla nie kończy się
 *    na `dead_lettered`,
 *  • usunięcie limitu zegarowego → brak `timed_out` i licznik żądań rośnie bez końca,
 *  • usunięcie natychmiastowego zakończenia na 401/403/404 → poller ponawia odmowę,
 *  • cofnięcie aliasów ledgera → `dead_lettered` znów mapuje się na `unknown`.
 *
 * Kontrola dodatnia jest tu obok negatywnej: przebieg udany też ma zapisaną
 * liczbę żądań, bo „skończyło się" bez liczby jest zdaniem, nie pomiarem.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createConfirmationPoller,
  type ConfirmationPollStop,
  type ConfirmationSnapshot
} from '../confirmation-poller';
import {
  CONFIRMATION_MAX_POLL_DURATION_MS,
  CONFIRMATION_POLL_INTERVAL_MS
} from '../order-confirmed-stepper';

type PaymentPayload = { status?: string };
type EntitlementPayload = { status?: string | null };

type Scripted = {
  payment?: { status?: number; body?: PaymentPayload };
  entitlements?: { status?: number; body?: EntitlementPayload[] };
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  } as unknown as Response;
}

/**
 * Zegar sterowany ręcznie. `Date.now()` byłby tu nieużyteczny: dowodzimy
 * zachowania po 10 minutach, a test nie może trwać 10 minut.
 */
function createHarness(script: (call: number) => Scripted) {
  let clock = 0;
  let paymentCalls = 0;
  let entitlementCalls = 0;

  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    const href = String(url);
    if (href.includes('/payment-status')) {
      paymentCalls += 1;
      const step = script(paymentCalls).payment ?? { status: 200, body: { status: 'paid' } };
      return jsonResponse(step.status ?? 200, step.body ?? {});
    }
    entitlementCalls += 1;
    const step = script(entitlementCalls).entitlements ?? { status: 200, body: [] };
    return jsonResponse(step.status ?? 200, step.body ?? []);
  }) as unknown as typeof fetch;

  return {
    fetchImpl,
    now: () => clock,
    advance(ms: number) {
      clock += ms;
    },
    get paymentCalls() {
      return paymentCalls;
    },
    get entitlementCalls() {
      return entitlementCalls;
    }
  };
}

async function drain(): Promise<void> {
  // Pozwala wybrzmieć łańcuchowi mikrozadań (`fetch` → `json` → `onSnapshot`).
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

describe('createConfirmationPoller — odpytywanie ma koniec', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('kontrola DODATNIA: sukces kończy pętlę i zapisuje liczbę żądań', async () => {
    const harness = createHarness(() => ({
      payment: { status: 200, body: { status: 'paid' } },
      entitlements: { status: 200, body: [{ status: 'issued' }] }
    }));

    const snapshots: ConfirmationSnapshot<PaymentPayload, EntitlementPayload>[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl: harness.fetchImpl,
      now: harness.now,
      callbacks: {
        onSnapshot: snapshot => snapshots.push(snapshot),
        onStop: () => {
          throw new Error('sukces nie może kończyć się przez onStop');
        }
      }
    });

    poller.start();
    await drain();

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].status).toBe('email_sent');
    expect(snapshots[0].terminal).toBe(true);
    // Dwa żądania: status płatności + uprawnienia. Jedno okrążenie, koniec.
    expect(snapshots[0].requestCount).toBe(2);
    expect(poller.getRequestCount()).toBe(2);

    // Po stanie terminalnym NIC więcej nie leci — nawet po upływie interwału.
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS * 5);
    expect(poller.getRequestCount()).toBe(2);
  });

  it('kontrola NEGATYWNA: dead_lettered kończy pętlę stanem porażki', async () => {
    const harness = createHarness(() => ({
      payment: { status: 200, body: { status: 'paid' } },
      entitlements: { status: 200, body: [{ status: 'dead_lettered' }] }
    }));

    const snapshots: ConfirmationSnapshot<PaymentPayload, EntitlementPayload>[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl: harness.fetchImpl,
      now: harness.now,
      callbacks: {
        onSnapshot: snapshot => snapshots.push(snapshot),
        onStop: () => undefined
      }
    });

    poller.start();
    await drain();

    expect(snapshots[0].status).toBe('delivery_failed');
    expect(snapshots[0].terminal).toBe(true);

    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS * 20);
    // 2 = jedno okrążenie. Przed tą story stan `dead_lettered` mapował się na
    // `unknown`, a `unknown` renderował spinner i odpytywał BEZ KOŃCA.
    expect(poller.getRequestCount()).toBe(2);
  });

  it('failed (nie dead_lettered) NIE kończy pętli — ledger dopuszcza retry', async () => {
    const harness = createHarness(() => ({
      payment: { status: 200, body: { status: 'paid' } },
      entitlements: { status: 200, body: [{ status: 'failed' }] }
    }));

    const snapshots: ConfirmationSnapshot<PaymentPayload, EntitlementPayload>[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl: harness.fetchImpl,
      now: harness.now,
      callbacks: {
        onSnapshot: snapshot => snapshots.push(snapshot),
        onStop: () => undefined
      }
    });

    poller.start();
    await drain();

    expect(snapshots[0].status).toBe('delivery_retrying');
    expect(snapshots[0].terminal).toBe(false);

    harness.advance(CONFIRMATION_POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    await drain();
    expect(poller.getRequestCount()).toBeGreaterThan(2);
  });

  it('twardy limit zegarowy kończy pętlę stanem timed_out (bez limitu — nieskończoność)', async () => {
    const harness = createHarness(() => ({
      // Status, który NIGDY się nie zmieni: powierzchnia czeka na dostawę,
      // a dostawa nie przychodzi. To jest przebieg, który przed tą story
      // odpytywał w nieskończoność.
      payment: { status: 200, body: { status: 'paid' } },
      entitlements: { status: 200, body: [] }
    }));

    const snapshots: ConfirmationSnapshot<PaymentPayload, EntitlementPayload>[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl: harness.fetchImpl,
      now: harness.now,
      callbacks: {
        onSnapshot: snapshot => snapshots.push(snapshot),
        onStop: () => undefined
      }
    });

    poller.start();
    await drain();
    expect(snapshots[0].status).toBe('paid');
    expect(snapshots[0].terminal).toBe(false);

    // Przeskakujemy PONAD limit zegarowy i pozwalamy odpalić kolejnemu tickowi.
    harness.advance(CONFIRMATION_MAX_POLL_DURATION_MS + 1);
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS);
    await drain();

    const last = snapshots[snapshots.length - 1];
    expect(last.status).toBe('timed_out');
    expect(last.terminal).toBe(true);

    const countAtTimeout = poller.getRequestCount();
    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS * 50);
    expect(poller.getRequestCount()).toBe(countAtTimeout);
  });

  // ── review-fix MEDIUM-3 ────────────────────────────────────────────────────
  //
  // Limit `maxDurationMs` był sprawdzany WYŁĄCZNIE między tickami, a same
  // żądania szły bez `AbortController`/`AbortSignal`. Serwer, który przyjmuje
  // połączenie i nigdy nie odpowiada, zawieszał `tick()` na `await` — limit
  // 600 s nigdy się nie sprawdzał, a powierzchnia zostawała w stanie sprzed
  // timeoutu. Ten test PĘKA (przez własny timeout) po zdjęciu sygnału.
  it('zawieszone żądanie NIE zawiesza pętli — każde żądanie ma własny zegar', async () => {
    vi.useRealTimers();

    const seenSignals: (AbortSignal | null | undefined)[] = [];
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      seenSignals.push(signal);
      // Żądanie, które NIGDY nie odpowiada — kończy je wyłącznie sygnał.
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as unknown as typeof fetch;

    const snapshots: ConfirmationSnapshot<PaymentPayload, EntitlementPayload>[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl,
      intervalMs: 1,
      requestTimeoutMs: 5,
      callbacks: {
        onSnapshot: snapshot => snapshots.push(snapshot),
        onStop: () => undefined
      }
    });

    poller.start();
    await new Promise(resolve => setTimeout(resolve, 120));
    poller.stop();

    expect(seenSignals.length).toBeGreaterThan(0);
    for (const signal of seenSignals) {
      expect(signal).toBeInstanceOf(AbortSignal);
    }
    // Pętla ŻYJE mimo zwisu: są zdjęcia stanu, a każde ma odczyt zdegradowany.
    expect(snapshots.length).toBeGreaterThan(0);
    expect(snapshots[0].readHealth).toBe('degraded');
    expect(snapshots[0].terminal).toBe(false);
    expect(poller.getRequestCount()).toBeGreaterThan(1);

    vi.useFakeTimers();
  });

  it.each<[number, ConfirmationPollStop]>([
    [401, 'access_denied_guest'],
    [403, 'access_denied'],
    [404, 'order_not_found']
  ])('HTTP %i kończy pętlę NATYCHMIAST jako %s', async (status, reason) => {
    const harness = createHarness(() => ({
      payment: { status, body: {} }
    }));

    const stops: ConfirmationPollStop[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl: harness.fetchImpl,
      now: harness.now,
      callbacks: {
        onSnapshot: () => {
          throw new Error('odmowa dostępu nie jest stanem dziedziny');
        },
        onStop: stopReason => stops.push(stopReason)
      }
    });

    poller.start();
    await drain();

    expect(stops).toEqual([reason]);
    // JEDNO żądanie. Ponawianie odmowy dostępu przez 10 minut jest defektem,
    // nie ostrożnością (`payment-status-poller.ts:114-119`).
    expect(poller.getRequestCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(CONFIRMATION_POLL_INTERVAL_MS * 10);
    expect(poller.getRequestCount()).toBe(1);
  });

  it('502 z BFF jest ODRÓŻNIALNY od pustej kolekcji i nie kończy pętli (AD-19)', async () => {
    const harness = createHarness(() => ({
      payment: { status: 200, body: { status: 'paid' } },
      entitlements: { status: 502, body: undefined }
    }));

    const snapshots: ConfirmationSnapshot<PaymentPayload, EntitlementPayload>[] = [];
    const poller = createConfirmationPoller<PaymentPayload, EntitlementPayload>({
      orderId: 'order_1',
      fetchImpl: harness.fetchImpl,
      now: harness.now,
      callbacks: {
        onSnapshot: snapshot => snapshots.push(snapshot),
        onStop: () => undefined
      }
    });

    poller.start();
    await drain();

    expect(snapshots[0].readHealth).toBe('degraded');
    expect(snapshots[0].terminal).toBe(false);
  });
});
