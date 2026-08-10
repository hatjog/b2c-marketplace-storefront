/**
 * Same-origin guard for the `GET /api/v1/orders/[id]/payment-status` proxy.
 *
 * Extracted from `route.ts` because Next.js App Router route files may only
 * export route handlers and reserved config symbols — exporting this helper
 * trips the generated route type check. Both the route and its unit test
 * import `isAllowedOrigin` from here.
 *
 * ── Dlaczego odrzucenie musi byc DIAGNOZOWALNE ──────────────────────────────
 *
 * ZMIERZONE 2026-08-10 na realnym zakupie z telefonu. Kupujacy zaplacil karta
 * (Stripe, 260 zl, `captured`), wrocil z 3DS i zobaczyl **„Brak dostepu do tego
 * zamowienia"**. Nie mial problemu z dostepem: zadanie w ogole nie doszlo do
 * backendu (log backendu nie ma po nim ani sladu) — odrzucil je ten straznik,
 * bo strona byla serwowana z `http://192.168.100.89:3002` (LAN), a
 * `NEXT_PUBLIC_BASE_URL` w procesie storefrontu wskazywal `http://localhost:3002`.
 *
 * Stack stracil konfiguracje LAN przy kolejnym uruchomieniu `gp_services_up.sh`
 * bez `GP_STOREFRONT_BASE_HOST` — a `403 Forbidden` bez powodu jest nieodroznialne
 * od realnej odmowy dostepu. Placacy klient dostal komunikat o cudzym zamowieniu,
 * operator nie dostal nic.
 *
 * Dlatego odrzucenie zwraca teraz NAZWANY powod i loguje oba porownywane originy.
 * Sam werdykt bezpieczenstwa jest bez zmian — nadal odrzucamy.
 */
import { type NextRequest } from 'next/server';

export type OriginVerdict =
  | { allowed: true }
  | { allowed: false; reason: 'origin_mismatch'; candidate: string; expected: string }
  | { allowed: false; reason: 'origin_unparsable'; candidate: null; expected: string | null }
  | { allowed: false; reason: 'origin_scheme_unsupported'; candidate: string; expected: string | null };

export function checkOrigin(request: NextRequest): OriginVerdict {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const allowedOrigin =
    process.env.NEXT_PUBLIC_STOREFRONT_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    null;

  // Odczyt server-side (RSC, brak naglowkow) — nie ma czego porownywac.
  if (!origin && !referer) {
    return { allowed: true };
  }

  let candidate: string | null = origin;
  if (!candidate && referer) {
    try {
      candidate = new URL(referer).origin;
    } catch {
      return { allowed: false, reason: 'origin_unparsable', candidate: null, expected: allowedOrigin };
    }
  }

  if (!candidate) {
    return { allowed: false, reason: 'origin_unparsable', candidate: null, expected: allowedOrigin };
  }

  if (allowedOrigin && candidate !== allowedOrigin) {
    return { allowed: false, reason: 'origin_mismatch', candidate, expected: allowedOrigin };
  }

  if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    return { allowed: false, reason: 'origin_scheme_unsupported', candidate, expected: allowedOrigin };
  }

  return { allowed: true };
}

/** Zachowany kontrakt boolowski — te same werdykty, bez powodu. */
export function isAllowedOrigin(request: NextRequest): boolean {
  return checkOrigin(request).allowed;
}

/**
 * Komunikat dla operatora. `origin_mismatch` prawie zawsze znaczy, ze stack
 * biegnie pod innym adresem bazowym niz ten, z ktorego korzysta przegladarka —
 * typowo po restarcie bez `GP_STOREFRONT_BASE_HOST`.
 */
export function describeOriginRejection(verdict: OriginVerdict): string {
  if (verdict.allowed) return '';
  if (verdict.reason === 'origin_mismatch') {
    return (
      `[payment-status] odmowa origin: zadanie z ${verdict.candidate}, ` +
      `a NEXT_PUBLIC_STOREFRONT_URL/NEXT_PUBLIC_BASE_URL wskazuje ${verdict.expected}. ` +
      'To NIE jest odmowa dostepu do zamowienia — to rozjazd adresu bazowego stacka. ' +
      'Jesli korzystasz z LAN, wystartuj stack z GP_STOREFRONT_BASE_HOST=<adres LAN>.'
    );
  }
  return `[payment-status] odmowa origin: ${verdict.reason} (oczekiwano ${verdict.expected ?? 'brak konfiguracji'})`;
}
