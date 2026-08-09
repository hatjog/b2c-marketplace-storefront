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
 */
import { NextResponse, type NextRequest } from 'next/server';

import { resolveMedusaBackendUrl } from '@/lib/env';
import { normalizeVoucherRules } from '@/lib/voucher/voucher-rules';

type RawEntitlement = Record<string, unknown>;

/** Kody odpowiedzi backendu przekazywane dalej BEZ tłumaczenia na 502. */
const PASSTHROUGH_STATUSES = new Set([401, 403]);

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
      if (PASSTHROUGH_STATUSES.has(res.status)) {
        return NextResponse.json(
          { error: 'entitlements_access_denied', backend_status: res.status },
          { status: res.status }
        );
      }

      return NextResponse.json(
        { error: 'entitlements_read_failed', backend_status: res.status },
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
    return NextResponse.json(entitlements, { status: 200 });
  } catch {
    return NextResponse.json({ error: 'entitlements_read_failed' }, { status: 502 });
  }
}
