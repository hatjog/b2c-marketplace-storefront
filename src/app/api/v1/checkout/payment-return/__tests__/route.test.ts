/**
 * v1.15.0 Story 3.6 review-fix (HIGH ×2) — Route Handler domykający powrót 3DS.
 *
 * ── Co ta suita mierzy WYKONANIEM ──────────────────────────────────────────
 * 1. Że domknięcie tutaj DZIAŁA: `revalidateTag`/`revalidatePath` i zapis
 *    cookies wykonują się bez wyjątku (w renderze RSC rzucały — patrz
 *    `payment-status/__tests__/payment-status-render.test.ts`), a `POST
 *    /store/carts/:id/complete` faktycznie leci.
 * 2. Że NIE jest to otwarta powierzchnia zapisu: bez dowodu własności koszyka
 *    i bez pozytywnego sygnału od Stripe'a domknięcie się NIE wykonuje.
 *
 * Moduł `lib/data/cart.ts` NIE jest tu mockowany — mockowana jest wyłącznie
 * granica sieciowa (`fetchQuery`) i granice środowiska Next.js, i to tak, żeby
 * ZEZWALAŁY na to, na co Next zezwala w Route Handlerze.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  revalidatePath: (p: string) => revalidatePath(p),
  unstable_cache: (fn: unknown) => fn
}));

/** Realny, prosty magazyn cookies — Route Handlerowi wolno go zapisywać. */
const cookieStore = new Map<string, string>();
const cookieSet = vi.fn((name: string, value: string) => {
  cookieStore.set(name, value);
});

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
    set: (name: string, value: string) => cookieSet(name, value),
    delete: (name: string) => cookieStore.delete(name)
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
  }
}));

const fetchQuery = vi.fn();
vi.mock('@/lib/config', () => ({
  fetchQuery: (...args: unknown[]) => fetchQuery(...args),
  sdk: { store: { cart: { update: vi.fn() } } }
}));

const { GET } = await import('../route');

const CART = 'cart_01STORY36HANDLER';
const OTHER_CART = 'cart_01STORY36SOMEONEELSE';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';

function request(params: Record<string, string>): any {
  const url = new URL('https://shop.test/api/v1/checkout/payment-return');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return { nextUrl: url };
}

/** Wykonuje handler i zwraca adres, na który przekierował. */
async function callHandler(params: Record<string, string>): Promise<string> {
  try {
    await GET(request(params));
  } catch (e) {
    if (e instanceof RedirectSignal) {
      return e.target;
    }
    throw e;
  }
  throw new Error('handler nie przekierował — kontrakt powrotu wymaga przekierowania');
}

/** Mostek pusty, a `POST /complete` udany — pierwsze wejście po 3DS. */
function completionSucceeds() {
  fetchQuery.mockImplementation(async (path: string, init?: { method?: string }) => {
    if (init?.method === 'POST' && path.includes('/complete')) {
      return { ok: true, data: { type: 'order', order: { id: ORDER_A } } };
    }
    if (path.includes('/completed-order')) {
      const done = fetchQuery.mock.calls.some(
        ([p, i]) => (i as { method?: string })?.method === 'POST' && String(p).includes('/complete')
      );
      return done
        ? {
            ok: true,
            data: {
              orders: [ORDER_A, ORDER_B].map(id => ({ order_id: id, order_group_id: null })),
              order_count: 2
            }
          }
        : { ok: false, status: 404 };
    }
    return { ok: false, status: 404 };
  });
}

function postCalls() {
  return fetchQuery.mock.calls.filter(
    ([path, init]) =>
      (init as { method?: string })?.method === 'POST' && String(path).includes('/complete')
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieStore.clear();
  fetchQuery.mockResolvedValue({ ok: false, status: 404 });
});

describe('kontrola dodatnia — domknięcie WYKONUJE się w Route Handlerze', () => {
  beforeEach(() => {
    // Dowód własności: koszyk jest aktywny w tej przeglądarce.
    cookieStore.set('_medusa_cart_id', CART);
    completionSucceeds();
  });

  it('powrót z `redirect_status=succeeded` domyka koszyk i wraca ze znacznikiem', async () => {
    const target = await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: 'succeeded'
    });

    expect(postCalls()).toHaveLength(1);
    // Operacje ZABRONIONE w renderze wykonują się tutaj bez wyjątku — to jest
    // cała różnica między tym handlerem a poprzednim wołaniem z page.tsx.
    expect(revalidateTag).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalled();
    // Dowód dostępu gościa POWSTAŁ — bez niego odpytywanie statusu odbija 401.
    expect(cookieStore.get('_gp_completed_cart')).toContain(CART);

    expect(target).toBe('/pl/order/' + CART + '/payment-status?redirect_status=succeeded&gp_return=done');
  });

  it('sam `payment_intent` (bez `redirect_status`) też jest potwierdzeniem powrotu', async () => {
    await callHandler({ cart_id: CART, locale: 'pl', payment_intent: 'pi_3STORY36' });

    expect(postCalls()).toHaveLength(1);
  });

  it('idempotencja: koszyk JUŻ domknięty → zero `POST /complete`', async () => {
    fetchQuery.mockImplementation(async (path: string) =>
      path.includes('/completed-order')
        ? {
            ok: true,
            data: {
              orders: [{ order_id: ORDER_A, order_group_id: null }],
              order_count: 1
            }
          }
        : { ok: false, status: 404 }
    );

    await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
  });

  it('locale spoza dziedziny nie buduje adresu z cudzego wejścia', async () => {
    const target = await callHandler({
      cart_id: CART,
      locale: '../../evil.example.com',
      redirect_status: 'succeeded'
    });

    expect(target.startsWith('/pl/order/')).toBe(true);
  });
});

describe('kontrola negatywna — powierzchnia zapisu NIE jest otwarta', () => {
  beforeEach(completionSucceeds);

  it('BRAK dowodu własności koszyka → zero domykania, zero cookie dostępu', async () => {
    // Przeglądarka ma inny koszyk — czyli zna URL, ale nie jest właścicielką.
    cookieStore.set('_medusa_cart_id', OTHER_CART);

    await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
    expect(cookieStore.get('_gp_completed_cart')).toBeUndefined();
  });

  it('BRAK jakiegokolwiek cookie (bot / prefetch / skaner linków) → zero domykania', async () => {
    await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
  });

  it('BRAK parametrów powrotu Stripe’a → zero domykania (nie wystarczy brak `failed`)', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    await callHandler({ cart_id: CART, locale: 'pl' });

    expect(postCalls()).toHaveLength(0);
  });

  it('`redirect_status=failed` → zero domykania', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'failed' });

    expect(postCalls()).toHaveLength(0);
  });

  it('identyfikator ZAMÓWIENIA zamiast koszyka → zero domykania', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    await callHandler({ cart_id: ORDER_A, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
  });

  it('identyfikator spoza dziedziny → zero domykania', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    await callHandler({ cart_id: 'nonsens', locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
  });

  it('dowód z `_gp_completed_cart` wystarcza (odświeżenie po częściowym powrocie)', async () => {
    cookieStore.set('_gp_completed_cart', `${OTHER_CART},${CART}`);

    await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(1);
  });
});
