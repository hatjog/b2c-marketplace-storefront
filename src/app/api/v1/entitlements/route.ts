/**
 * API Proxy: GET /api/v1/entitlements?order_id={id}
 *
 * Proxies GP entitlements endpoint to browser-level fetch so E2E tests
 * can intercept with page.route().
 *
 * ── v1.15.0 Story 3.7 (AC3, AD-19): awaria przestaje być ciszą ─────────────
 * Do tej story KAŻDA nieudana odpowiedź backendu i KAŻDY wyjątek sieciowy
 * kończyły się tu `NextResponse.json([], { status: 200 })`. Konsument nie miał
 * jak odróżnić „nie ma jeszcze voucherów" od „backend leży": dostawał pustą
 * kolekcję, wyprowadzał z niej `unknown`, a `unknown` renderował spinner
 * i kazał odpytywać dalej. Nieskończenie.
 *
 * AD-19 mówi wprost: odpowiedź zdegradowana NIGDY jako pusta kolekcja.
 *
 * Kontrakt po zmianie:
 *  • sukces → tablica uprawnień, HTTP 200 (kształt NIEZMIENIONY),
 *  • `401`/`403` z backendu → ten sam kod dalej. Ponawianie odmowy dostępu
 *    nigdy jej nie naprawi, a poller kończy na nich pętlę natychmiast,
 *  • każda inna porażka backendu i każdy wyjątek → `502` z nazwanym kodem.
 *    `502` jest przejściowy, więc poller odpytuje dalej — ale pod twardym
 *    limitem zegarowym, czyli i to odpytywanie ma koniec.
 *
 * Ciała błędu nie da się pomylić z kolekcją: to obiekt, nie tablica.
 *
 * ── v1.15.0 DW-15-132: dowód tożsamości jedzie razem z żądaniem ────────────
 * Do tej zmiany ten proxy wysyłał WYŁĄCZNIE `x-publishable-api-key` — ani JWT
 * klientki, ani dowodu posiadania koszyka. Klucz publishable jest z założenia
 * publiczny, więc backendowa trasa `/store/entitlements` nie miałaby czego
 * autoryzować i musiałaby odpowiadać `401` każdemu. Przekazujemy więc dokładnie
 * to samo, co `payment-status`:
 *   • `authorization: Bearer <_medusa_jwt>` — sesja zalogowanej kupującej,
 *   • `?cart_id=` z cookie `_gp_completed_cart` — dowód gościa.
 *
 * Dowód gościa pochodzi WYŁĄCZNIE z cookie, NIGDY z query stringu przeglądarki:
 * inaczej dowolna strona podstawiłaby własny `cart_id` i zamieniła ten proxy w
 * wyrocznię „czy ten koszyk zrobił to zamówienie".
 *
 * Kontrakt błędów (`entitlements_read_failed`, `_access_denied`,
 * `_rate_limited`, `_shape_invalid`) pozostaje NIETKNIĘTY — pilnuje go
 * walidator `confirmation-terminal-state` (człon 6).
 *
 * ── Wzmocnienia po recenzji (decyzja PO, 2026-08-10) ────────────────────────
 * Ładunek niesie `voucher_code`, czyli instrument NA OKAZICIELA — nie może być
 * chroniony słabiej niż enum statusu płatności. Stąd:
 *   • bramka `checkOrigin` — TA SAMA, której używa `payment-status` (wspólny
 *     moduł, nie kopia), z NAZWANYM powodem odmowy i logiem po stronie serwera,
 *   • `Cache-Control: no-store` na odpowiedzi `200`,
 *   • `404` przestaje udawać awarię — patrz komentarz przy `PASSTHROUGH`.
 */
