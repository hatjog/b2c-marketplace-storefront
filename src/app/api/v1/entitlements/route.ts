/**
 * API Proxy: GET /api/v1/entitlements?order_id={id}
 *
 * Proxies GP entitlements endpoint to browser-level fetch so E2E tests
 * can intercept with page.route().
 */
import { NextResponse, type NextRequest } from 'next/server';

import { resolveMedusaBackendUrl } from '@/lib/env';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const orderId = searchParams.get('order_id');

  if (!orderId) {
    return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
  }

  const backendUrl = resolveMedusaBackendUrl();
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? '';

  try {
    const res = await fetch(
      `${backendUrl}/store/entitlements?order_id=${encodeURIComponent(orderId)}`,
      {
        headers: {
          'x-publishable-api-key': publishableKey,
        },
        cache: 'no-store',
      }
    );

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const data = (await res.json()) as unknown;
    const entitlements = Array.isArray(data) ? data : [];
    return NextResponse.json(entitlements, { status: 200 });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
