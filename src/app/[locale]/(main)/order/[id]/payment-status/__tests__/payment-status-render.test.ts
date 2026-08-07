/**
 * v1.15.0 Story 3.6 review-fix (HIGH ×2) — DOWÓD Z WYKONANIA RENDERU.
 *
 * ── Czego brakowało ────────────────────────────────────────────────────────
 * AC2 kończy się zdaniem: „żaden mechanizm dodany w tej story nie jest
 * dowodzony OBECNOŚCIĄ — wyłącznie WYKONANIEM". Dowód AC2 opierał się jednak na
 * suicie, która `vi.mock('../cart')`, czyli podmieniała atrapą dokładnie ten
 * moduł, w którym leżał defekt, a kontrolą negatywną było
 * `ls: cannot access …` — literalnie dowód z NIEOBECNOŚCI pliku. Żaden test
 * w repo nie wykonywał `payment-status/page.tsx`.
 *
 * ── Co mierzy ta suita ─────────────────────────────────────────────────────
 * Wykonuje REALNĄ funkcję strony (async React Server Component) z REALNYM
 * `lib/data/cart.ts` i REALNYM `lib/data/cookies.ts` — nic z tego łańcucha nie
 * jest zamockowane. Zamockowane są WYŁĄCZNIE granice środowiska Next.js,
 * i to tak, żeby zachowywały się jak w prawdziwej fazie renderu:
 *
 *   • `revalidateTag` / `revalidatePath` RZUCAJĄ
 *     `Route ... used "X" during render which is unsupported`,
 *   • `cookies().set(...)` RZUCA
 *     `Cookies can only be modified in a Server Action or Route Handler`.
 *
 * To są dokładnie te wyjątki, którymi Next.js 15 rozbijał poprzednią wersję —
 * PO udanym `POST /store/carts/:id/complete`, więc zamówienia powstawały,
 * wyjątek połykał `catch` w `cart.ts`, a kupująca po pobranej płatności widziała
 * „czekamy na potwierdzenie z banku" i traciła dowód dostępu do zamówienia.
 *
 * ── Dlaczego to jest kontrola, która PĘKA ──────────────────────────────────
 * Test `kontrola negatywna` poniżej wykonuje ścieżkę SPRZED poprawki
 * (`completeOrderAfterStripePayment` wołane w warunkach renderu) i wymaga, żeby
 * ona rzuciła. Gdyby ograniczenia Next.js przestały tu obowiązywać, ta asercja
 * zapali się czerwono i cała ta suita straci podstawę — czyli test pilnuje też
 * własnego założenia.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Granice środowiska Next.js, uzbrojone jak w realnym renderze ────────────

class RenderPhaseViolation extends Error {}

const revalidateTag = vi.fn((tag: string) => {
  throw new RenderPhaseViolation(
    `Route /[locale]/order/[id]/payment-status used "revalidateTag ${tag}" during render which is unsupported.`
  );
});
const revalidatePath = vi.fn((p: string) => {
  throw new RenderPhaseViolation(
    `Route /[locale]/order/[id]/payment-status used "revalidatePath ${p}" during render which is unsupported.`
  );
});

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  revalidatePath: (p: string) => revalidatePath(p),
  unstable_cache: (fn: unknown) => fn
}));

const cookieStore = new Map<string, string>();
const cookieSet = vi.fn(() => {
  throw new RenderPhaseViolation(
    'Cookies can only be modified in a Server Action or Route Handler.'
  );
});

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
    set: (...args: unknown[]) => cookieSet(...(args as [])),
    delete: () => cookieSet()
  }),
  headers: async () => new Map()
}));

class RedirectSignal extends Error {
  constructor(public readonly target: string) {
    super(`NEXT_REDIRECT:${target}`);
  }
}

vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    throw new RedirectSignal(target);
  },
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  }
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => undefined,
  getTranslations: async () => (key: string) => key
}));

// Strona importuje barrel `@/components/atoms`, który ciągnie `next/image`
// i `next/link` — te moduły nie rozwiązują się poza bundlerem Next.js.
// To są atrapy ŚRODOWISKA, nie mierzonego mechanizmu.
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/link', () => ({ default: () => null }));

// ── Jedyna zamockowana granica SIECIOWA (backend Medusy nie żyje w teście) ──

const fetchQuery = vi.fn();
vi.mock('@/lib/config', () => ({
  fetchQuery: (...args: unknown[]) => fetchQuery(...args),
  sdk: { store: { cart: { update: vi.fn() } } }
}));

const CART = 'cart_01STORY36RENDER';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';

const PaymentStatusPage = (await import('../page')).default;
const { completeOrderAfterStripePayment } = await import('@/lib/data/cart');

function pageProps(searchParams: Record<string, string>) {
  return {
    params: Promise.resolve({ id: CART, locale: 'pl' }),
    searchParams: Promise.resolve(searchParams)
  };
}

/** Mostek odpowiada `orders` albo 404 — kształt realnej trasy mostkowej. */
function bridgeReturns(orderIds: string[]) {
  fetchQuery.mockImplementation(async (path: string) => {
    if (path.includes('/completed-order')) {
      return orderIds.length > 0
        ? {
            ok: true,
            data: {
              orders: orderIds.map(id => ({ order_id: id, order_group_id: null })),
              order_count: orderIds.length,
              order_id: orderIds[orderIds.length - 1]
            }
          }
        : { ok: false, status: 404 };
    }
    throw new Error(`nieoczekiwane żądanie w renderze: ${path}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  bridgeReturns([]);
});

describe('AC2 — render strony powrotu NIE mutuje (wykonanie, nie obecność)', () => {
  it('powrót wymagający domknięcia → PRZEKIEROWANIE na Route Handler, zero mutacji w renderze', async () => {
    const err = await PaymentStatusPage(pageProps({ redirect_status: 'succeeded' })).then(
      () => null,
      (e: unknown) => e
    );

    expect(err).toBeInstanceOf(RedirectSignal);
    expect((err as RedirectSignal).target).toContain('/api/v1/checkout/payment-return');
    expect((err as RedirectSignal).target).toContain(`cart_id=${CART}`);

    // To jest sedno findingu HIGH: w fazie renderu nie padło ANI JEDNO
    // wywołanie, którego Next.js zabrania.
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
    // I nie poszło żadne `POST /complete` — render niczego nie domknął.
    expect(
      fetchQuery.mock.calls.filter(([, init]) => (init as { method?: string })?.method === 'POST')
    ).toHaveLength(0);
  });

  it('koszyk JUŻ domknięty → render kończy się BEZ przekierowania i bez mutacji', async () => {
    bridgeReturns([ORDER_A, ORDER_B]);

    const element = await PaymentStatusPage(pageProps({ redirect_status: 'succeeded' }));

    expect(element).toBeTruthy();
    expect(revalidateTag).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('powrót ZE znacznikiem `gp_return=done` jest odczytem — nie odsyła ponownie (brak pętli)', async () => {
    const element = await PaymentStatusPage(
      pageProps({ redirect_status: 'succeeded', gp_return: 'done' })
    );

    expect(element).toBeTruthy();
    expect(cookieSet).not.toHaveBeenCalled();
  });

  it('porzucone uwierzytelnienie i odświeżenie są ROZRÓŻNIALNE (NFR-2)', async () => {
    const abandoned = await PaymentStatusPage(pageProps({ redirect_status: 'failed' }));

    bridgeReturns([ORDER_A]);
    const refreshed = await PaymentStatusPage(pageProps({ redirect_status: 'succeeded' }));

    expect(JSON.stringify(abandoned)).not.toEqual(JSON.stringify(refreshed));
  });
});

describe('kontrola negatywna — DLACZEGO domknięcie nie może zostać w renderze', () => {
  it('`completeOrderAfterStripePayment` wykonane w warunkach renderu ZWRACA PORAŻKĘ po udanym /complete', async () => {
    // Dokładne odtworzenie stanu sprzed poprawki: mostek nic nie zna,
    // `POST /complete` się UDAJE (zamówienia powstają), a potem leci
    // `revalidateTag` — zabroniony w renderze.
    fetchQuery.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'POST' && path.includes('/complete')) {
        return { ok: true, data: { type: 'order', order: { id: ORDER_A } } };
      }
      return { ok: false, status: 404 };
    });

    const out = await completeOrderAfterStripePayment(CART);

    // Zamówienia POWSTAŁY, a wywołujący dostaje `completion_failed`. Dokładnie
    // ten rozjazd zobaczyła kupująca jako „czekamy na potwierdzenie z banku"
    // po pobranej płatności.
    expect(revalidateTag).toHaveBeenCalled();
    expect(out).toMatchObject({ ok: false, error: { code: 'completion_failed' } });
    // I dowód dostępu (`_gp_completed_cart`) nigdy nie powstał — stąd 401 na
    // odpytywaniu statusu po odświeżeniu.
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
