import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

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
  await removePaymentReturnOutcome();
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
  await removePaymentReturnOutcome();
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
    // Pierwsze żądanie po pełnym powrocie 3DS przychodzi z `stripe.com`.
    // `strict` ukrywałoby wtedy jedyny dowód koszyka przed Route Handlerem;
    // `lax` nadal nie wysyła go w żądaniach osadzonych ani cross-site POST.
    sameSite: 'lax',
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

export const provesCartOwnership = async (cartId: string): Promise<boolean> => {
  const activeCartId = await getCartId();
  if (activeCartId === cartId) {
    return true;
  }

  return ((await getCompletedCartId()) ?? '')
    .split(',')
    .map(entry => entry.trim())
    .includes(cartId);
};

const PAYMENT_RETURN_OUTCOME_COOKIE = '_gp_payment_return_outcome';
const PAYMENT_RETURN_OUTCOME_TTL_SECONDS = 60 * 5;
const PAYMENT_RETURN_OUTCOME_MAX_ENTRIES = 3;

export type PaymentReturnOutcomeStorageState =
  | 'ready'
  | 'secret_unavailable'
  | 'capacity_exhausted';

type PaymentReturnOutcomeRecord = {
  identifier: string;
  paymentIntent: string | null;
  outcome: string;
  expiresAt: number;
};

type PaymentReturnOutcomeInput = Omit<PaymentReturnOutcomeRecord, 'expiresAt'> & {
  /**
   * Story 8.1 fix (runda 2): krótszy TTL dla markera NIETERMINALNEGO
   * (`read_failed`/`access_denied` przed mutacją). Marker zatrzymuje pętlę
   * strona↔route na czas życia, a po wygaśnięciu kolejne wejście ponawia
   * odczyt i — przy pustym mostku — domknięcie. Domyślnie pełny TTL outcome.
   */
  ttlSeconds?: number;
};

type PaymentReturnOutcomeEnvelope = {
  version: 1;
  records: PaymentReturnOutcomeRecord[];
  signature: string;
};

/**
 * Outcome nie jest wskazówką UX, lecz bramką ponownego `/complete`; jego
 * integralność musi więc pochodzić z sekretu serwera. Używamy istniejącego
 * sekretu HMAC Storefrontu i osobnej etykiety payloadu, aby nie mieszać
 * przestrzeni podpisów claimów voucherów z powrotem płatności.
 */
function paymentReturnOutcomeSecret(): string | null {
  const dedicatedSecret = process.env.GP_VOUCHER_CLAIM_HMAC_SECRET?.trim();
  if (dedicatedSecret) {
    return dedicatedSecret;
  }

  const jwtSecret = process.env.JWT_SECRET?.trim();
  return jwtSecret || null;
}

function canonicalOutcomeRecords(records: PaymentReturnOutcomeRecord[]): string {
  return JSON.stringify(
    records.map(record => ({
      identifier: record.identifier,
      paymentIntent: record.paymentIntent,
      outcome: record.outcome,
      expiresAt: record.expiresAt
    }))
  );
}

function signOutcomeRecords(records: PaymentReturnOutcomeRecord[]): string | null {
  const secret = paymentReturnOutcomeSecret();
  if (!secret) {
    return null;
  }
  return createHmac('sha256', secret)
    .update(`payment-return-outcome.v1:${canonicalOutcomeRecords(records)}`, 'utf8')
    .digest('hex');
}

function hasValidSignature(records: PaymentReturnOutcomeRecord[], signature: unknown): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const expected = signOutcomeRecords(records);
  if (!expected) {
    return false;
  }
  const suppliedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}

function parseOutcomeRecords(
  raw: string | undefined,
  now = Date.now()
): PaymentReturnOutcomeRecord[] | null {
  if (!raw) {
    return [];
  }
  try {
    const envelope = JSON.parse(raw) as Partial<PaymentReturnOutcomeEnvelope>;
    if (
      envelope.version !== 1 ||
      !Array.isArray(envelope.records) ||
      envelope.records.length > PAYMENT_RETURN_OUTCOME_MAX_ENTRIES
    ) {
      return null;
    }
    const records: PaymentReturnOutcomeRecord[] = [];
    for (const candidate of envelope.records) {
      if (
        !candidate ||
        typeof candidate.identifier !== 'string' ||
        (candidate.paymentIntent !== null && typeof candidate.paymentIntent !== 'string') ||
        typeof candidate.outcome !== 'string' ||
        !Number.isFinite(candidate.expiresAt)
      ) {
        return null;
      }
      records.push({
        identifier: candidate.identifier,
        paymentIntent: candidate.paymentIntent,
        outcome: candidate.outcome,
        expiresAt: candidate.expiresAt
      });
    }
    if (!hasValidSignature(records, envelope.signature)) {
      return null;
    }
    return records.filter(record => record.expiresAt > now);
  } catch {
    return null;
  }
}

