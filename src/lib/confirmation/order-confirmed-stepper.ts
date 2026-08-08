/**
 * v1.15.0 Story 3.7 (FR-8 człon b, UX-DR10, AD-19) — dziedzina stanu potwierdzenia.
 *
 * ── Zmierzony stan sprzed tej story ────────────────────────────────────────
 * Enum miał SIEDEM wartości i ani jednej oznaczającej porażkę. Skutek był
 * domknięty i wynikał z czterech niezależnych decyzji „fail-soft":
 *
 *  1. `VoucherPipelineStatus` opisywał wyłącznie szczęśliwą ścieżkę,
 *  2. `ENTITLEMENT_STATUS_ALIASES` nie znało ani `failed`, ani `dead_lettered`
 *     — a oba są realnymi stanami ledgera dostarczeń
 *     (`GP/backend/packages/api/src/modules/voucher-delivery/delivery-state.ts`),
 *     więc porażka mapowała się na `null` → fallback → `'unknown'`,
 *  3. `getActiveIndex('unknown')` zwracało `1` z komentarzem „fail-soft", czyli
 *     krok „generujemy voucher" — kręcące się kółko,
 *  4. `shouldStopConfirmationPolling` wymieniało WYŁĄCZNIE stany sukcesu, więc
 *     pętla `setInterval(5_000)` nie miała żadnego warunku końca.
 *
 * Razem: zdarzenie porażki, które ISTNIEJE w bazie, docierało do przeglądarki
 * i było tam zamieniane w nieskończony spinner nad obciążoną kartą.
 *
 * ── Co ta story zmienia ────────────────────────────────────────────────────
 * Porażka dostaje reprezentację w dziedzinie, a odpytywanie dostaje koniec.
 * Wzorzec nie jest wymyślany: `src/lib/payment/payment-status-poller.ts` ma go
 * od v1.8.0 (twardy limit zegarowy + nazwany stan końcowy + zbiór stanów
 * terminalnych + natychmiastowe zakończenie na 401/403). Ta story ROZCIĄGA go
 * na powierzchnię potwierdzenia, zamiast pisać drugi o innej dyscyplinie.
 */

export type VoucherPipelineStatus =
  | 'pending_payment'
  | 'paid'
  | 'voucher_generating'
  | 'voucher_issued'
  | 'email_sent'
  | 'recipient_opened'
  /**
   * Dostawa jest ponawiana. NIE jest terminalna: kontrakt ledgera wprost
   * dopuszcza retry z `failed` i `retrying`
   * (`delivery-state.ts` → `DISPATCH_STATES_ALLOWING_RETRY`). Traktowanie
   * `failed` jako końca byłoby kłamstwem w drugą stronę — powiedzielibyśmy
   * kupującej „nie udało się", podczas gdy system jeszcze próbuje.
   */
  | 'delivery_retrying'
  /**
   * Dostawa zawiodła TERMINALNIE — `dead_lettered`. Z tego stanu ledger nie
   * przewiduje wyjścia: `DISPATCH_STATES_ALLOWING_RETRY` go nie wymienia.
   */
  | 'delivery_failed'
  /**
   * Płatność jest w stanie terminalnej porażki. Osiągalne z realnego słownika
   * `/api/v1/orders/{id}/payment-status` (`failed_retryable`,
   * `failed_nonretryable`, `expired`, `support_required`) — do tej story ŻADEN
   * z tych czterech nie miał aliasu, więc każdy kończył jako `'unknown'`,
   * czyli jako spinner.
   */
  | 'payment_failed'
  /**
   * Twardy limit zegarowy odpytywania został przekroczony. Nazwany stan końca,
   * nie ten sam „generating" co w 5. sekundzie.
   */
  | 'timed_out'
  /**
   * Wartość spoza dziedziny. Po tej story `unknown` NIE renderuje już kroku
   * „generujemy" — AD-19 mówi, że wartość spoza dziedziny jest błędem, a nie
   * wartością domyślną.
   */
  | 'unknown';

export type EntitlementSignal = {
  status?: string | null;
};

export type StepState = 'done' | 'active' | 'future';

