import { NextResponse, type NextRequest } from 'next/server';

/**
 * D-64 (architecture.md:328) — CSP violation report stub endpoint.
 *
 * v1.4.0 stub: accepts POST `application/csp-report` and `application/json`
 * bodies, returns HTTP 204 (No Content). Logs payload to console for staging
 * 24h soak observability (R3-AI-07 staging gate).
 *
 * v1.5.0 will implement persistence to Sentry and aggregation; this stub
 * exists so violation reports under `STOREFRONT_CSP_MODE=report-only` do NOT
 * 404 during staging soak.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let payload: unknown = null;

    if (
      contentType.includes('application/csp-report') ||
      contentType.includes('application/reports+json') ||
      contentType.includes('application/json')
    ) {
      payload = await request.json().catch(() => null);
    } else {
      payload = await request.text().catch(() => null);
    }

    // v1.5.0 will replace console with Sentry capture + DB persistence.
    console.warn('[csp-report] violation received', {
      contentType,
      payload,
    });
  } catch {
    // Swallow — endpoint must always 204 to avoid blocking violation
    // reporters. Errors here would just produce more noise.
  }

  return new NextResponse(null, { status: 204 });
}
