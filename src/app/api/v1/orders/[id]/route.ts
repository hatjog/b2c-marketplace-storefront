/**
 * API Proxy: GET /api/v1/orders/[id]
 *
 * Proxies Medusa store order to browser-level fetch so E2E tests
 * can intercept with page.route().
 *
 * v1.7.0 Story 2.4 review fixes (F1-F4):
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
 */
import { cookies as nextCookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveMedusaBackendUrl } from '@/lib/env';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Map Medusa's `OrderPaymentStatus` enum to a GP shared lifecycle state id.
 *
 * Conservative mapping — favours pending over paid. Refunds map to
 * `support_required` because Story 2.4 does not own the refund UX
 * (Story 2.5 / 2.6 surfaces own that copy); routing customers via support
 * keeps the AC3 single-recovery-path discipline auditable.
 *
 * Anything unknown → `pending_psp_confirmation` (anti-optimistic-paid).
 */
function mapMedusaPaymentStatusToLifecycle(raw: string | null | undefined): string {
  switch (raw) {
    case 'captured':
    case 'partially_captured':
      return 'paid';
    case 'not_paid':
    case 'awaiting':
    case 'authorized':
    case 'partially_authorized':
    case 'requires_action':
      return 'pending_psp_confirmation';
    case 'canceled':
      return 'expired';
    case 'refunded':
    case 'partially_refunded':
      return 'support_required';
    default:
      return 'pending_psp_confirmation';
  }
}

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const backendUrl = resolveMedusaBackendUrl();
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

  // F1 fix: forward customer JWT cookie so the upstream call is scoped to the
  // signed-in customer's own orders. Without this header Medusa cannot
  // authorize the lookup and would either 401 or, for guest orders with a
  // permissive setup, leak data to any caller who guesses the id.
  const cookies = await nextCookies();
  const token = cookies.get('_medusa_jwt')?.value;

  const headers: Record<string, string> = {
    'x-publishable-api-key': publishableKey,
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(
      // F2 fix: include updated_at so the timestamp surface can render.
      // F4 fix: do NOT request `metadata` — internal flags must not reach
      // the browser.
      `${backendUrl}/store/orders/${encodeURIComponent(id)}?fields=id,display_id,payment_status,updated_at`,
      {
        headers,
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      // Preserve upstream status so the UI can distinguish access_denied (401/403)
      // from unavailable (5xx) without leaking the upstream body.
      const status = res.status === 401 || res.status === 403 ? res.status : (res.status || 502);
      return NextResponse.json({ error: 'Order not accessible' }, { status });
    }

    const data = (await res.json()) as {
      order?: {
        id?: string;
        display_id?: string | number | null;
        payment_status?: string | null;
        updated_at?: string | null;
      };
    };

    const order = data.order;
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // F3 fix: map Medusa's payment status taxonomy to the GP shared lifecycle
    // vocabulary at the proxy boundary. The frontend adapter's safe-default
    // remains a second line of defence against unknown values.
    const lifecycleStatus = mapMedusaPaymentStatusToLifecycle(order.payment_status);

    return NextResponse.json(
      {
        id: order.id,
        display_id: order.display_id ?? null,
        payment_status: lifecycleStatus,
        updated_at: order.updated_at ?? null,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