import { cookies as nextCookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { getCompletedCartId } from '@/lib/data/cookies';
import { resolveMedusaBackendUrl } from '@/lib/env';
import { normalizeVoucherRules } from '@/lib/voucher/voucher-rules';

import { checkOrigin, describeOriginRejection } from '../orders/[id]/payment-status/origin-guard';

type RawEntitlement = Record<string, unknown>;

/** Kody odpowiedzi backendu przekazywane dalej BEZ tłumaczenia na 502. */
const PASSTHROUGH_STATUSES = new Set([401, 403]);

/**
 * `404` z backendu ZNACZY „cudze albo nieistniejące zamówienie", nie awarię.
 *
 * Do tej poprawki wpadał do gałęzi `502 entitlements_read_failed`, więc trwała
 * odmowa wyglądała dla pollera na stan przejściowy: `confirmation-poller` ma
 * NAZWANY stan `order_not_found` dla `404`, ale ta gałąź była NIEOSIĄGALNA —
 * pętla mieliła pełne 10 minut i kończyła ekranem awarii. Bratni
 * `payment-status` przepuszcza `404` jako `order_not_found`; robimy tak samo.
 * Kod tego błędu jest inny niż `entitlements_*`, bo inna jest jego klasa:
 * pozostałe kody kontraktu (`_read_failed`, `_access_denied`, `_rate_limited`,
 * `_shape_invalid`) zostają NIETKNIĘTE.
 */
const NOT_FOUND_STATUS = 404;

/**
 * `429` NIE jest awarią backendu i nie wolno go tłumaczyć na `502`.
 *
 * ZMIERZONE 2026-08-10 na realnym zakupie z telefonu: poller odpytywał ten route
 * i `payment-status` co 5 s przez limit 10 minut, backend zaczął odpowiadać
 * `429 too_many_requests`, a oba route'y zamieniły to na
 * `502 backend_unavailable`. Kupujący zobaczył „nie udało się odczytać zakupu",
 * czyli komunikat o awarii — podczas gdy backend żył i świadomie odmawiał obsługi.
 * Poller też nie miał jak zareagować, bo `502` znaczy dla niego „przejściowe,
 * odpytuj dalej w tym samym tempie", co podtrzymywało limiter.
 *
 * Odpowiedź niesie `Retry-After`, jeśli backend go podał — poller z niego korzysta.
 */
const RATE_LIMIT_STATUS = 429;

/**
 * `request_id` z ciała błędu backendu — albo `null`, gdy ciała nie ma.
 *
 * Odczyt jest CELOWO odporny na wszystko: ciałem odmowy bywa pusty string albo
 * HTML z proxy. Ten korelator jest dodatkiem do diagnostyki, więc jego brak nie
 * ma prawa zamienić odmowy backendu w wyjątek po naszej stronie.
 */
async function readBackendRequestId(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as unknown;
    const value = (body as { request_id?: unknown } | null)?.request_id;
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Bramka origin STOI PRZED wszystkim innym — dokładnie jak w `payment-status`.
  // Odmowa NAZYWA powód i loguje oba porównywane originy: `403` bez powodu jest
  // nieodróżnialne od realnej odmowy dostępu do zamówienia i 2026-08-10 wysłało
  // płacącego klienta na ekran „Brak dostępu do tego zamówienia", gdy przyczyna
  // leżała w konfiguracji stacka (LAN vs `NEXT_PUBLIC_BASE_URL`).
  const originVerdict = checkOrigin(request);
  if (!originVerdict.allowed) {
    console.warn(describeOriginRejection(originVerdict, 'entitlements'));
    return NextResponse.json(
      { error: 'origin_not_allowed', reason: originVerdict.reason },
      { status: 403 }
    );
  }

  const { searchParams } = request.nextUrl;
  const orderId = searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  }

  const backendUrl = resolveMedusaBackendUrl();
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

  // Brak klucza publishable to BŁĄD KONFIGURACJI STOREFRONTU, nie awaria
  // backendu: backend odpowiada wtedy `400`, my mapowaliśmy to na `502`, a
  // poller widział „przejściowe" i odpytywał w kółko. Nazywamy przyczynę —
  // w logu serwera i w polu `reason` — zostawiając kod błędu bez zmian.
  if (!publishableKey) {
    console.error(
      '[entitlements] brak NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY — backend odrzuci ' +
        'kazde zadanie z 400, a odczyt zakupu bedzie wygladal na trwala awarie backendu'
    );
    return NextResponse.json(
      { error: 'entitlements_read_failed', reason: 'publishable_key_missing' },
      { status: 502 }
    );
  }

  const cookieStore = await nextCookies();
  const token = cookieStore.get('_medusa_jwt')?.value;
  const completedCartId = await getCompletedCartId();

  const headers: Record<string, string> = {
    'x-publishable-api-key': publishableKey,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const upstreamUrl = (withProof: boolean): string => {
    const base = `${backendUrl}/store/entitlements?order_id=${encodeURIComponent(orderId)}`;
    return withProof && completedCartId
      ? `${base}&cart_id=${encodeURIComponent(completedCartId)}`
      : base;
  };

  try {
    let res = await fetch(upstreamUrl(!token), { headers, cache: 'no-store' });

    // Sesja nie może kasować dostępu gościa. Trzy realne przypadki:
    //   401/403 — `_medusa_jwt` wygasł albo jest nieważny;
    //   404      — sesja jest WAŻNA, ale zamówienie złożono bez konta, więc
    //              backend widzi „nie twoje" i nie zdradza jego istnienia.
    // Bez tej gałęzi kupująca, która zamówiła jako gość, a potem się zalogowała,
    // dostawała „nie znaleziono" mimo poprawnego dowodu w cookie — dokładnie ten
    // przypadek jest opisany w proxy `payment-status`.
    if (
      (res.status === 401 || res.status === 403 || res.status === 404) &&
      token &&
      completedCartId
    ) {
      const { authorization: _dropped, ...guestHeaders } = headers;
      res = await fetch(upstreamUrl(true), { headers: guestHeaders, cache: 'no-store' });
    }

    if (!res.ok) {
      // `request_id` z ciała backendu. Backend wkłada go do KAŻDEGO ciała błędu;
      // bez przepuszczenia go dalej `502` po stronie przeglądarki nie da się
      // skorelować z żadnym wpisem w logu backendu — czyli zgłoszenie od
      // kupującej kończy się na „coś nie zadziałało".
      const requestId = await readBackendRequestId(res);

      if (PASSTHROUGH_STATUSES.has(res.status)) {
        return NextResponse.json(
          { error: 'entitlements_access_denied', backend_status: res.status, request_id: requestId },
          { status: res.status }
        );
      }

      if (res.status === NOT_FOUND_STATUS) {
        return NextResponse.json(
          { error: 'order_not_found', message: 'Order not found', request_id: requestId },
          { status: NOT_FOUND_STATUS }
        );
      }

      if (res.status === RATE_LIMIT_STATUS) {
        const retryAfter = res.headers.get('retry-after');
        return NextResponse.json(
          { error: 'entitlements_rate_limited', backend_status: res.status },
          {
            status: RATE_LIMIT_STATUS,
            headers: retryAfter ? { 'retry-after': retryAfter } : undefined,
          }
        );
      }

      return NextResponse.json(
        { error: 'entitlements_read_failed', backend_status: res.status, request_id: requestId },
        { status: 502 }
      );
    }

    const data = (await res.json()) as unknown;

    if (!Array.isArray(data)) {
      // Kształt spoza dziedziny to BŁĄD, nie pusta kolekcja (AD-19). Wcześniej
      // wpadał w `: []` razem z awariami i był od nich nieodróżnialny.
      return NextResponse.json({ error: 'entitlements_shape_invalid' }, { status: 502 });
    }

    const entitlements = data.map((entry) => {
      const raw = entry as RawEntitlement;
      return {
        ...raw,
        voucherRules: normalizeVoucherRules(raw),
      };
    });
    // Ładunek niesie `voucher_code` — instrument na okaziciela. Nic go nie
    // przechowuje: ani cache przeglądarki, ani żadne proxy po drodze.
    return NextResponse.json(entitlements, {
      status: 200,
      headers: { 'cache-control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'entitlements_read_failed' }, { status: 502 });
  }
}
