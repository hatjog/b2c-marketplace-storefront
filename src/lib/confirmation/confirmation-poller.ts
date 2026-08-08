/**
 * v1.15.0 Story 3.7 (FR-8 człon b, UX-DR10, AD-19, NFR-1) — planista odpytywania
 * powierzchni potwierdzenia dla JEDNEGO zamówienia.
 *
 * ── Dlaczego osobny moduł, a nie `useEffect` w komponencie ─────────────────
 * Do tej story pętla siedziała wprost w `ConfirmationPageContent`
 * (`setInterval(..., 5_000)`), więc jedynym sposobem zmierzenia „czy to się
 * kiedykolwiek kończy" było wyrenderowanie strony i patrzenie na nią. Efekt:
 * nikt tego nie zmierzył, a pętla nie miała ŻADNEGO warunku końca poza trzema
 * stanami sukcesu.
 *
 * Ten moduł jest CZYSTY: zegar i `fetch` są wstrzykiwane, a licznik żądań jest
 * częścią wyniku. Dzięki temu zdanie „odpytywanie ma koniec" da się zamienić
 * w liczbę (AC4 wymaga liczby, nie zdania).
 *
 * ── Wzorzec ────────────────────────────────────────────────────────────────
 * Dyscyplina jest ROZCIĄGNIĘTA z `src/lib/payment/payment-status-poller.ts`,
 * nie wymyślona: twardy limit zegarowy (`MAX_POLL_DURATION_MS`), nazwany stan
 * końcowy zamiast cichego zamilknięcia, zbiór stanów terminalnych oraz
 * natychmiastowe zakończenie na `401`/`403` (`payment-status-poller.ts:114-119`
 * — ponawianie odmowy dostępu przez 10 minut jest defektem, nie ostrożnością).
 */

import {
  CONFIRMATION_MAX_POLL_DURATION_MS,
  CONFIRMATION_POLL_INTERVAL_MS,
  CONFIRMATION_REQUEST_TIMEOUT_MS,
  deriveVoucherPipelineStatus,
  normalizeVoucherPipelineStatus,
  shouldStopConfirmationPolling,
  type EntitlementSignal,
  type VoucherPipelineStatus
} from './order-confirmed-stepper';

/** Powód, dla którego odpytywanie skończyło się BEZ stanu dziedziny. */
export type ConfirmationPollStop =
  /** `401` — brak dowodu dostępu (typowo gość po utracie cookie). */
  | 'access_denied_guest'
  /** `403` — sesja bez uprawnienia do tego zamówienia. */
  | 'access_denied'
  /** `404` — identyfikator spoza dziedziny; ponawianie nigdy tego nie naprawi. */
  | 'order_not_found';

export type ConfirmationReadHealth = 'ok' | 'degraded';

export interface ConfirmationSnapshot<
  TPayment = unknown,
  TEntitlement extends EntitlementSignal = EntitlementSignal
> {
  status: VoucherPipelineStatus;
  paymentStatus: TPayment | null;
  entitlements: TEntitlement[];
  /**
   * `degraded` znaczy: odczyt się nie udał i wiemy o tym. AD-19 — odpowiedź
   * zdegradowana NIGDY jako pusta kolekcja. Do tej story BFF `/api/v1/entitlements`
   * zwracał `[]` z HTTP 200 dla każdej awarii backendu, więc „nie ma jeszcze
   * voucherów" i „backend leży" były na kliencie nieodróżnialne.
   */
  readHealth: ConfirmationReadHealth;
  /** Ile żądań HTTP wykonano od startu. Ta liczba JEST dowodem (AC4). */
  requestCount: number;
  /** Ile milisekund upłynęło od startu do tego zdjęcia stanu. */
  elapsedMs: number;
  /** `true`, gdy po tym zdjęciu stanu pętla już się nie odezwie. */
  terminal: boolean;
  /** Czy co najmniej jeden udany odczyt potwierdził płatność. */
  paymentConfirmed: boolean;
}

export interface ConfirmationPollerCallbacks<TPayment, TEntitlement extends EntitlementSignal> {
  onSnapshot: (snapshot: ConfirmationSnapshot<TPayment, TEntitlement>) => void;
  /** Zakończenie BEZ stanu dziedziny — powód jest nazwany, nie zgadywany. */
  onStop: (
    reason: ConfirmationPollStop,
    snapshot: { requestCount: number; elapsedMs: number }
  ) => void;
}

export interface ConfirmationPollerOptions<TPayment, TEntitlement extends EntitlementSignal> {
  orderId: string;
  callbacks: ConfirmationPollerCallbacks<TPayment, TEntitlement>;
  /** Wstrzykiwalne, żeby test mógł policzyć żądania i wymusić porażkę. */
  fetchImpl?: typeof fetch;
  now?: () => number;
  intervalMs?: number;
  maxDurationMs?: number;
  /**
   * Twardy zegar POJEDYNCZEGO żądania. Review-fix MEDIUM-3: limit
   * `maxDurationMs` był sprawdzany wyłącznie MIĘDZY tickami, więc żądanie,
   * które serwer przyjął i nigdy nie odpowiedział, omijało go w całości —
   * `tick()` zawisał na `await`, a powierzchnia zostawała w stanie sprzed
   * timeoutu, bez `timed_out` i bez komunikatu.
   */
  requestTimeoutMs?: number;
}

export interface ConfirmationPoller {
  start: () => void;
  stop: () => void;
  getRequestCount: () => number;
}

type ReadResult<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'stop'; reason: ConfirmationPollStop }
  | { kind: 'degraded' };

