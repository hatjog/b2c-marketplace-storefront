/**
 * API Proxy: GET /api/v1/orders/[id]
 *
 * Proxies Medusa store order to browser-level fetch so E2E tests
 * can intercept with page.route().
 *
 * v1.7.0 Story 2.4 review fixes (first pass — F1-F4):
 *   - F1: Forward `Authorization` from `_medusa_jwt` cookie so logged-in
 *     customers can fetch their own order; unauthenticated lookups return
 *     401 (which the UI maps to `access_denied`/`unavailable`) instead of
 *     leaking guest order data to anyone with the order id.
 *   - F2: Request `updated_at` so the panel's last-update timestamp can render.
 *   - F3: Map Medusa's `OrderPaymentStatus` enum (not_paid/awaiting/authorized/
 *     captured/...) to the GP shared lifecycle vocabulary
 *     (paid/pending_psp_confirmation/failed/support_required/expired) at this
 *     boundary. Pure read-only mapping; never returns `paid` for unknown input.
 *   - F4: Drop `metadata` from the upstream `fields` set so internal flags
 *     never reach the browser.
 *
 * v1.7.0 Story 2.4 review fixes (second pass — R2/R3/R4/R7):
 *   - R2: Add Origin/Referer same-origin guard so cross-origin scripts cannot
 *     enumerate order ids via the authenticated user's cookies.
 *   - R3: Map Stripe's `requires_action` to `failed` (NOT pending). The user
 *     must complete 3DS / SCA — refreshing the page does nothing; retrying
 *     the payment is the only safe recovery path.
 *   - R4: Also read order-level `status` so the `expired` lifecycle id is
 *     actually reachable. `payment_status` alone never produces `expired` in
 *     Medusa; the order's lifecycle status is the authoritative source.
 *   - R7: Normalise `display_id` to string so downstream consumer types
 *     match the wire shape.
 */
