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

vi.mock('@/i18n/routing', () => ({
  DEFAULT_LOCALE: 'pl',
  SUPPORTED_LOCALES: ['pl', 'en', 'ua', 'de']
}));

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  revalidatePath: (p: string) => revalidatePath(p),
  unstable_cache: (fn: unknown) => fn
}));

/** Realny, prosty magazyn cookies — Route Handlerowi wolno go zapisywać. */
const cookieStore = new Map<string, string>();
const cookieSet = vi.fn((name: string, value: string, _options?: unknown) => {
  cookieStore.set(name, value);
});

// Podpis outcome korzysta z istniejącej konfiguracji HMAC Storefrontu. Test
// ustawia jawny sekret przed importem Route Handlera, by niesygnowany mutant
// nie mógł przypadkiem przejść dzięki brakowi konfiguracji.
process.env.GP_VOUCHER_CLAIM_HMAC_SECRET = 'payment-return-route-test-secret-32-bytes';

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
const retrieveCart = vi.fn();
vi.mock('@/lib/config', () => ({
  fetchQuery: (...args: unknown[]) => fetchQuery(...args),
  sdk: {
    client: { fetch: (...args: unknown[]) => retrieveCart(...args) },
    store: { cart: { update: vi.fn() } }
  }
}));

const { GET } = await import('../route');

const CART = 'cart_01STORY36HANDLER';
const OTHER_CART = 'cart_01STORY36SOMEONEELSE';
const ORDER_A = 'order_01STORY36SELLERA';
const ORDER_B = 'order_01STORY36SELLERB';

function request(params: Record<string, string | string[]>): any {
  const url = new URL('https://shop.test/api/v1/checkout/payment-return');
  for (const [k, v] of Object.entries(params)) {
    for (const value of Array.isArray(v) ? v : [v]) {
      url.searchParams.append(k, value);
    }
  }
  if (params.redirect_status === 'succeeded' && !params.payment_intent) {
    url.searchParams.set('payment_intent', 'pi_3STORY36');
  }
  return { nextUrl: url };
}

/** Wykonuje handler i zwraca adres, na który przekierował. */
async function callHandler(params: Record<string, string | string[]>): Promise<string> {
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
  retrieveCart.mockResolvedValue({
    cart: {
      payment_collection: {
        payment_sessions: [
          { provider_id: 'pp_stripe_stripe', data: { client_secret: 'pi_3STORY36_secret_x' } }
        ]
      }
    }
  });
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

    expect(target).toBe(
      '/pl/order/' +
        CART +
        '/payment-status?redirect_status=succeeded&payment_intent=pi_3STORY36&gp_return=done'
    );
  });

  it('sam `payment_intent` bez sukcesu Stripe’a nie jest potwierdzeniem powrotu', async () => {
    await callHandler({ cart_id: CART, locale: 'pl', payment_intent: 'pi_3STORY36' });

    expect(postCalls()).toHaveLength(0);
  });

  it('N=2 po domknięciu jest reentry bez drugiego `POST /complete`', async () => {
    await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });
    const reentryTarget = await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: 'succeeded'
    });

    expect(postCalls()).toHaveLength(1);
    expect(reentryTarget).toContain('gp_return=done');
    const bridgeResponses = await Promise.all(
      fetchQuery.mock.results
        .map(({ value }) => value)
        .filter((value): value is Promise<unknown> => value instanceof Promise)
    );
    expect(bridgeResponses).toContainEqual({
      ok: true,
      data: {
        orders: [ORDER_A, ORDER_B].map(id => ({ order_id: id, order_group_id: null })),
        order_count: 2
      }
    });
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

  it('`redirect_status=failed` z `payment_intent` → zero domykania', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: 'failed',
      payment_intent: 'pi_failed_3ds'
    });

    expect(postCalls()).toHaveLength(0);
    expect(cookieStore.get('_gp_completed_cart')).toBeUndefined();
  });

  it('błąd odczytu mostka → zero domykania i nazwany wynik `read_failed`', async () => {
    cookieStore.set('_medusa_cart_id', CART);
    fetchQuery.mockRejectedValue(new Error('bridge down'));

    const target = await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
    expect(target).toContain('gp_return=read_failed');
  });

  it('401 z mostka → zero domykania i nazwany wynik `access_denied`', async () => {
    cookieStore.set('_medusa_cart_id', CART);
    fetchQuery.mockResolvedValue({ ok: false, status: 401 });

    const target = await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
    expect(target).toContain('gp_return=access_denied');
  });

  it('N=2 z niepełną kolekcją → zero domykania i nazwany wynik `incomplete`', async () => {
    cookieStore.set('_medusa_cart_id', CART);
    fetchQuery.mockResolvedValue({
      ok: true,
      data: {
        orders: [{ order_id: ORDER_A, order_group_id: null }],
        order_count: 2
      }
    });

    const target = await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(0);
    expect(target).toContain('gp_return=incomplete');
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

  it('obcy PaymentIntent nie może uruchomić domknięcia własnego koszyka', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    const target = await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: 'succeeded',
      payment_intent: 'pi_other_payment'
    });

    expect(postCalls()).toHaveLength(0);
    expect(target).toContain('gp_return=payment_intent_mismatch');
  });

  it('sprzeczne powtórzone parametry są odrzucane niezależnie od kolejności', async () => {
    cookieStore.set('_medusa_cart_id', CART);

    const first = await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: ['succeeded', 'failed'],
      payment_intent: 'pi_3STORY36'
    });
    const second = await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: ['failed', 'succeeded'],
      payment_intent: 'pi_3STORY36'
    });

    expect(postCalls()).toHaveLength(0);
    expect(first).toContain('gp_return=ambiguous_return_parameters');
    expect(second).toContain('gp_return=ambiguous_return_parameters');
  });

  it('odmowa koduje nieprawidłowy cart_id jako segment ścieżki', async () => {
    const target = await callHandler({
      cart_id: 'cart_bad/path?#fragment',
      locale: 'pl'
    });

    expect(target).toContain('/order/cart_bad%2Fpath%3F%23fragment/payment-status');
    expect(postCalls()).toHaveLength(0);
  });
});