export const getPaymentReturnOutcomeStorageState = async (
  identifier: string,
  paymentIntent: string | undefined
): Promise<PaymentReturnOutcomeStorageState> => {
  if (!paymentReturnOutcomeSecret()) {
    return 'secret_unavailable';
  }

  const cookies = await nextCookies();
  const records = parseOutcomeRecords(cookies.get(PAYMENT_RETURN_OUTCOME_COOKIE)?.value);
  // Nieważna lub podmieniona koperta nie jest dowodem i nie może blokować
  // pierwszego odczytu/mutacji. `getPaymentReturnOutcome` potraktuje ją tak samo.
  if (records === null) {
    return 'ready';
  }

  const hasCurrentRecord = records.some(
    candidate =>
      candidate.identifier === identifier && candidate.paymentIntent === (paymentIntent ?? null)
  );
  return hasCurrentRecord || records.length < PAYMENT_RETURN_OUTCOME_MAX_ENTRIES
    ? 'ready'
    : 'capacity_exhausted';
};

export const setPaymentReturnOutcome = async (
  record: PaymentReturnOutcomeInput
): Promise<PaymentReturnOutcomeStorageState> => {
  const cookies = await nextCookies();
  const now = Date.now();
  const prior = parseOutcomeRecords(cookies.get(PAYMENT_RETURN_OUTCOME_COOKIE)?.value, now) ?? [];
  const existing = prior.find(
    candidate =>
      candidate.identifier === record.identifier && candidate.paymentIntent === record.paymentIntent
  );
  const remaining = prior.filter(
    candidate =>
      candidate.identifier !== record.identifier || candidate.paymentIntent !== record.paymentIntent
  );

  if (remaining.length >= PAYMENT_RETURN_OUTCOME_MAX_ENTRIES) {
    // Nie wypychamy najstarszego znacznika: jego utrata pozwoliłaby replayowi
    // wrócić do `/complete`. Wywołujący ma zatrzymać mutację named recovery.
    return 'capacity_exhausted';
  }

  const records = [
    {
      identifier: record.identifier,
      paymentIntent: record.paymentIntent,
      outcome: record.outcome,
      expiresAt:
        existing?.outcome === record.outcome
          ? existing.expiresAt
          : now +
            Math.min(
              record.ttlSeconds ?? PAYMENT_RETURN_OUTCOME_TTL_SECONDS,
              PAYMENT_RETURN_OUTCOME_TTL_SECONDS
            ) *
              1000
    },
    ...remaining
  ];
  const signature = signOutcomeRecords(records);
  if (!signature) {
    // Brak sekretu nie może zamienić niepodpisanego cookie w dowód. Handler
    // zatrzymuje przed mutacją na nazwanym recovery, nie ufa przeglądarce.
    return 'secret_unavailable';
  }
  const envelope: PaymentReturnOutcomeEnvelope = { version: 1, records, signature };
  cookies.set(PAYMENT_RETURN_OUTCOME_COOKIE, JSON.stringify(envelope), {
    maxAge: PAYMENT_RETURN_OUTCOME_TTL_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  });
  return 'ready';
};

export const getPaymentReturnOutcome = async (
  identifier: string | null,
  paymentIntent: string | undefined
): Promise<string | null> => {
  const cookies = await nextCookies();
  const records = parseOutcomeRecords(cookies.get(PAYMENT_RETURN_OUTCOME_COOKIE)?.value);
  return (
    records?.find(
      record => record.identifier === identifier && record.paymentIntent === (paymentIntent ?? null)
    )?.outcome ?? null
  );
};

export const removePaymentReturnOutcome = async (): Promise<void> => {
  const cookies = await nextCookies();
  cookies.set(PAYMENT_RETURN_OUTCOME_COOKIE, '', { maxAge: -1, path: '/' });
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