async function readJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  onRequest: () => void,
  timeoutMs: number
): Promise<ReadResult<T>> {
  onRequest();
  try {
    // `AbortSignal.timeout` jest tu ISTOTĄ, nie ozdobą: bez niego zwis
    // połączenia zawiesza całą pętlę i twardy limit zegarowy nigdy się nie
    // sprawdzi. Timeout kończy się `degraded` (a nie stopem), bo zwis jest
    // przejściowy — ale POD limitem `maxDurationMs`, więc i on ma koniec.
    const res = await fetchImpl(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!res.ok) {
      // Stany, których ponawianie NIGDY nie naprawi — kończymy natychmiast.
      if (res.status === 401) return { kind: 'stop', reason: 'access_denied_guest' };
      if (res.status === 403) return { kind: 'stop', reason: 'access_denied' };
      if (res.status === 404) return { kind: 'stop', reason: 'order_not_found' };
      return { kind: 'degraded' };
    }

    return { kind: 'ok', data: (await res.json()) as T };
  } catch {
    // Awaria sieci jest przejściowa — zostaje w `degraded` i pętla trwa, ale
    // trwa POD LIMITEM ZEGAROWYM, więc i ona ma koniec.
    return { kind: 'degraded' };
  }
}

/**
 * Buduje planistę odpytywania dla jednego zamówienia.
 *
 * Kontrakt zakończenia (każde wyjście jest NAZWANE):
 *  • stan terminalny dziedziny (sukces albo porażka) → `onSnapshot` z `terminal: true`,
 *  • `401`/`403`/`404` → `onStop(reason)` NATYCHMIAST, bez czekania na limit,
 *  • przekroczony limit zegarowy → `onSnapshot({ status: 'timed_out', terminal: true })`.
 *
 * Nie ma wyjścia „pętla po prostu ucichła".
 */
export function createConfirmationPoller<
  TPayment extends { status?: string },
  TEntitlement extends EntitlementSignal
>(options: ConfirmationPollerOptions<TPayment, TEntitlement>): ConfirmationPoller {
  const {
    orderId,
    callbacks,
    fetchImpl = fetch,
    now = () => Date.now(),
    intervalMs = CONFIRMATION_POLL_INTERVAL_MS,
    maxDurationMs = CONFIRMATION_MAX_POLL_DURATION_MS,
    requestTimeoutMs = CONFIRMATION_REQUEST_TIMEOUT_MS
  } = options;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let startedAt = 0;
  let requestCount = 0;
  let paymentConfirmed = false;

  const countRequest = () => {
    requestCount += 1;
  };

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function finish() {
    active = false;
    clear();
  }

  async function tick(): Promise<void> {
    if (!active) return;

    const elapsedMs = now() - startedAt;

    if (elapsedMs >= maxDurationMs) {
      finish();
      callbacks.onSnapshot({
        status: 'timed_out',
        paymentStatus: null,
        entitlements: [],
        readHealth: 'degraded',
        requestCount,
        elapsedMs,
        terminal: true,
        paymentConfirmed
      });
      return;
    }

    const paymentRead = await readJson<TPayment>(
      fetchImpl,
      `/api/v1/orders/${orderId}/payment-status`,
      countRequest,
      requestTimeoutMs
    );

    if (!active) return;

    if (paymentRead.kind === 'stop') {
      finish();
      callbacks.onStop(paymentRead.reason, { requestCount, elapsedMs: now() - startedAt });
      return;
    }

    const entitlementRead = await readJson<TEntitlement[]>(
      fetchImpl,
      `/api/v1/entitlements?order_id=${encodeURIComponent(orderId)}`,
      countRequest,
      requestTimeoutMs
    );

    if (!active) return;

    if (entitlementRead.kind === 'stop') {
      finish();
      callbacks.onStop(entitlementRead.reason, { requestCount, elapsedMs: now() - startedAt });
      return;
    }

    const paymentStatus = paymentRead.kind === 'ok' ? paymentRead.data : null;
    if (normalizeVoucherPipelineStatus(paymentStatus?.status) === 'paid') {
      paymentConfirmed = true;
    }
    const entitlements =
      entitlementRead.kind === 'ok' && Array.isArray(entitlementRead.data)
        ? entitlementRead.data
        : [];
    const readHealth: ConfirmationReadHealth =
      paymentRead.kind === 'degraded' || entitlementRead.kind === 'degraded' ? 'degraded' : 'ok';

    const status = deriveVoucherPipelineStatus(paymentStatus?.status, entitlements);
    // Review-fix MEDIUM-2: planista woła `shouldStopConfirmationPolling`, a nie
    // `isTerminalConfirmationStatus` wprost. Do tej poprawki predykat warunku
    // stopu NIE MIAŁ w produkcji ani jednego wywołania — człon 3 bramki
    // pilnował funkcji martwej, a realny warunek końca pętli nie był mierzony
    // przez nikogo.
    const terminal = shouldStopConfirmationPolling(status);

    if (terminal) {
      finish();
    }

    callbacks.onSnapshot({
      status,
      paymentStatus,
      entitlements,
      readHealth,
      requestCount,
      elapsedMs: now() - startedAt,
      terminal,
      paymentConfirmed
    });

    if (!terminal && active) {
      timer = setTimeout(() => {
        void tick();
      }, intervalMs);
    }
  }

  return {
    start() {
      if (active) return;
      active = true;
      startedAt = now();
      requestCount = 0;
      paymentConfirmed = false;
      void tick();
    },
    stop() {
      finish();
    },
    getRequestCount() {
      return requestCount;
    }
  };
}
