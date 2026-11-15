/**
 * v1.16.0 Story 8.3 AC1 (FR-15, AD-18) — każdy punkt przerwania z inwentarza
 * 8.1 (`evidence/8-1/3ds-return-path-inventory.v1.md`, gałęzie synch. 3–8)
 * daje stan ∉ {sukces, nigdy-nierozpoczęty}. Kontrole dodatnie: realny sukces
 * ⇒ `success`; powrót bez żadnego śladu płatności ⇒ `never_started`.
 *
 * Punkty synch. 1–2 (inicjacja, confirm) kończą się PRZED przekierowaniem —
 * nie ma powrotu na stronę statusu, więc nie mają stanu powrotu (macierz
 * `evidence/8-3/interruption-state-matrix.v1.md`).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Story 8.3 fix R-1: każdy punkt przerwania przechodzi przez PRODUKCYJNY
// resolver `resolvePaymentReturn` (ten sam, który woła strona powrotu).
// Zamockowane są wyłącznie granice I/O (`cart`, `cookies`) — jak w
// `lib/data/__tests__/payment-return.test.ts`. Cykl życia czytamy z pola
// `lifecycle` wyniku resolvera, które strona niesie w `data-return-lifecycle`.
// Żaden punkt nie jest literałem `{state, reason}`.

const getCompletedPurchaseForCart = vi.fn();
const provesCartOwnership = vi.fn();
const getPaymentReturnOutcome = vi.fn();
const getPaymentReturnOutcomeStorageState = vi.fn();

vi.mock('@/lib/data/cart', () => ({
  completeOrderAfterStripePayment: vi.fn(),
  getCompletedPurchaseForCart: (...args: unknown[]) => getCompletedPurchaseForCart(...args),
  cartHasStripePaymentIntent: async () => true,
  getStripePaymentIntentBinding: async () => 'bound',
  getPaymentChargeForCart: async () => 'unknown'
}));

vi.mock('@/lib/data/cookies', () => ({
  provesCartOwnership: (...args: unknown[]) => provesCartOwnership(...args),
  getPaymentReturnOutcome: (...args: unknown[]) => getPaymentReturnOutcome(...args),
  getPaymentReturnOutcomeStorageState: (...args: unknown[]) =>
    getPaymentReturnOutcomeStorageState(...args)
}));

const { resolvePaymentReturn } = await import('@/lib/data/payment-return');
const { parsePaymentChargeFact, paymentChargeMessageKey } = await import('../payment-return-state');

const CART = 'cart_01STORY83INTERRUPT';
const PI = 'pi_3STORY83';
const SUCCEEDED = { payment_intent: PI, redirect_status: 'succeeded' };

type Bridge = 'empty' | 'complete' | 'incomplete' | 'malformed' | 'read_failed' | 'access_denied';

type Scenario = {
  point: string;
  identifier?: string;
  search: Record<string, string | string[]>;
  outcome?: string | null;
  bridge?: Bridge | 'throws';
  owner?: boolean;
  storage?: 'ready' | 'secret_unavailable' | 'capacity_exhausted';
  expected: { state: string; reason?: string };
};

function arrange(s: Omit<Scenario, 'point' | 'expected' | 'search'>) {
  provesCartOwnership.mockResolvedValue(s.owner ?? true);
  getPaymentReturnOutcome.mockResolvedValue(s.outcome ?? null);
  getPaymentReturnOutcomeStorageState.mockResolvedValue(s.storage ?? 'ready');
  const bridge = s.bridge ?? 'empty';
  if (bridge === 'throws') {
    getCompletedPurchaseForCart.mockRejectedValue(new Error('ECONNRESET'));
  } else {
    getCompletedPurchaseForCart.mockResolvedValue({
      orderIds: bridge === 'complete' || bridge === 'incomplete' ? ['order_01A'] : [],
      expectedOrderCount: bridge === 'incomplete' ? 2 : null,
      state: bridge,
      readFailed: bridge === 'read_failed'
    });
  }
}

async function resolve(s: Omit<Scenario, 'point' | 'expected'>) {
  arrange(s);
  return resolvePaymentReturn(s.identifier ?? CART, s.search, 'pl');
}

/** Punkty przerwania z inwentarza 8.1 (synch. 3–8) — wszystkie przez resolver. */
const INTERRUPTION_POINTS: Scenario[] = [
  {
    point: 'synch. 3 — challenge 3DS porzucony (redirect_status=failed)',
    search: { payment_intent: PI, redirect_status: 'failed' },
    expected: { state: 'authentication_abandoned', reason: 'redirect_status_failed' }
  },
  {
    point: 'synch. 3 — powrót z intencją bez potwierdzenia (redirect_status=processing)',
    search: { payment_intent: PI, redirect_status: 'processing' },
    expected: { state: 'pending_confirmation', reason: 'return_interrupted' }
  },
  {
    point: 'synch. 4 — identyfikator spoza dziedziny',
    identifier: 'xyz_1',
    search: SUCCEEDED,
    expected: { state: 'identifier_out_of_domain' }
  },
  ...(
    [
      'not_a_cart',
      'no_stripe_confirmation',
      'cart_ownership_unproven',
      'payment_intent_mismatch',
      'ambiguous_return_parameters'
    ] as const
  ).map(reason => ({
    point: `synch. 5 — brama mutacji (marker): ${reason}`,
    search: SUCCEEDED,
    outcome: reason,
    expected: { state: 'return_refused', reason }
  })),
  {
    point: 'synch. 5 — brama mutacji: brak dowodu własności koszyka',
    search: SUCCEEDED,
    owner: false,
    expected: { state: 'return_refused', reason: 'cart_ownership_unproven' }
  },
  {
    point: 'synch. 5 — brama mutacji: niejednoznaczne parametry',
    search: { payment_intent: [PI, 'pi_other'], redirect_status: 'succeeded' },
    expected: { state: 'return_refused', reason: 'ambiguous_return_parameters' }
  },
  ...(
    [
      ['read_failed', 'bridge_read_failed'],
      ['throws', 'bridge_read_failed'],
      ['access_denied', 'bridge_access_denied'],
      ['incomplete', 'incomplete_order_set'],
      ['malformed', 'bridge_malformed']
    ] as const
  ).map(([bridge, reason]) => ({
    point: `synch. 6 — odczyt przed mutacją: ${bridge}`,
    search: SUCCEEDED,
    bridge,
    expected: { state: 'recovery_required', reason }
  })),
  ...(
    [
      ['secret_unavailable', 'outcome_marker_unavailable'],
      ['capacity_exhausted', 'outcome_marker_capacity_exhausted']
    ] as const
  ).map(([storage, reason]) => ({
    point: `synch. 6 — marker niezapisywalny: ${storage}`,
    search: SUCCEEDED,
    storage,
    expected: { state: 'recovery_required', reason }
  })),
  ...(
    [
      ['completion_failed', 'pending_confirmation', 'completion_failed'],
      ['done', 'authentication_abandoned', 'completion_produced_no_order'],
      ['no_order_id', 'authentication_abandoned', 'completion_produced_no_order'],
      ['completion_read_failed', 'recovery_required', 'bridge_read_failed'],
      ['completion_access_denied', 'recovery_required', 'bridge_access_denied'],
      ['payment_not_terminal', 'pending_confirmation', 'psp_not_terminal'],
      ['completion_in_progress', 'pending_confirmation', 'completion_in_progress'],
      ['cart_unavailable', 'recovery_required', 'cart_unavailable']
    ] as const
  ).map(([outcome, state, reason]) => ({
    point: `synch. 7–8 — po domknięciu / odmowa autorytetu: ${outcome}`,
    search: SUCCEEDED,
    outcome,
    expected: { state, reason }
  }))
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Story 8.3 AC1 — stan przerwania (z resolvera produkcyjnego) jest rozłączny z sukcesem i z nigdy-nierozpoczętym', () => {
  it.each(INTERRUPTION_POINTS.map(p => [p.point, p] as const))('%s ⇒ interrupted', async (_point, p) => {
    const res = await resolve(p);
    // Punkt jest wyprowadzony z kodu produkcyjnego — sprawdzamy, że trafił
    // dokładnie w nazwaną gałąź (inaczej dowód byłby o innym punkcie).
    expect(res.result).toEqual(p.expected);
    expect(res.completionRedirect).toBeNull();
    expect(res.result.state).not.toBe('confirmed');
    expect(res.lifecycle).toBe('interrupted');
  });

  it('kontrola dodatnia: odświeżenie domkniętego koszyka ⇒ success', async () => {
    const res = await resolve({ search: SUCCEEDED, bridge: 'complete' });
    expect(res.result).toMatchObject({ state: 'confirmed', reentry: true });
    expect(res.lifecycle).toBe('success');
  });

  it('kontrola dodatnia: identyfikator zamówienia ⇒ success', async () => {
    const res = await resolve({ identifier: 'order_01STORY83', search: {} });
    expect(res.result.state).toBe('confirmed');
    expect(res.lifecycle).toBe('success');
  });

  it('kontrola dodatnia: wejście bez żadnego śladu płatności ⇒ never_started', async () => {
    const res = await resolve({ search: {} });
    expect(res.result).toEqual({ state: 'pending_confirmation', reason: 'awaiting_psp' });
    expect(res.lifecycle).toBe('never_started');
  });

  it('regresja zlania: intencja bez domknięcia ≠ nigdy-nierozpoczęte', async () => {
    const interrupted = await resolve({ search: { payment_intent: PI, redirect_status: 'processing' } });
    const neverStarted = await resolve({ search: {} });
    expect(interrupted.lifecycle).toBe('interrupted');
    expect(neverStarted.lifecycle).toBe('never_started');
    expect(interrupted.result).not.toEqual(neverStarted.result);
  });

  it('inwentarz punktów jest kompletny (żaden nie wypadł po cichu)', () => {
    expect(INTERRUPTION_POINTS.length).toBe(25);
  });
});

describe('Story 8.3 AC1 — fakt o pobraniu (kształt odpowiedzi backendu)', () => {
  it.each([
    [{ charge: 'charged' }, 'charged'],
    [{ charge: 'not_charged' }, 'not_charged'],
    [{ charge: 'unknown' }, 'unknown'],
    [{ charge: 'maybe' }, 'unknown'],
    [null, 'unknown'],
    [undefined, 'unknown']
  ])('%j ⇒ %s (nigdy domyślnie not_charged)', (raw, expected) => {
    expect(parsePaymentChargeFact(raw)).toBe(expected);
  });

  it('klucz i18n komunikatu', () => {
    expect(paymentChargeMessageKey('charged')).toBe('return_charge.charged');
  });
});
