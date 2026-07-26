import { describe, expect, it } from 'vitest';

import {
  CSP_DIRECTIVE_LIST,
  CSP_DIRECTIVES,
  buildCspDirectiveList,
  buildCspDirectiveListWithNonce,
  resolveCspHeaderName,
} from '@/lib/security/csp';

/**
 * D-64 (architecture.md:328) — CSP header policy + env-var toggle tests.
 *
 * Covers AC #1 (directive inventory), AC #2 (env-var resolver + fail-fast),
 * AC #7 (header name + directive list per mode).
 *
 * Header is wired into Next.js via `next.config.ts` `headers()`; that
 * config consumes the same `CSP_DIRECTIVES` + `resolveCspHeaderName`
 * exports tested here, so this unit test guarantees the values that
 * Next.js will actually emit at runtime.
 *
 * v1.9.0 wf5 update (closes CC-1 F-CC1-005): the directive list dropped
 * `https://api.mercurjs.com` (Mercur upstream marketing API — not the
 * GP backend origin). connect-src now picks up the GP backend origin
 * via `NEXT_PUBLIC_MEDUSA_BACKEND_URL` (or `MEDUSA_BACKEND_URL`) at
 * build/runtime, so checkout in production talks to the real backend
 * without CSP blocking the requests.
 */

const EXPECTED_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' https://js.stripe.com https://cdn.talkjs.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' fonts.gstatic.com https://cdn.talkjs.com",
  "img-src 'self' https: blob: data:",
  "media-src 'self' https://cdn.talkjs.com",
  "connect-src 'self' https://*.sentry.io https://*.posthog.com https://api.stripe.com https://r.stripe.com https://m.stripe.com https://q.stripe.com https://*.maptiler.com https://api.talkjs.com wss://*.talkjs.com",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.talkjs.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
];

