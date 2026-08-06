/**
 * GET /api/v1/checkout/payment-return
 *
 * v1.15.0 Story 3.6 review-fix (HIGH ×2) — JEDYNE miejsce, w którym powrót
 * z 3D Secure domyka koszyk serwerowo.
 *
 * ── Dlaczego Route Handler, a nie strona ───────────────────────────────────
 * Domknięcie wykonuje `revalidateTag`/`revalidatePath` i zapisuje cookies
 * (`_gp_completed_cart`, kasowanie `_medusa_cart_id`). Next.js 15 zabrania obu
 * w fazie renderu React Server Component, więc wołanie domknięcia wprost ze
 * strony powrotu kończyło się wyjątkiem PO udanym `POST /complete`: zamówienia
 * powstawały, wyjątek był połykany przez `catch`, a kupująca widziała „czekamy
 * na potwierdzenie z banku" i traciła dowód dostępu do własnego zamówienia.
 * W Route Handlerze obie operacje są legalne.
 *
 * ── Dlaczego to nie jest otwarta powierzchnia zapisu ───────────────────────
 * Poprzednia wersja domykała koszyk przy KAŻDYM wejściu GET na stronę statusu;
 * jedynym warunkiem było `redirect_status !== 'failed'`, więc brak parametrów
 * też przechodził. Każdy, kto wszedł na URL (bot, prefetch, skaner linków,
 * ktoś z historii przeglądarki), inicjował domknięcie — a przy powodzeniu
 * dostawał cookie `_gp_completed_cart`, czyli bearer-owy dowód uprawnienia do
 * zamówień tego koszyka. Tu domknięcie wymaga JEDNOCZEŚNIE:
 *
 *   1. identyfikatora, który rozstrzyga się jako KOSZYK (AD-19, nie po pozycji
 *      w URL-u),
 *   2. POZYTYWNEGO sygnału powrotu od Stripe'a (`redirect_status=succeeded`
 *      albo obecny `payment_intent`) — nie braku sygnału negatywnego,
 *   3. DOWODU WŁASNOŚCI: `cart_id` musi zgadzać się z cookie `_medusa_cart_id`
 *      przeglądarki albo być już na liście `_gp_completed_cart`. Cookie koszyka
 *      ma `sameSite: 'strict'`, ale to jest żądanie SAME-SITE (przeglądarka
 *      przyszła tu z NASZEJ strony powrotu, nie ze stripe.com), więc jest
 *      dołączane — a właśnie dlatego domknięcie siedzi tutaj, a nie na stronie,
 *      na którą wchodzi się prosto ze Stripe'a.
 *
 * Odmowa NIE jest cicha: każdy powód ma nazwany kod w logu i osobny stan na
 * powierzchni (NFR-2). Odmowa nigdy nie kasuje ani nie mutuje koszyka.
 *
 * ── Idempotencja ───────────────────────────────────────────────────────────
 * Przed domknięciem robimy ODCZYT mostka (z retry — join `order_set`↔cart
 * potrafi się opóźnić). Koszyk już domknięty ⇒ zero mutacji, prosty powrót.
 * Do adresu powrotu doklejamy `gp_return=done`, żeby strona nie odesłała tu
 * ponownie — powrót po nieudanym domknięciu jest ODCZYTEM, nie pętlą.
 */

import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { classifyPaymentReturnIdentifier } from '@/lib/checkout/payment-return-identifier';
import { getCompletedOrderIdsForCart } from '@/lib/data/cart';
import { getCartId, getCompletedCartId } from '@/lib/data/cookies';
import {
  isStripeReturnConfirmation,
  PAYMENT_RETURN_DONE_PARAM,
  performPaymentReturnCompletion,
  readStripeReturnParams
} from '@/lib/data/payment-return';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/i18n/routing';

/** Domknięcie jest mutacją — nigdy nie wolno go zapamiętać w cache'u. */
export const dynamic = 'force-dynamic';

type RefusalCode =
  | 'identifier_out_of_domain'
  | 'not_a_cart'
  | 'no_stripe_confirmation'
  | 'cart_ownership_unproven';

/**
 * Locale z query stringu jest wartością z PRZEGLĄDARKI — walidujemy ją wobec
 * `SUPPORTED_LOCALES`, żeby nie zbudować adresu przekierowania z cudzego
 * wejścia (open-redirect przez segment ścieżki).
 */
function safeLocale(raw: string | null): string {
  return raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw) ? raw : DEFAULT_LOCALE;
}

function statusPageUrl(
  locale: string,
  identifier: string,
  params: URLSearchParams
): string {
  const query = new URLSearchParams();
  for (const key of ['redirect_status', 'payment_intent'] as const) {
    const value = params.get(key);
    if (value) {
      query.set(key, value);
    }
  }
  query.set(PAYMENT_RETURN_DONE_PARAM, 'done');
  return `/${locale}/order/${identifier}/payment-status?${query.toString()}`;
}

/**
 * Czy przeglądarka udowodniła, że ten koszyk jest jej?
 *
 * Dwa akceptowane dowody, oba `httpOnly`, żaden nie pochodzi z query stringu:
 *  • `_medusa_cart_id` — koszyk jest wciąż aktywny w tej przeglądarce,
 *  • `_gp_completed_cart` — koszyk był już domykany w tej przeglądarce
 *    (odświeżenie po częściowo udanym powrocie).
 */
async function provesCartOwnership(cartId: string): Promise<boolean> {
  const activeCartId = await getCartId();
  if (activeCartId === cartId) {
    return true;
  }

  const completed = (await getCompletedCartId()) ?? '';
  return completed
    .split(',')
    .map(entry => entry.trim())
    .includes(cartId);
}

export async function GET(req: NextRequest): Promise<Response> {
  const search = req.nextUrl.searchParams;
  const locale = safeLocale(search.get('locale'));
  const rawCartId = search.get('cart_id') ?? '';

  const refuse = (code: RefusalCode): never => {
    // Odmowa jest WIDOCZNA (NFR-2) i nazwana. Nie kasujemy i nie mutujemy
    // niczego — wracamy na stronę statusu, która rozstrzygnie stan odczytem.
    console.warn(`[payment-return] completion refused code=${code} cart=${rawCartId || 'none'}`);
    redirect(statusPageUrl(locale, rawCartId || 'unknown', search));
  };

  const identifier = classifyPaymentReturnIdentifier(rawCartId);
  if (identifier.kind === null) {
    refuse('identifier_out_of_domain');
  }
  if (identifier.kind !== 'cart') {
    refuse('not_a_cart');
  }

  const params = await readStripeReturnParams({
    payment_intent: search.get('payment_intent') ?? undefined,
    redirect_status: search.get('redirect_status') ?? undefined
  } as Record<string, string>);

  if (!(await isStripeReturnConfirmation(params))) {
    refuse('no_stripe_confirmation');
  }

  if (!(await provesCartOwnership(identifier.value))) {
    refuse('cart_ownership_unproven');
  }

  // ── Idempotencja: ODCZYT przed mutacją ───────────────────────────────────
  let existing: string[] = [];
  try {
    existing = await getCompletedOrderIdsForCart(identifier.value, { attempts: 2 });
  } catch (error) {
    console.warn(`[payment-return] bridge read failed cart=${identifier.value}`, error);
  }

  if (existing.length === 0) {
    await performPaymentReturnCompletion(identifier.value);
  }

  redirect(statusPageUrl(locale, identifier.value, search));
}