describe('idempotencja Route Handlera', () => {
  beforeEach(() => {
    cookieStore.set('_medusa_cart_id', CART);
    completionSucceeds();
  });

  it.each(['completion_failed', 'no_order_id'] as const)(
    'powtórzenie po %s zwraca ten sam nazwany wynik bez drugiego POST',
    async outcome => {
      fetchQuery.mockImplementation(async (path: string, init?: { method?: string }) => {
        if (init?.method === 'POST' && path.includes('/complete')) {
          if (outcome === 'completion_failed') {
            throw new Error('completion down');
          }
          return { ok: true, data: { type: 'cart' } };
        }
        return { ok: false, status: 404 };
      });

      const first = await callHandler({
        cart_id: CART,
        locale: 'pl',
        redirect_status: 'succeeded'
      });
      const second = await callHandler({
        cart_id: CART,
        locale: 'pl',
        redirect_status: 'succeeded'
      });

      expect(postCalls()).toHaveLength(1);
      expect(first).toContain(`gp_return=${outcome}`);
      expect(second).toContain(`gp_return=${outcome}`);
    }
  );

  it('dwa równoległe powroty współdzielą jedną mutację domknięcia', async () => {
    const [first, second] = await Promise.all([
      callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' }),
      callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' })
    ]);

    expect(postCalls()).toHaveLength(1);
    expect(first).toContain('gp_return=done');
    expect(second).toContain('gp_return=done');
  });

  it('niesygnowane cookie `done` nie blokuje pierwszego domknięcia', async () => {
    cookieStore.set(
      '_gp_payment_return_outcome',
      JSON.stringify({ identifier: CART, paymentIntent: 'pi_3STORY36', outcome: 'done' })
    );

    const target = await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });

    expect(postCalls()).toHaveLength(1);
    expect(target).toContain('gp_return=done');
  });

  it('zachowuje outcome dwóch koszyków, zamiast nadpisać pierwszy globalnym rekordem', async () => {
    const secondCart = 'cart_01STORY36SECOND';
    const secondIntent = 'pi_3STORY36SECOND';
    retrieveCart.mockResolvedValue({
      cart: {
        payment_collection: {
          payment_sessions: [
            { provider_id: 'pp_stripe_stripe', data: { client_secret: 'pi_3STORY36_secret_x' } },
            {
              provider_id: 'pp_stripe_stripe',
              data: { client_secret: 'pi_3STORY36SECOND_secret_x' }
            }
          ]
        }
      }
    });
    fetchQuery.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (init?.method === 'POST' && path.includes('/complete')) {
        throw new Error('completion down');
      }
      return { ok: false, status: 404 };
    });

    const first = await callHandler({ cart_id: CART, locale: 'pl', redirect_status: 'succeeded' });
    cookieStore.set('_medusa_cart_id', secondCart);
    const second = await callHandler({
      cart_id: secondCart,
      locale: 'pl',
      redirect_status: 'succeeded',
      payment_intent: secondIntent
    });
    cookieStore.set('_medusa_cart_id', CART);
    const firstReentry = await callHandler({
      cart_id: CART,
      locale: 'pl',
      redirect_status: 'succeeded'
    });

    expect(postCalls()).toHaveLength(2);
    expect(first).toContain('gp_return=completion_failed');
    expect(second).toContain('gp_return=completion_failed');
    expect(firstReentry).toContain('gp_return=completion_failed');
  });
});