describe('CSP directive list (D-64 AC #1)', () => {
  it('contains the exact D-64 directives plus Stripe checkout origins (no backend env)', () => {
    // With no MEDUSA_BACKEND_URL env, the directive list is the static baseline.
    expect(buildCspDirectiveList([])).toEqual(EXPECTED_DIRECTIVES);
  });

  it('allows the TalkJS chat widget origins (v1.11.0 Gate A ra-1 live-render fix)', () => {
    const list = buildCspDirectiveList([]);
    const dir = (name: string) => list.find((d) => d.startsWith(name + ' '));
    expect(dir('script-src')).toContain('https://cdn.talkjs.com');
    expect(dir('connect-src')).toContain('https://api.talkjs.com');
    expect(dir('connect-src')).toContain('wss://*.talkjs.com');
    expect(dir('frame-src')).toContain('https://*.talkjs.com');
    expect(dir('media-src')).toContain('https://cdn.talkjs.com'); // TalkJS notification sounds
    // the per-request nonce variant (what prod emits) must also allow the TalkJS script
    const nonceScript = buildCspDirectiveListWithNonce('abc123', []).find((d) => d.startsWith('script-src '));
    expect(nonceScript).toContain("'nonce-abc123'");
    expect(nonceScript).toContain('https://cdn.talkjs.com');
  });

  it('keeps cdn.talkjs.com ADDITIVE to the nonce — no unsafe-inline, nonce preserved (Story 7.2 AC2 anti-pattern guard)', () => {
    // KRYTYCZNE (Story 7.2): `cdn.talkjs.com` musi być allowlistowany OBOK
    // `'nonce-...'`, addytywnie. NIE wolno osłabiać nonce-mechanizmu (fix
    // 5465e50d7): brak `'unsafe-inline'` (osłabiłoby nonce ⇒ utrata XSS-ochrony)
    // i brak usunięcia nonce (zepsułoby App Router inline hydration ⇒ regresja
    // blank page). Nonce chroni inline hydration scripts, host-allowlist
    // przepuszcza zewnętrzny skrypt TalkJS — oba w jednej dyrektywie.
    const nonceScript = buildCspDirectiveListWithNonce('xyz789', []).find((d) =>
      d.startsWith('script-src ')
    );
    expect(nonceScript).toBeDefined();
    // addytywność: nonce ORAZ host TalkJS obecne jednocześnie
    expect(nonceScript).toContain("'nonce-xyz789'");
    expect(nonceScript).toContain('https://cdn.talkjs.com');
    // self nadal pokrywa zewnętrzne chunki Next; nonce NIE usunięty
    expect(nonceScript).toContain("'self'");
    // brak osłabienia: ZERO 'unsafe-inline' w script-src z nonce
    expect(nonceScript).not.toContain("'unsafe-inline'");
    expect(nonceScript?.split(/\s+/)).not.toContain('*');
  });

  it('appends GP backend origin to connect-src when provided', () => {
    const list = buildCspDirectiveList(['https://api.bonbeauty.example']);
    const connectSrc = list.find((d) => d.startsWith('connect-src'));
    expect(connectSrc).toContain('https://api.bonbeauty.example');
    expect(connectSrc).not.toContain('https://api.mercurjs.com');
  });

  it('joins directives with "; " separator for header value', () => {
    expect(CSP_DIRECTIVES).toBe(CSP_DIRECTIVE_LIST.join('; '));
  });

  it('includes Tailwind unsafe-inline for styles only (NOT scripts)', () => {
    expect(CSP_DIRECTIVES).toContain("style-src 'self' 'unsafe-inline'");
    expect(CSP_DIRECTIVES).toContain("script-src 'self' https://js.stripe.com");
    // No 'unsafe-inline' in script-src directive.
    const scriptSrc = CSP_DIRECTIVE_LIST.find(d => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self' https://js.stripe.com https://cdn.talkjs.com");
    expect(scriptSrc).not.toContain('unsafe-inline');
  });

  it('includes anti-clickjacking frame-ancestors none', () => {
    expect(CSP_DIRECTIVES).toContain("frame-ancestors 'none'");
  });

  it('whitelists Sentry, PostHog, and Stripe in connect-src (api.mercurjs.com REMOVED per F-CC1-005)', () => {
    const connectSrc = CSP_DIRECTIVE_LIST.find(d => d.startsWith('connect-src'));
    expect(connectSrc).toContain('https://*.sentry.io');
    expect(connectSrc).toContain('https://*.posthog.com');
    expect(connectSrc).toContain('https://api.stripe.com');
    // v1.9.0 wf5 (F-CC1-005): Mercur upstream marketing API was the WRONG
    // backend origin — production storefront talks to GP-owned host, not
    // api.mercurjs.com. The new default omits it.
    expect(connectSrc).not.toContain('https://api.mercurjs.com');
  });

  it('allows MapTiler tile loading without broad connect-src wildcards (D-104, Story 4.4)', () => {
    const connectSrc = CSP_DIRECTIVE_LIST.find(d => d.startsWith('connect-src'));

    expect(connectSrc).toContain('https://*.maptiler.com');
    // Reject standalone `*` token (wildcard) i `'unsafe-inline'` regression
    // — `.split(/\s+/)` operuje na directive-level tokenach po nazwie
    // directive (HG-5 zero `connect-src *`).
    expect(connectSrc?.split(/\s+/)).not.toContain('*');
    expect(connectSrc?.split(/\s+/)).not.toContain("'unsafe-inline'");
  });

  it('orders MapTiler before backend origin in connect-src (Story 4.4 T2 spec)', () => {
    // Per Story 4.4 T2: MapTiler MUSI byc "po q.stripe.com, przed
    // `${backendConnectFragments}`" — guard przeciwko regresji, w ktorej
    // future edit wstawia backend origin miedzy Stripe a MapTiler.
    const list = buildCspDirectiveList(['https://api.bonbeauty.example']);
    const connectSrc = list.find((d) => d.startsWith('connect-src'));
    expect(connectSrc).toBeDefined();
    const stripeIdx = connectSrc!.indexOf('https://q.stripe.com');
    const maptilerIdx = connectSrc!.indexOf('https://*.maptiler.com');
    const backendIdx = connectSrc!.indexOf('https://api.bonbeauty.example');
    expect(stripeIdx).toBeGreaterThan(-1);
    expect(maptilerIdx).toBeGreaterThan(stripeIdx);
    expect(backendIdx).toBeGreaterThan(maptilerIdx);
  });

  it('allows Stripe Elements scripts, frames, and telemetry endpoints', () => {
    const scriptSrc = CSP_DIRECTIVE_LIST.find(d => d.startsWith('script-src'));
    const frameSrc = CSP_DIRECTIVE_LIST.find(d => d.startsWith('frame-src'));
    const connectSrc = CSP_DIRECTIVE_LIST.find(d => d.startsWith('connect-src'));

    expect(scriptSrc).toContain('https://js.stripe.com');
    expect(frameSrc).toContain('https://js.stripe.com');
    expect(frameSrc).toContain('https://hooks.stripe.com');
    expect(connectSrc).toContain('https://api.stripe.com');
    expect(connectSrc).toContain('https://r.stripe.com');
    expect(connectSrc).toContain('https://m.stripe.com');
  });
});

describe('resolveCspHeaderName — STOREFRONT_CSP_MODE toggle (D-64 AC #2, R3-AI-07)', () => {
  it('returns Content-Security-Policy when mode = enforce', () => {
    expect(resolveCspHeaderName('enforce')).toBe('Content-Security-Policy');
  });

  it('returns Content-Security-Policy-Report-Only when mode = report-only', () => {
    expect(resolveCspHeaderName('report-only')).toBe('Content-Security-Policy-Report-Only');
  });

  it('defaults to enforce when env var unset (production default per AC #3)', () => {
    expect(resolveCspHeaderName(undefined)).toBe('Content-Security-Policy');
  });

  it('throws fail-fast on invalid value (NIE silently default)', () => {
    expect(() => resolveCspHeaderName('disabled')).toThrow(
      /STOREFRONT_CSP_MODE must be 'enforce' or 'report-only', got: disabled/
    );
    expect(() => resolveCspHeaderName('off')).toThrow(/got: off/);
    expect(() => resolveCspHeaderName('')).toThrow(/got: $/);
  });
});

describe('CSP header value parity between modes (D-64 AC #7)', () => {
  it('directive list is identical between enforce and report-only modes', () => {
    // Only the header NAME flips; the directive list is the single source
    // of truth used by both modes (NIE diverging policies).
    const enforceName = resolveCspHeaderName('enforce');
    const reportOnlyName = resolveCspHeaderName('report-only');

    expect(enforceName).not.toBe(reportOnlyName);
    // Both modes emit `CSP_DIRECTIVES` as the header value. The directive
    // list is built once from the running env; the joined value MUST match
    // the source list. v1.9.0 wf5: assert structural parity, not byte-equal
    // to a fixed string (env-dependent backend origin is appended at module
    // load time).
    expect(CSP_DIRECTIVES).toBe(CSP_DIRECTIVE_LIST.join('; '));
  });
});

describe("dev-only 'unsafe-eval' gating (v1.14.0 dev-hydration fix)", () => {
  // `next dev` bundles client code through eval/new Function; under the
  // enforce-mode policy the browser throws EvalError, React never hydrates
  // and PDP buttons are dead SSR markup. Dev (and ONLY dev) therefore gets
  // 'unsafe-eval' in script-src, per Next.js's own CSP guidance.

  it("isDev=true adds 'unsafe-eval' to script-src in BOTH builder variants", () => {
    const staticScript = buildCspDirectiveList([], true).find((d) => d.startsWith('script-src '));
    expect(staticScript).toContain("'unsafe-eval'");
    expect(staticScript).toContain("'self'");

    // The nonce variant is what src/middleware.ts actually emits in dev —
    // it MUST carry the dev fragment too, additively to the nonce.
    const nonceScript = buildCspDirectiveListWithNonce('devnonce', [], true).find((d) =>
      d.startsWith('script-src ')
    );
    expect(nonceScript).toContain("'unsafe-eval'");
    expect(nonceScript).toContain("'nonce-devnonce'");
    // No weakening beyond eval: nonce mechanism intact, zero 'unsafe-inline'.
    expect(nonceScript).not.toContain("'unsafe-inline'");
    expect(nonceScript?.split(/\s+/)).not.toContain('*');
  });

  it("isDev=true only touches script-src — every other directive stays identical", () => {
    const dev = buildCspDirectiveList([], true);
    const prod = buildCspDirectiveList([], false);
    expect(dev.filter((d) => !d.startsWith('script-src '))).toEqual(
      prod.filter((d) => !d.startsWith('script-src '))
    );
  });

  it("isDev=false produces the exact production baseline (zero 'unsafe-eval')", () => {
    expect(buildCspDirectiveList([], false)).toEqual(EXPECTED_DIRECTIVES);
    const nonceScript = buildCspDirectiveListWithNonce('abc', [], false).find((d) =>
      d.startsWith('script-src ')
    );
    expect(nonceScript).toBe("script-src 'self' 'nonce-abc' https://js.stripe.com https://cdn.talkjs.com");
  });

  it("default gating under NODE_ENV=test leaves 'unsafe-eval' out (fail-closed to prod policy)", () => {
    // Vitest runs with NODE_ENV=test → the NODE_ENV === 'development'
    // default must resolve false, so the policy equals prod baseline.
    const scriptSrc = buildCspDirectiveList([]).find((d) => d.startsWith('script-src '));
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    const nonceScript = buildCspDirectiveListWithNonce('xyz', []).find((d) =>
      d.startsWith('script-src ')
    );
    expect(nonceScript).not.toContain("'unsafe-eval'");
  });
});
