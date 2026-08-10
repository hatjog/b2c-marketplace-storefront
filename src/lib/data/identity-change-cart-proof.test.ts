/**
 * v1.15.0 DW-15-132 (decyzja PO po recenzji) — dowód koszyka NIE PRZEŻYWA
 * zmiany tożsamości.
 *
 * ── Stan zły, który to zamyka ───────────────────────────────────────────────
 * Cookie `_gp_completed_cart` jest dowodem typu bearer i WYSTARCZA do odczytu
 * kodu vouchera (`/store/entitlements`). Do tej zmiany nie było kasowane nigdzie
 * w kodzie — ani przy wylogowaniu, ani przy logowaniu — a jego jedynym
 * ograniczeniem był TTL 2h. Na współdzielonym urządzeniu osoba B logowała się i
 * czytała kody osoby A.
 *
 * ── Kontrola dodatnia ───────────────────────────────────────────────────────
 * Te testy PĘKAJĄ po cofnięciu kasowania w `cookies.ts`/`customer.ts`:
 * `getCompletedCartId()` zwraca wtedy dalej dowód poprzedniej kupującej.
 * Mierzony jest SKUTEK (czy dowód nadal działa), nie wywołanie funkcji.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: (fn: unknown) => fn
}));

class RedirectSignal extends Error {}

vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new RedirectSignal('redirect');
  }
}));

/** Realny magazyn cookies — z semantyką `maxAge <= 0` znaczy „skasuj". */
const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
    set: (name: string, value: string, options?: { maxAge?: number }) => {
      if (options && typeof options.maxAge === 'number' && options.maxAge <= 0) {
        cookieStore.delete(name);
        return;
      }
      cookieStore.set(name, value);
    },
    delete: (name: string) => cookieStore.delete(name)
  }),
  headers: async () => new Map()
}));

vi.mock('@/lib/sdk/locale-interceptor', () => ({
  resolveStorefrontLocale: async () => 'pl'
}));

const authLogin = vi.fn(async () => 'jwt-nowej-osoby');
const authLogout = vi.fn(async () => undefined);
const transferCartFn = vi.fn(async () => undefined);

vi.mock('@/lib/config', () => ({
  sdk: {
    auth: {
      login: (...args: unknown[]) => authLogin(...(args as [])),
      logout: () => authLogout()
    },
    store: {
      cart: { transferCart: (...args: unknown[]) => transferCartFn(...(args as [])) },
      customer: { update: vi.fn(), create: vi.fn() }
    },
    client: { fetch: vi.fn() }
  },
  fetchQuery: vi.fn()
}));

const { getCompletedCartId, setCompletedCartId } = await import('./cookies');
const { login, signout } = await import('./customer');

const PROOF_OSOBY_A = 'cart_01OSOBA_A';

beforeEach(() => {
  cookieStore.clear();
  authLogin.mockClear();
  authLogout.mockClear();
});

describe('dowód koszyka a zmiana tożsamości', () => {
  it('WYLOGOWANIE kasuje dowód koszyka poprzedniej kupującej', async () => {
    await setCompletedCartId(PROOF_OSOBY_A);
    expect(await getCompletedCartId()).toBe(PROOF_OSOBY_A);

    await expect(signout()).rejects.toBeInstanceOf(RedirectSignal);

    expect(await getCompletedCartId()).toBeUndefined();
  });

  /**
   * Drugi człon, ten domykający dziurę: samo wylogowanie nie wystarczy, bo na
   * współdzielonym urządzeniu osoba B zwykle po prostu SIĘ LOGUJE — bez
   * wylogowania poprzedniej, której sesja i tak wygasła.
   */
  it('LOGOWANIE kasuje dowód koszyka poprzedniej kupującej', async () => {
    await setCompletedCartId(PROOF_OSOBY_A);
    expect(await getCompletedCartId()).toBe(PROOF_OSOBY_A);

    const form = new FormData();
    form.set('email', 'osoba.b@example.test');
    form.set('password', 'haslo');
    await login(form);

    expect(authLogin).toHaveBeenCalled();
    expect(await getCompletedCartId()).toBeUndefined();
  });

  /**
   * KONTROLA ROZŁĄCZNOŚCI: kasowanie ma dotyczyć ZMIANY TOŻSAMOŚCI, a nie
   * każdego zapisu cookie. Dowód zapisany po zakupie musi przeżyć do momentu,
   * w którym kupująca ogląda własne potwierdzenie — inaczej ekran gościa nigdy
   * nie dostałby czym się wylegitymować.
   */
  it('sam zakup dowodu NIE kasuje', async () => {
    await setCompletedCartId(PROOF_OSOBY_A);
    await setCompletedCartId('cart_01DRUGI_ZAKUP');

    expect(await getCompletedCartId()).toContain(PROOF_OSOBY_A);
    expect(await getCompletedCartId()).toContain('cart_01DRUGI_ZAKUP');
  });
});
