import 'server-only';

import { cookies as nextCookies } from 'next/headers';

import { resolveStorefrontLocale } from '@/lib/sdk/locale-interceptor';

export const getAuthHeaders = async (): Promise<{ authorization: string } | {}> => {
  const cookies = await nextCookies();
  const token = cookies.get('_medusa_jwt')?.value;

  if (!token) {
    return {};
  }

  return { authorization: `Bearer ${token}` };
};

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies();
    const cacheId = cookies.get('_medusa_cache_id')?.value;
    const locale = await resolveStorefrontLocale();

    if (!cacheId) {
      return `${tag}-${locale}`;
    }

    return `${tag}-${cacheId}-${locale}`;
  } catch {
    return '';
  }
};

export const getCacheOptions = async (tag: string): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== 'undefined') {
    return {};
  }

  const cacheTag = await getCacheTag(tag);

  if (!cacheTag) {
    return {};
  }

  return { tags: [`${cacheTag}`] };
};

/**
 * ZMIANA TOŻSAMOŚCI KASUJE DOWÓD KOSZYKA (v1.15.0 DW-15-132, decyzja PO).
 *
 * `_gp_completed_cart` jest dowodem typu bearer i wystarcza do odczytu KODU
 * VOUCHERA (`/store/entitlements`). Do tej zmiany nie było kasowane nigdzie —
 * ani przy wylogowaniu, ani przy logowaniu — więc na współdzielonym urządzeniu
 * osoba B logowała się i czytała kody osoby A, bo cookie A żyło jeszcze przez
 * 2 godziny. Kasowanie siedzi TUTAJ, w obu funkcjach zmieniających tożsamość,
 * żeby żadna nowa ścieżka logowania (magic link, odzyskiwanie vouchera) nie
 * mogła o nim zapomnieć.
 */
export const setAuthToken = async (token: string) => {
  await removeCompletedCartId();
  const cookies = await nextCookies();
  cookies.set('_medusa_jwt', token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });
};

export const removeAuthToken = async () => {
  await removeCompletedCartId();
  const cookies = await nextCookies();
  cookies.set('_medusa_jwt', '', {
    maxAge: -1,
    path: '/'
  });
};

export const getCartId = async () => {
  const cookies = await nextCookies();
  return cookies.get('_medusa_cart_id')?.value;
};

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies();
  cookies.set('_medusa_cart_id', cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });
};

export const removeCartId = async () => {
  const cookies = await nextCookies();
  cookies.set('_medusa_cart_id', '', {
    maxAge: -1,
    path: '/'
  });
};

/**
 * Dowód uprawnienia gościa do WŁASNEGO, właśnie opłaconego zamówienia.
 *
 * Kupująca bez konta nie ma sesji, więc backendowy `payment-status` nie ma jej
 * po czym rozpoznać. Identyfikator koszyka, który zamówienie wyprodukował, jest
 * takim dowodem — jest nieodgadywalny i weryfikowalny w bazie (`order_cart`).
 * Zapisujemy go w OSOBNYM cookie, bo `_medusa_cart_id` jest kasowane w tym
 * samym momencie (koszyk przestaje istnieć, dowód musi przeżyć).
 *
 * `sameSite: 'lax'`, nie `'strict'`: powrót z 3DS to nawigacja top-level ze
 * stripe.com, a przy `strict` przeglądarka nie dołączyłaby cookie do pierwszego
 * żądania po powrocie.
 *
 * TTL 2h zamiast dni: dowód jest typu bearer, więc na współdzielonym urządzeniu
 * ogranicza go wyłącznie czas życia.
 */
export const COMPLETED_CART_COOKIE = '_gp_completed_cart';
const COMPLETED_CART_TTL_SECONDS = 60 * 60 * 2;
/** Ile ostatnich koszyków pamiętamy — patrz komentarz przy `setCompletedCartId`. */
const COMPLETED_CART_MAX_ENTRIES = 3;

/**
 * Dopisuje koszyk do listy dowodów zamiast nadpisywać.
 *
 * Jedno-wartościowe cookie odbierało dostęp do statusu poprzedniego zamówienia
 * przy każdym kolejnym zakupie — realny scenariusz przy płatności asynchronicznej
 * (BLIK/P24), gdzie pierwsze zamówienie jest jeszcze `pending`, a kupująca
 * zdążyła złożyć drugie.
 */
export const setCompletedCartId = async (cartId: string) => {
  if (!cartId) {
    return;
  }
  const cookies = await nextCookies();
  const previous = (cookies.get(COMPLETED_CART_COOKIE)?.value ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0 && entry !== cartId);
  const value = [cartId, ...previous].slice(0, COMPLETED_CART_MAX_ENTRIES).join(',');

  cookies.set(COMPLETED_CART_COOKIE, value, {
    maxAge: COMPLETED_CART_TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });
};

export const getCompletedCartId = async (): Promise<string | undefined> => {
  const cookies = await nextCookies();
  return cookies.get(COMPLETED_CART_COOKIE)?.value || undefined;
};

/**
 * Kasuje dowód koszyka — symetrycznie do `removeCartId`.
 *
 * Wołane przy KAŻDEJ zmianie tożsamości (`setAuthToken` / `removeAuthToken`)
 * oraz wprost w `signout()`. TTL 2h nie jest tu zabezpieczeniem: przez te dwie
 * godziny dowód działa niezależnie od tego, kto siedzi przed przeglądarką.
 */
export const removeCompletedCartId = async () => {
  const cookies = await nextCookies();
  cookies.set(COMPLETED_CART_COOKIE, '', {
    maxAge: -1,
    path: '/'
  });
};
