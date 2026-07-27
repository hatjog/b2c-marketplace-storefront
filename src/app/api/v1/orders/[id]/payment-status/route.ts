/**
 * API Proxy: GET /api/v1/orders/[id]/payment-status
 *
 * Story 6.1: Payment Pending, Failed and Recovery Hardening.
 *
 * Proxies the GP backend reconciliation endpoint
 * `GET /store/orders/:id/payment-status` to the browser level so that:
 *   - Playwright E2E tests can intercept with page.route().
 *   - Customer JWT cookie is forwarded (customer-scoped read).
 *   - The response shape is the same as the backend response:
 *     { status, last_checked_at, recommended_action_key, request_id }
 *
 * Idempotency (NFR8 / NFR9 / AC 4):
 *   This is a pure READ proxy. No mutation, no order/session creation.
 *   Callers may poll this endpoint repeatedly without risk of duplicate
 *   charges, orders, or vouchers.
 *
 * Raw provider errors (AC 2):
 *   The backend returns only lifecycle state ids — no Stripe decline_code,
 *   error.message, or stack traces are forwarded to the browser.
 *
 * Dostęp gościa:
 *   Checkout bez konta nie zostawia sesji, więc dla gościa dokładamy dowód
 *   posiadania koszyka (cookie `_gp_completed_cart` → `?cart_id=`), który
 *   backend weryfikuje w `order_cart`. Dowód nigdy nie pochodzi z query stringu
 *   przeglądarki i nigdy nie jest doklejany, gdy sesja klienta działa.
 *
 * @see GP/backend/src/api/store/orders/[id]/payment-status/route.ts (backend)
 * @see GP/storefront/src/components/sections/PaymentStatusPageContent/PaymentStatusPageContent.tsx (consumer)
 */

import { cookies as nextCookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { getCompletedCartId } from '@/lib/data/cookies';
import { resolveMedusaBackendUrl } from '@/lib/env';

import { isAllowedOrigin } from './origin-guard';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const backendUrl = resolveMedusaBackendUrl();
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

  const cookies = await nextCookies();
  const token = cookies.get('_medusa_jwt')?.value;
  // Dowód gościa pochodzi WYŁĄCZNIE z naszego cookie. Wartość z query stringu
  // jest ignorowana — inaczej dowolna strona mogłaby podstawić własny cart_id
  // i zamienić ten proxy w wyrocznię „czy ten koszyk zrobił to zamówienie".
  const completedCartId = await getCompletedCartId();

  const headers: Record<string, string> = {
    'x-publishable-api-key': publishableKey,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const upstreamUrl = (withProof: boolean): string => {
    const base = `${backendUrl}/store/orders/${encodeURIComponent(id)}/payment-status`;
    return withProof && completedCartId
      ? `${base}?cart_id=${encodeURIComponent(completedCartId)}`
      : base;
  };

  try {
    let res = await fetch(upstreamUrl(!token), { headers, cache: 'no-store' });

    // Sesja nie może kasować dostępu gościa. Dwa realne przypadki:
    //   401/403 — `_medusa_jwt` wygasł albo jest nieważny;
    //   404      — sesja jest WAŻNA, ale zamówienie złożono bez konta, więc
    //              backend widzi „nie twoje" i nie zdradza jego istnienia.
    // Bez 404 kupująca, która zamówiła jako gość, a potem się zalogowała,
    // dostawała „nie znaleziono" mimo poprawnego dowodu w cookie.
    if (
      (res.status === 401 || res.status === 403 || res.status === 404) &&
      token &&
      completedCartId
    ) {
      const { authorization: _dropped, ...guestHeaders } = headers;
      res = await fetch(upstreamUrl(true), { headers: guestHeaders, cache: 'no-store' });
    }

    if (!res.ok) {
      // Preserve semantically meaningful status codes:
      //   401/403 → access_denied (customer navigated to wrong order or session expired)
      //   404     → order_not_found (explicit shape so polling can surface error vs. keep waiting)
      //   5xx     → backend unavailable (transient; keep polling)
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'access_denied', message: 'Payment status not accessible' },
          { status: res.status },
        );
      }
      if (res.status === 404) {
        return NextResponse.json(
          { error: 'order_not_found', message: 'Order not found' },
          { status: 404 },
        );
      }
      return NextResponse.json({ error: 'backend_unavailable', message: 'Backend unavailable' }, { status: 502 });
    }

    const data = (await res.json()) as {
      status?: string;
      last_checked_at?: string;
      recommended_action_key?: string;
      request_id?: string;
      failure_code?: string | null;
      ticket_id?: string | null;
    };

    return NextResponse.json(
      {
        status: data.status ?? 'pending_psp_confirmation',
        last_checked_at: data.last_checked_at ?? new Date().toISOString(),
        recommended_action_key: data.recommended_action_key ?? 'wait',
        request_id: data.request_id ?? null,
        failure_code: data.failure_code ?? null,
        ticket_id: data.ticket_id ?? null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