export interface ConfirmationStep {
  id: 'paid' | 'voucher_generating' | 'email_sent' | 'recipient_opened';
  state: StepState;
}

export interface ConfirmationStepperState {
  status: VoucherPipelineStatus;
  steps: readonly ConfirmationStep[];
  activeStepId: ConfirmationStep['id'] | null;
}

/**
 * Twardy limit zegarowy odpytywania powierzchni potwierdzenia.
 *
 * 10 minut, czyli DOKŁADNIE tyle, co `MAX_POLL_DURATION_MS`
 * (`payment-status-poller.ts:23`). Wybór nie jest domyślny: dwa pollery na
 * sąsiednich ekranach tej samej ścieżki zakupowej, mierzące ten sam rodzaj
 * oczekiwania, mają mieć tę samą dyscyplinę. Inna liczba tutaj wymagałaby
 * uzasadnienia, którego nie ma.
 */
export const CONFIRMATION_MAX_POLL_DURATION_MS = 600_000;

/** Odstęp odpytywania — zastany (`ConfirmationPageContent`), wyniesiony do stałej. */
export const CONFIRMATION_POLL_INTERVAL_MS = 5_000;

/**
 * Twardy zegar POJEDYNCZEGO żądania planisty (review-fix MEDIUM-3).
 *
 * Limit `CONFIRMATION_MAX_POLL_DURATION_MS` był sprawdzany wyłącznie MIĘDZY
 * tickami, więc żądanie, które serwer przyjął i nigdy nie odpowiedział,
 * omijało go w całości: `tick()` zawisał na `await`, a powierzchnia zostawała
 * w stanie sprzed timeoutu — bez `timed_out`, bez komunikatu, z tym samym
 * krokiem co w 5. sekundzie. 15 s to trzykrotność odstępu odpytywania: dłużej
 * niż realna odpowiedź backendu, krócej niż okno, w którym człowiek uzna ekran
 * za zawieszony.
 */
export const CONFIRMATION_REQUEST_TIMEOUT_MS = 15_000;

const STATUS_ALIASES: Record<string, VoucherPipelineStatus> = {
  paid: 'paid',
  pending_psp: 'pending_payment',
  pending_psp_confirmation: 'pending_payment',
  not_paid: 'pending_payment',
  awaiting: 'pending_payment',
  authorized: 'pending_payment',
  partially_authorized: 'pending_payment',
  voucher_generating: 'voucher_generating',
  voucher_generated: 'voucher_issued',
  voucher_issued: 'voucher_issued',
  email_sent: 'email_sent',
  recipient_opened: 'recipient_opened',
  // ── Story 3.7 ────────────────────────────────────────────────────────────
  // Słownik `/api/v1/orders/{id}/payment-status` ma SZEŚĆ stanów
  // (`payment-status-v180-adapter.ts`); do tej story aliasy znały dwa. Cztery
  // pozostałe — wszystkie oznaczające kłopot — spadały na `'unknown'`, czyli
  // na spinner. To jest ta sama klasa defektu co brak `failed` w aliasach
  // uprawnień, tylko o jedno ogniwo wcześniej.
  failed_retryable: 'payment_failed',
  failed_nonretryable: 'payment_failed',
  expired: 'payment_failed',
  support_required: 'payment_failed'
};

