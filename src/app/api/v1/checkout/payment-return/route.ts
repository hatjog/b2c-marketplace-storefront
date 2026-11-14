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

import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/routing';
import { classifyPaymentReturnIdentifier } from '@/lib/checkout/payment-return-identifier';
import { getCompletedPurchaseForCart } from '@/lib/data/cart';
import {
  getPaymentReturnOutcome,
  getPaymentReturnOutcomeStorageState,
  provesCartOwnership,
  setPaymentReturnOutcome
} from '@/lib/data/cookies';
import {
  getPaymentIntentBindingForCart,
  isStripeReturnConfirmation,
  performPaymentReturnCompletion,
  readStripeReturnParams,
  type PaymentReturnOutcome
} from '@/lib/data/payment-return';
import { PAYMENT_RETURN_DONE_PARAM } from '@/lib/data/payment-return-constants';

/** Domknięcie jest mutacją — nigdy nie wolno go zapamiętać w cache'u. */
export const dynamic = 'force-dynamic';

type RefusalCode =
  | 'identifier_out_of_domain'
  | 'not_a_cart'
  | 'no_stripe_confirmation'
  | 'cart_ownership_unproven'
  | 'payment_intent_mismatch'
  | 'ambiguous_return_parameters';

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
  params: URLSearchParams,
  outcome: PaymentReturnOutcome = 'done'
): string {
  const query = new URLSearchParams();
  for (const key of ['redirect_status', 'payment_intent'] as const) {
    const values = params.getAll(key);
    if (values.length === 1 && values[0]) {
      query.set(key, values[0]);
    }
  }
  query.set(PAYMENT_RETURN_DONE_PARAM, outcome);
  return `/${locale}/order/${encodeURIComponent(identifier)}/payment-status?${query.toString()}`;
}

function persistsPaymentReturnOutcome(outcome: PaymentReturnOutcome): boolean {
  return (
    outcome === 'completion_failed' ||
    outcome === 'no_order_id' ||
    outcome === 'identifier_out_of_domain' ||
    outcome === 'not_a_cart' ||
    outcome === 'no_stripe_confirmation' ||
    outcome === 'cart_ownership_unproven' ||
    outcome === 'payment_intent_mismatch' ||
    outcome === 'ambiguous_return_parameters' ||
    outcome === 'completion_read_failed' ||
    outcome === 'completion_access_denied' ||
    isNonTerminalReadOutcome(outcome)
  );
}

/**
 * Story 8.1 fix (runda 2, HIGH): awaria ODCZYTU przed mutacją jest
 * nieterminalna, ale MUSI być zapisana. Bez markera strona statusu (która
 * bierze outcome wyłącznie z podpisanego cookie) widziała pusty mostek,
 * wystawiała `completionRedirect` i odsyłała z powrotem tutaj — pętla
 * `ERR_TOO_MANY_REDIRECTS`. Krótki TTL utrzymuje nieterminalność: po jego
 * upływie kolejne wejście ponawia odczyt i domknięcie.
 */
const NON_TERMINAL_READ_OUTCOME_TTL_SECONDS = 60;

function isNonTerminalReadOutcome(
  outcome: PaymentReturnOutcome
): outcome is Extract<PaymentReturnOutcome, 'read_failed' | 'access_denied'> {
  return outcome === 'read_failed' || outcome === 'access_denied';
}

function isTerminalCompletionOutcome(
  outcome: string | null
): outcome is Extract<
  PaymentReturnOutcome,
  'completion_failed' | 'no_order_id' | 'completion_read_failed' | 'completion_access_denied'
