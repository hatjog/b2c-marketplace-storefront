/**
 * Same-origin guard for the `GET /api/v1/orders/[id]/payment-status` proxy.
 *
 * Extracted from `route.ts` because Next.js App Router route files may only
 * export route handlers and reserved config symbols — exporting this helper
 * trips the generated route type check. Both the route and its unit test
 * import `isAllowedOrigin` from here.
 */
import { type NextRequest } from 'next/server';

export function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigin =
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    null;

  if (!origin && !referer) {
    return true;
  }

  let candidate: string | null = origin;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      return false;
    }
  }

  if (!candidate) {
    return false;
  }

  if (allowedOrigin && candidate !== allowedOrigin) {
    return false;
  }

  return candidate.startsWith('http://') || candidate.startsWith('https://');
}