const ENTITLEMENT_STATUS_ALIASES: Record<string, VoucherPipelineStatus> = {
  issued: 'email_sent',
  delivered: 'email_sent',
  sent: 'email_sent',
  email_sent: 'email_sent',
  queued: 'voucher_generating',
  active: 'recipient_opened',
  opened: 'recipient_opened',
  recipient_opened: 'recipient_opened',
  partially_redeemed: 'recipient_opened',
  redeemed: 'recipient_opened',
  redeemed_partial: 'recipient_opened',
  redeemed_full: 'recipient_opened',
  settled: 'recipient_opened',
  closed: 'recipient_opened',
  // ── Story 3.7: realne stany ledgera dostarczeń ───────────────────────────
  // Źródło: `DELIVERY_DISPATCH_STATES` w
  // `GP/backend/packages/api/src/modules/voucher-delivery/delivery-state.ts`.
  // Trzy z siedmiu wartości nie miały tu odpowiednika i przez to nie miały na
  // powierzchni ŻADNEGO konsumenta.
  //
  // `degraded` NIE jest porażką. Kontrakt mówi wprost, że to dostarczenie
  // w trybie zdegradowanym — mail POSZEDŁ (`delivery-state.ts`,
  // `DISPATCH_STATES_BLOCKING_RESEND` zawiera `degraded` właśnie dlatego).
  // Pokazanie kupującej „nie udało się" po wysłanym mailu byłoby błędem
  // w drugą stronę.
  degraded: 'email_sent',
  retrying: 'delivery_retrying',
  failed: 'delivery_retrying',
  dead_lettered: 'delivery_failed'
};

const STEP_ORDER: readonly ConfirmationStep['id'][] = [
  'paid',
  'voucher_generating',
  'email_sent',
  'recipient_opened'
];

/**
 * Stany, po których odpytywanie NIE MA już sensu — sukces albo porażka.
 *
 * Odpowiednik `TERMINAL_STATUSES_V180` z `payment-status-v180-adapter.ts`.
 * Jeden zbiór, jedna prawda: `shouldStopConfirmationPolling` jest jego
 * predykatem, a nie drugą, rozjeżdżalną listą.
 */
export const TERMINAL_CONFIRMATION_STATUSES: ReadonlySet<VoucherPipelineStatus> = new Set([
  'voucher_issued',
  'email_sent',
  'recipient_opened',
  'delivery_failed',
  'payment_failed',
  'timed_out'
]);

/** Podzbiór terminalnych, które są PORAŻKĄ — powierzchnia renderuje je inaczej. */
export const FAILURE_CONFIRMATION_STATUSES: ReadonlySet<VoucherPipelineStatus> = new Set([
  'delivery_failed',
  'payment_failed',
  'timed_out'
]);

export function isTerminalConfirmationStatus(status: VoucherPipelineStatus): boolean {
  return TERMINAL_CONFIRMATION_STATUSES.has(status);
}

export function isFailureConfirmationStatus(status: VoucherPipelineStatus): boolean {
  return FAILURE_CONFIRMATION_STATUSES.has(status);
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '***@***';

  const trimmed = email.trim();
  const [localRaw, domainRaw] = trimmed.split('@');
  if (!localRaw || !domainRaw) return '***@***';

  const local = localRaw.toLowerCase();
  const domain = domainRaw.toLowerCase();

  const localMasked =
    local.length <= 2
      ? `${local[0] ?? '*'}*`
      : `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}`;

  const domainParts = domain.split('.').filter(Boolean);
  if (domainParts.length === 0) return `${localMasked}@***`;

  const root = domainParts[0];
  const tld = domainParts.slice(1).join('.') || '*';
  const rootMasked =
    root.length <= 2
      ? `${root[0] ?? '*'}*`
      : `${root[0]}${'*'.repeat(Math.max(root.length - 2, 1))}${root[root.length - 1]}`;

  return `${localMasked}@${rootMasked}.${tld}`;
}

export function normalizeVoucherPipelineStatus(
  rawStatus: string | null | undefined
): VoucherPipelineStatus {
  if (!rawStatus) return 'unknown';
  const normalized = rawStatus.trim().toLowerCase();
  return STATUS_ALIASES[normalized] ?? 'unknown';
}

export function normalizeEntitlementPipelineStatus(
  rawStatus: string | null | undefined
): VoucherPipelineStatus | null {
  if (!rawStatus) return null;
  const normalized = rawStatus.trim().toLowerCase();
  return ENTITLEMENT_STATUS_ALIASES[normalized] ?? null;
}

