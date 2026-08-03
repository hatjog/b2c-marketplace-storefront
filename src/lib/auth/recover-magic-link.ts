/**
 * Magic-link recovery helpers — Story 5.3 (W3-05/W3-06) re-implementation.
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review CRITICAL P0):
 *   - Wraps the backend POST /store/auth/magic-link (request) and POST
 *     /store/auth/magic-link/verify (verify) endpoints authored as part of
 *     Story 5.3 backend deliverables (GP/backend/packages/api/src/api/store/auth/magic-link/).
 *   - Anti-enumeration: request never leaks "this email is/isn't registered".
 *   - Token never appears in console logs.
 *
 * Server-only — never import from a "use client" component.
 */

import { resolveMedusaBackendUrl } from '@/lib/env';

const PUBLISHABLE_KEY_HEADER = 'x-publishable-api-key';

/**
 * The set of verification reasons the backend may return when a magic-link
 * verify call resolves to `valid: false`. We never expose specific reasons
 * to the client — but we map them to a single neutral state for the UI.
 */
export type MagicLinkVerificationReason =
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'consumed'
  | 'wrong_purpose'
  | 'wrong_market';

export type RecoverMagicLinkRequestResult = { ok: true } | { ok: false; code: 'INVALID_INPUT' | 'NETWORK_ERROR' };

export type RecoverMagicLinkVerifyResult =
  | { valid: true; authToken: string }
  | { valid: false; reason: MagicLinkVerificationReason };

function backendHeaders(): HeadersInit {
  const publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (publishableKey) {
    headers[PUBLISHABLE_KEY_HEADER] = publishableKey;
  }
  return headers;
}

/**
 * Trigger an email containing a magic-link recovery URL.
 *
 * The backend route is `POST /store/auth/magic-link` with body
 * `{ purpose: "recover", email, locale }`.
 *
 * Anti-enumeration: the backend ALWAYS responds 202 success when input is
 * valid, regardless of whether the email matches a registered customer.
 * We surface only INVALID_INPUT (client-side validation should prevent
 * this) and NETWORK_ERROR (rare backend / network failure).
 */
export async function requestRecoverMagicLink({
  email,
  locale
}: {
  email: string;
  locale: string;
}): Promise<RecoverMagicLinkRequestResult> {
  if (!email || !email.includes('@')) {
    return { ok: false, code: 'INVALID_INPUT' };
  }

  try {
    const response = await fetch(`${resolveMedusaBackendUrl()}/store/auth/magic-link`, {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({
        purpose: 'recover',
        email: email.trim().toLowerCase(),
        locale
      })
    });

    // 202 Accepted = success (or enumeration-neutral no-op).
    // 400 = INVALID input. Any other status treated as network error.
    if (response.status === 202) return { ok: true };
    if (response.status === 400) return { ok: false, code: 'INVALID_INPUT' };
    return { ok: false, code: 'NETWORK_ERROR' };
  } catch {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
}

/**
 * Verify a magic-link token. Mirrors Story 2.14 `verifyMagicLink()` contract.
 *
 * On success the backend returns `{ valid: true, auth_token }`. We pass
 * the auth token through to the caller (server action) which is
 * responsible for setting the storefront's auth cookie via
 * `setAuthToken`. Failure is always a single neutral state — UI never
 * differentiates between expired / consumed / revoked.
 */
export async function verifyRecoverMagicLink({
  token
}: {
  token: string;
}): Promise<RecoverMagicLinkVerifyResult> {
  if (!token) {
    return { valid: false, reason: 'invalid' };
  }

  try {
    const response = await fetch(
      `${resolveMedusaBackendUrl()}/store/auth/magic-link/verify`,
      {
        method: 'POST',
        headers: backendHeaders(),
        body: JSON.stringify({ token })
      }
    );

    if (response.status !== 200) {
      return { valid: false, reason: 'invalid' };
    }

    const body = (await response.json().catch(() => null)) as
      | { valid: true; auth_token?: string }
      | { valid: false; reason?: MagicLinkVerificationReason }
      | null;

    if (!body) return { valid: false, reason: 'invalid' };

    if (body.valid === true && typeof body.auth_token === 'string' && body.auth_token.length > 0) {
      return { valid: true, authToken: body.auth_token };
    }

    const reason: MagicLinkVerificationReason =
      (body as { reason?: MagicLinkVerificationReason }).reason ?? 'invalid';
    return { valid: false, reason };
  } catch {
    return { valid: false, reason: 'invalid' };
  }
}