> {
  return (
    outcome === 'completion_failed' ||
    outcome === 'no_order_id' ||
    outcome === 'completion_read_failed' ||
    outcome === 'completion_access_denied'
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const search = req.nextUrl.searchParams;
  const locale = safeLocale(search.get('locale'));
  const rawCartId = search.get('cart_id') ?? '';

  const redirectWithOutcome = async (
    identifier: string,
    outcome: PaymentReturnOutcome
  ): Promise<never> => {
    if (persistsPaymentReturnOutcome(outcome)) {
      const storageState = await setPaymentReturnOutcome({
        identifier,
        paymentIntent: search.get('payment_intent'),
        outcome,
        ...(isNonTerminalReadOutcome(outcome)
          ? { ttlSeconds: NON_TERMINAL_READ_OUTCOME_TTL_SECONDS }
          : {})
      });
      if (storageState !== 'ready') {
        console.error(
          `[payment-return] outcome marker unavailable state=${storageState} cart=${identifier}`
        );
      }
    }
    redirect(statusPageUrl(locale, identifier, search, outcome));
  };

  const redirectWithoutStoredOutcome = (
    identifier: string,
    outcome: PaymentReturnOutcome
  ): never => {
    // Wartość z URL-u nie może rezerwować miejsca w podpisanej kopercie
    // outcome. Przed dowodem własności byłaby kontrolowana przez atakującego
    // i trzy odmowy mogłyby zablokować rzeczywisty powrót właścicielki.
    redirect(statusPageUrl(locale, identifier, search, outcome));
  };

  const identifier = classifyPaymentReturnIdentifier(rawCartId);
  if (identifier.kind === null) {
    // Nie odbijamy niesklasyfikowanego wejścia w ścieżce ani w cookie.
    return redirectWithoutStoredOutcome('unknown', 'identifier_out_of_domain');
  }
  if (identifier.kind !== 'cart') {
    return redirectWithoutStoredOutcome(identifier.value, 'not_a_cart');
  }

  // Własność sprawdzamy PRZED każdym zapisem refusal outcome. Dzięki temu
  // obcy cart_id nie może zatruć ograniczonej listy markerów przeglądarki.
  if (!(await provesCartOwnership(identifier.value))) {
    console.warn(
      `[payment-return] completion refused code=cart_ownership_unproven cart=${identifier.value}`
    );
    return redirectWithoutStoredOutcome(identifier.value, 'cart_ownership_unproven');
  }

  const refuse = async (code: Exclude<RefusalCode, 'cart_ownership_unproven'>): Promise<never> => {
    // Od tej linii identyfikator jest koszykiem należącym do tej przeglądarki,
    // więc podpisany marker wiąże nazwany powód odmowy z właściwym tuplem.
    console.warn(`[payment-return] completion refused code=${code} cart=${identifier.value}`);
    return redirectWithOutcome(identifier.value, code);
  };

  const params = await readStripeReturnParams({
    payment_intent: search.getAll('payment_intent'),
    redirect_status: search.getAll('redirect_status'),
    payment_intent_client_secret: search.getAll('payment_intent_client_secret')
  });

  if (params.ambiguous) {
    return refuse('ambiguous_return_parameters');
  }

  if (!(await isStripeReturnConfirmation(params))) {
    return refuse('no_stripe_confirmation');
  }

  if (!params.payment_intent) {
    return refuse('payment_intent_mismatch');
  }
  // Story 8.1 fix (REG-C6-NEW-004): awaria odczytu koszyka/sesji płatności
  // to nazwany, NIETERMINALNY `read_failed`, a nie odmowa korelacji. Runda 2:
  // zapisywany z krótkim TTL — strona statusu honoruje go jako recovery i nie
  // odsyła tu z powrotem; po wygaśnięciu kolejne wejście ponawia odczyt.
  const binding = await getPaymentIntentBindingForCart(identifier.value, params.payment_intent);
  if (binding === 'read_failed') {
    console.warn(`[payment-return] payment intent binding read failed cart=${identifier.value}`);
    return redirectWithOutcome(identifier.value, 'read_failed');
  }
  if (binding !== 'bound') {
    return refuse('payment_intent_mismatch');
  }

  const priorOutcome = await getPaymentReturnOutcome(identifier.value, params.payment_intent);
  if (isTerminalCompletionOutcome(priorOutcome)) {
    // Zapisany wynik mutacji zatrzymuje replay, ale jego ponowne przekierowanie
    // nie może przesuwać TTL i trzymać blokady dłużej niż pierwszy wynik.
    redirect(statusPageUrl(locale, identifier.value, search, priorOutcome));
  }

  // ── Idempotencja: ODCZYT przed mutacją ───────────────────────────────────
  let bridge: Awaited<ReturnType<typeof getCompletedPurchaseForCart>>;
  try {
    bridge = await getCompletedPurchaseForCart(identifier.value, { attempts: 2 });
  } catch (error) {
    console.warn(`[payment-return] bridge read failed cart=${identifier.value}`, error);
    return redirectWithOutcome(identifier.value, 'read_failed');
  }

  if (bridge.state === 'complete') {
    return redirectWithOutcome(identifier.value, 'done');
  }

  if (bridge.state !== 'empty') {
    const outcome: Extract<
      PaymentReturnOutcome,
      'read_failed' | 'access_denied' | 'incomplete' | 'malformed'
    > =
      bridge.state === 'read_failed'
        ? 'read_failed'
        : bridge.state === 'access_denied'
          ? 'access_denied'
          : bridge.state === 'malformed'
            ? 'malformed'
            : 'incomplete';
    return redirectWithOutcome(identifier.value, outcome);
  }

  const outcomeStorageState = await getPaymentReturnOutcomeStorageState(
    identifier.value,
    params.payment_intent
  );
  if (outcomeStorageState === 'secret_unavailable') {
    console.error(
      `[payment-return] outcome marker unavailable state=secret_unavailable cart=${identifier.value}`
    );
    return redirectWithOutcome(identifier.value, 'outcome_marker_unavailable');
  }
  if (outcomeStorageState === 'capacity_exhausted') {
    console.warn(`[payment-return] outcome marker capacity exhausted cart=${identifier.value}`);
    return redirectWithOutcome(identifier.value, 'outcome_marker_capacity_exhausted');
  }

  const completion = await performPaymentReturnCompletion(identifier.value);
  // Story 8.1 fix (runda 2, MEDIUM): odczyt niepewny PO wykonanym
  // `POST /complete` to inny fakt niż ten sam odczyt przed mutacją. Marker
  // `completion_*` jest terminalny dla mutacji (blokuje drugi POST przy
  // mostku `empty`), ale strona nadal ponownie czyta mostek.
  const outcome: PaymentReturnOutcome =
    completion.outcome === 'read_failed'
      ? 'completion_read_failed'
      : completion.outcome === 'access_denied'
        ? 'completion_access_denied'
        : completion.outcome;
  return redirectWithOutcome(identifier.value, outcome);
}