/**
 * Wywodzi stan potoku dla JEDNEGO zamówienia z sygnału płatności i uprawnień.
 *
 * ── Pierwszeństwo i dlaczego takie ────────────────────────────────────────
 * `delivery_failed` (czyli `dead_lettered`) wygrywa z KAŻDYM sygnałem sukcesu
 * innego uprawnienia tego samego zamówienia. Zamówienie z dwoma voucherami,
 * z których jeden trafił do kosza martwych listów, NIE jest zamówieniem
 * dostarczonym — a wcześniejsza kolejność („recipient_opened, potem
 * email_sent, potem płatność") pokazałaby tu sukces i zatrzymała odpytywanie
 * na kłamstwie.
 *
 * `delivery_retrying` wygrywa z `email_sent`, ale przegrywa z
 * `recipient_opened`: skoro któryś odbiorca voucher OTWORZYŁ, to trwający
 * retry dotyczy innego kanału i nie jest już najważniejszą informacją na
 * ekranie. Odpytywanie i tak trwa dalej — `recipient_opened` jest terminalne,
 * więc ta gałąź jest osiągalna tylko przy pełnym sukcesie.
 */
export function deriveVoucherPipelineStatus(
  paymentStatusRaw: string | null | undefined,
  entitlements: EntitlementSignal[]
): VoucherPipelineStatus {
  const entitlementStatuses = entitlements
    .map(entitlement => normalizeEntitlementPipelineStatus(entitlement.status))
    .filter((status): status is VoucherPipelineStatus => Boolean(status));

  if (entitlementStatuses.includes('delivery_failed')) {
    return 'delivery_failed';
  }
  if (entitlementStatuses.includes('recipient_opened')) {
    return 'recipient_opened';
  }
  if (entitlementStatuses.includes('delivery_retrying')) {
    return 'delivery_retrying';
  }
  if (entitlementStatuses.includes('email_sent')) {
    return 'email_sent';
  }

  const paymentStatus = normalizeVoucherPipelineStatus(paymentStatusRaw);
  if (paymentStatus === 'voucher_issued') {
    return 'email_sent';
  }

  return paymentStatus;
}

function getActiveIndex(status: VoucherPipelineStatus): number | null {
  switch (status) {
    case 'pending_payment':
      return 0;
    case 'paid':
    case 'voucher_generating':
      return 1;
    case 'voucher_issued':
      return 2;
    case 'delivery_retrying':
      // Voucher powstał; potyka się KROK WYSYŁKI, więc aktywny jest krok 3,
      // a nie „generowanie". Poprzednia mapa nie miała jak tego wyrazić.
      return 2;
    case 'email_sent':
      return 3;
    case 'recipient_opened':
      return null;
    case 'delivery_failed':
    case 'payment_failed':
    case 'timed_out':
      // Stany terminalne porażki nie mają kroku „w trakcie" — powierzchnia
      // renderuje dla nich osobny blok z radą, nie kolejne kółko.
      return null;
    case 'unknown':
    default:
      // Story 3.7: było `return 1` z komentarzem „fail-soft for missing backend
      // step-2/3/4 data". To był jeden z czterech mechanizmów produkujących
      // nieskończony spinner: wartość spoza dziedziny wyglądała jak
      // „generujemy". AD-19: wartość spoza dziedziny jest BŁĘDEM, nie domyślną.
      return null;
  }
}

function getCompletedThroughIndex(status: VoucherPipelineStatus): number {
  switch (status) {
    case 'pending_payment':
    case 'payment_failed':
      return -1;
    case 'unknown':
      // Review-fix LOW-1: `unknown` powstaje m.in. wtedy, gdy OBA odczyty
      // padły (`readHealth: 'degraded'`, `paymentStatus: null`). Zwracanie `0`
      // sprawiało, że krok „Opłacone ✓" dostawał stan `done` i haczyk — czyli
      // powierzchnia stwierdzała fakt zapłaty NIE MAJĄC ani jednego udanego
      // odczytu. To była resztka fail-soft, której story nie usunęła.
      return -1;
    case 'timed_out':
      // `timed_out` zostaje na `0` ŚWIADOMIE: do przekroczenia limitu pętla
      // zdążyła zwykle potwierdzić płatność, a cofnięcie haczyka mówiłoby
      // kupującej „nie zapłaciłaś" nad realnie obciążoną kartą. Rozstrzygnięcie
      // jest tu ZAPISANE, żeby nie wyglądało na przeoczenie.
      return 0;
    case 'paid':
    case 'voucher_generating':
      return 0;
    case 'voucher_issued':
    case 'delivery_retrying':
    case 'delivery_failed':
      return 1;
    case 'email_sent':
      return 2;
    case 'recipient_opened':
      return 3;
    default:
      return 0;
  }
}

