/**
 * API Proxy: GET /api/v1/orders/[id]
 *
 * Proxies Medusa store order to browser-level fetch so E2E tests
 * can intercept with page.route().
 */
import { NextResponse, type NextRequest } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const backendUrl = process.env.MEDUSA_BACKEND_URL ?? 'http://localhost:9000';
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

  try {
    const res = await fetch(
      `${backendUrl}/store/orders/${encodeURIComponent(id)}?fields=id,display_id,payment_status,metadata`,
      {
        headers: {
          'x-publishable-api-key': publishableKey,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Order not found' }, { status: res.status });
    }

    const data = (await res.json()) as { order: unknown };
    return NextResponse.json(data.order, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
