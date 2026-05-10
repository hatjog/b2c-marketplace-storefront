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
 * @see GP/backend/src/api/store/orders/[id]/payment-status/route.ts (backend)
 * @see GP/storefront/src/components/sections/PaymentStatusPageContent/PaymentStatusPageContent.tsx (consumer)
 */

import { cookies as nextCookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { resolveMedusaBackendUrl } from '@/lib/env';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const backendUrl = resolveMedusaBackendUrl();
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

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
      `${backendUrl}/store/orders/${encodeURIComponent(id)}/payment-status`,
      {
        headers,
        cache: 'no-store',
      },
    );

    if (!res.ok) {
      const status = res.status === 401 || res.status === 403 ? res.status : (res.status || 502);
      return NextResponse.json({ error: 'Payment status not accessible' }, { status });
    }

    const data = (await res.json()) as {
      status?: string;
      last_checked_at?: string;
      recommended_action_key?: string;
      request_id?: string;
    };

    return NextResponse.json(
      {
        status: data.status ?? 'pending_psp_confirmation',
        last_checked_at: data.last_checked_at ?? new Date().toISOString(),
        recommended_action_key: data.recommended_action_key ?? 'wait',
        request_id: data.request_id ?? null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