/**
 * Buduje stan steppera z JUŻ ROZSTRZYGNIĘTEGO stanu dziedziny.
 *
 * Wariant `buildConfirmationStepperState` (poniżej) przyjmuje surowy string
 * i normalizuje go. Powierzchnia woła TĘ funkcję, bo `deriveVoucherPipelineStatus`
 * zwraca już wartość dziedziny — ponowna normalizacja gubiłaby stany, których
 * nie ma w `STATUS_ALIASES` (np. `delivery_failed`) i cicho zamieniała je
 * w `unknown`.
 */
export function buildConfirmationStepperStateFrom(
  status: VoucherPipelineStatus
): ConfirmationStepperState {
  const activeIndex = getActiveIndex(status);
  const completedThrough = getCompletedThroughIndex(status);

  const steps = STEP_ORDER.map((id, idx) => {
    let state: StepState = 'future';
    if (idx <= completedThrough) state = 'done';
    if (activeIndex === idx) state = 'active';
    return { id, state };
  });

  const activeStepId = activeIndex === null ? null : STEP_ORDER[activeIndex];

  return {
    status,
    steps,
    activeStepId
  };
}

export function buildConfirmationStepperState(
  rawStatus: string | null | undefined
): ConfirmationStepperState {
  return buildConfirmationStepperStateFrom(normalizeVoucherPipelineStatus(rawStatus));
}

/**
 * Warunek KOŃCA odpytywania.
 *
 * Do Story 3.7 wymieniał trzy stany i wszystkie trzy były sukcesem. Teraz jest
 * predykatem zbioru `TERMINAL_CONFIRMATION_STATUSES` — dopisanie stanu do
 * dziedziny bez rozstrzygnięcia, czy kończy pętlę, przestało być możliwe.
 */
export function shouldStopConfirmationPolling(status: VoucherPipelineStatus): boolean {
  return isTerminalConfirmationStatus(status);
}

export function getGeneratingElapsedSeconds(generatingStartedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - generatingStartedAtMs) / 1000));
}

export function isSecondTierGenerating(elapsedSeconds: number, thresholdSeconds = 90): boolean {
  return elapsedSeconds >= thresholdSeconds;
}

/**
 * Rozstrzygnięcie kardynalności powierzchni wobec kontraktu (AC2, AD-16).
 *
 * `expected` pochodzi z `order_count` mostka
 * `GET /store/carts/:id/completed-order` — to jest JEDYNY kształt liczności
 * osiągalny dla przeglądarki. Kontrakt liczności ze Story 3.4 żyje na
 * odpowiedzi WEBHOOKA do Stripe'a i powierzchnia nigdy go nie widzi; zapis
 * tego pomiaru jest w evidence tej story.
 *
 * `null` znaczy „kontrakt nie podał liczności" — i to jest osobny stan, nie
 * zgodność. Cicha lista krótsza niż zakup jest defektem, o którym mówi AC2.
 */
export type ConfirmationCardinality =
  | { kind: 'unknown_expected' }
  | { kind: 'complete'; rendered: number; expected: number }
  | { kind: 'partial'; rendered: number; expected: number }
  | { kind: 'over_reported'; rendered: number; expected: number };

export function resolveConfirmationCardinality(
  rendered: number,
  expected: number | null | undefined
): ConfirmationCardinality {
  if (typeof expected !== 'number' || !Number.isFinite(expected) || expected <= 0) {
    return { kind: 'unknown_expected' };
  }
  if (rendered === expected) {
    return { kind: 'complete', rendered, expected };
  }
  if (rendered < expected) {
    return { kind: 'partial', rendered, expected };
  }
  return { kind: 'over_reported', rendered, expected };
}