import { cookies as nextCookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { maskEmail } from '@/lib/confirmation/order-confirmed-stepper';
import { getCompletedCartId } from '@/lib/data/cookies';
import { resolveMedusaBackendUrl } from '@/lib/env';

import { CART_PROOF_HEADER } from './cart-proof-header';
import {
  isGuestCheckout,
  mapMedusaOrderStatusToLifecycle,
  mapMedusaPaymentStatusToLifecycle,
} from './lifecycle-mappers';

type RouteContext = { params: Promise<{ id: string }> };

function coerceNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * R2 review fix: same-origin guard. Reject cross-origin GETs so a malicious
 * site cannot enumerate order ids via the logged-in user's storefront
 * cookies (CSRF read). Same-Site cookie policy alone is not sufficient
 * because legacy browsers and bookmark/PDF preview contexts may still
 * attach cookies on third-party fetches.
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigin =
    process.env.NEXT_PUBLIC_STOREFRONT_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? null;

  // Same-origin XHR omits Origin only on simple GET — in App Router this
  // route runs as a Route Handler which generally receives Origin. If the
  // request is server-side (no Origin/Referer) we trust it; if Origin is
  // present, it must match. If no Origin but Referer is, derive origin
  // from Referer.
  if (!origin && !referer) {
    // Most likely a same-origin Server Component fetch; allow.
    return true;
  }

  const candidate = origin ?? (referer ? new URL(referer).origin : null);
  if (!candidate) {
    return false;
  }

  if (allowedOrigin && candidate !== allowedOrigin) {
    return false;
  }

  // Fallback: if no explicit env, accept any same-origin (the request is
  // routed through this storefront's own domain by definition because the
  // route is mounted there) — but reject when Origin is suspiciously a
  // null/file/data URL.
  return candidate.startsWith('http://') || candidate.startsWith('https://');
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  // R2 review fix: same-origin guard — return 403 (no body) on cross-origin.
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const backendUrl = resolveMedusaBackendUrl();
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

  // F1 fix: forward customer JWT cookie so the upstream call is scoped to the
  // signed-in customer's own orders. Without this header Medusa cannot
  // authorize the lookup and would either 401 or, for guest orders with a
  // permissive setup, leak data to any caller who guesses the id.
  const cookies = await nextCookies();
  const token = cookies.get('_medusa_jwt')?.value;
  // Dowód gościa — ta trasa jako JEDYNA z trójki go nie wysyłała.
  //
  // Checkout bez konta nie zostawia sesji, więc bez tego nagłówka upstream
  // odmawiał KAŻDEMU gościowi. Zmierzone 2026-08-11 na żywym stacku: w jednej
  // serii żądań, z tym samym cookie, `payment-status` i `entitlements`
  // zwracały 200, a ta trasa 401. Karta zamówienia zamienia taką odmowę na
  // `read_failed`, a nagłówek strony na „Nie udało nam się teraz odczytać
  // całego zakupu" — mimo że płatność przeszła, a vouchery istniały.
  //
  // Wartość leci VERBATIM: cookie trzyma do trzech ostatnich koszyków po
  // przecinku (`setCompletedCartId`), a `parseCartProof` po stronie backendu
  // rozdziela tę listę samo. Obcinanie jej tutaj do pierwszego wpisu odbierałoby
  // dostęp do wcześniejszego zamówienia przy każdym kolejnym zakupie.
  const completedCartProof = await getCompletedCartId();

  const headers: Record<string, string> = {
    'x-publishable-api-key': publishableKey
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  // Dowód nigdy nie pochodzi z query stringu przeglądarki — wyłącznie z naszego
  // `httpOnly` cookie. Inaczej dowolna strona podstawiłaby własny `cart_id`
  // i zamieniła ten proxy w wyrocznię „czy ten koszyk zrobił to zamówienie".
  if (completedCartProof) {
    headers[CART_PROOF_HEADER] = completedCartProof;
  }

  // Diagnostyka „żadnych poświadczeń" — 2026-08-11.
  //
  // Bez tej linii odmowa dla gościa jest po stronie serwera NIEODRÓŻNIALNA od
  // odmowy dla kogoś, kto dowód miał i stracił. Podczas analizy zakupu z tego
  // dnia dowód działał do 06:04:18, a każde późniejsze żądanie przychodziło
  // BEZ niego — i nie dało się rozstrzygnąć, czy cookie zostało unieważnione,
  // czy po prostu przyszła druga karta/urządzenie, które go nigdy nie miało.
  // Żaden z dwóch logów nie zapisuje user-agenta, więc pytanie było
  // nierozstrzygalne po fakcie. Ta linia sprawia, że następne wystąpienie
  // nazwie się samo.
  if (!token && !completedCartProof) {
    console.warn(
      JSON.stringify({
        event: 'order_read_without_credentials',
        order_id: id,
        // Bez wartości cookie i bez id klienta — to ma odróżniać KLASY żądań,
        // a nie identyfikować kupującą.
        user_agent: request.headers.get('user-agent') ?? '(brak)',
        referer: request.headers.get('referer') ?? '(brak)',
      }),
    );
  }

  try {
    const res = await fetch(
      // F2 fix: include updated_at so the timestamp surface can render.
      // F4 fix: do NOT request `metadata` — internal flags must not reach
      // the browser.
      // R4 fix: also request order-level `status` so the `expired` lifecycle
      // id is reachable (payment_status alone never produces `expired`).
      `${backendUrl}/store/orders/${encodeURIComponent(id)}?fields=id,display_id,payment_status,status,updated_at,email,customer_id,currency_code,item_total,shipping_total,tax_total,total,*items,*items.thumbnail,+items.metadata,*shipping_methods`,
      {
        headers,
        cache: 'no-store'
      }
    );

    if (!res.ok) {
      // Preserve upstream status so the UI can distinguish access_denied (401/403)
      // from unavailable (5xx/404) without leaking the upstream body.
      const status = res.status === 401 || res.status === 403 ? res.status : res.status || 502;
      return NextResponse.json({ error: 'Order not accessible' }, { status });
    }

    const data = (await res.json()) as {
      order?: {
        id?: string;
        display_id?: string | number | null;
        payment_status?: string | null;
        status?: string | null;
        updated_at?: string | null;
        email?: string | null;
        customer_id?: string | null;
        currency_code?: string | null;
        item_total?: number | null;
        shipping_total?: number | null;
        tax_total?: number | null;
        total?: number | null;
        items?: Array<{
          id?: string | null;
          title?: string | null;
          quantity?: number | null;
          subtotal?: number | null;
          total?: number | null;
          unit_price?: number | null;
          thumbnail?: string | null;
          metadata?: Record<string, unknown> | null;
        }>;
        shipping_methods?: Array<{
          id?: string | null;
          name?: string | null;
        }>;
      };
    };

    const order = data.order;
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // F3 fix: map Medusa's payment status taxonomy to the GP shared lifecycle
    // vocabulary at the proxy boundary. The frontend adapter's safe-default
    // remains a second line of defence against unknown values.
    // R4 fix: prefer the order-level lifecycle override when it advances the
    // state (e.g. canceled order → expired wins over a stale payment_status).
    const paymentLifecycle = mapMedusaPaymentStatusToLifecycle(order.payment_status);
    const orderLifecycle = mapMedusaOrderStatusToLifecycle(order.status);
    const lifecycleStatus = orderLifecycle ?? paymentLifecycle;

    // R7 fix: normalise display_id to string. Upstream may return number;
    // downstream consumer types it as string.
    const displayId =
      order.display_id !== null && order.display_id !== undefined ? String(order.display_id) : null;

    return NextResponse.json(
      {
        id: order.id,
        display_id: displayId,
        payment_status: lifecycleStatus,
        updated_at: order.updated_at ?? null,
        customer_id: order.customer_id ?? null,
        masked_email: maskEmail(order.email ?? null),
        is_guest_checkout: isGuestCheckout(order.customer_id),
        currency_code: order.currency_code ?? null,
        item_total: coerceNumber(order.item_total),
        shipping_total: coerceNumber(order.shipping_total),
        tax_total: coerceNumber(order.tax_total),
        total: coerceNumber(order.total),
        items: Array.isArray(order.items)
          ? order.items.map(item => ({
              id: item.id ?? null,
              title: item.title ?? null,
              quantity: coerceNumber(item.quantity),
              subtotal: coerceNumber(item.subtotal),
              total: coerceNumber(item.total),
              unit_price: coerceNumber(item.unit_price),
              thumbnail: item.thumbnail ?? null,
              metadata: item.metadata ?? null
            }))
          : [],
        shipping_methods: Array.isArray(order.shipping_methods)
          ? order.shipping_methods.map(method => ({
              id: method.id ?? null,
              name: method.name ?? null
            }))
          : []
      },
      { status: 200 }
    );
  } catch (error) {
    // R21 fix: log the failure for diagnostics (UI surface stays generic;
    // logger does not leak to UI). Use console.error so server-side log
    // collection captures the breadcrumb.
    // eslint-disable-next-line no-console
    console.error('[payment-status] proxy fetch failed', error);
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
