/**
 * magic-link-claim-status — Story 7.4 (v1.11.0, ADR-138 DEC-2).
 *
 * Czyste mapowanie statusu HTTP zwróconego przez backendowy claim magic-linka
 * voucher-claim (`/api/v1/entitlements/claim` + `/by-claim-token`) na decyzję UI.
 *
 * Sedno kontraktu DEC-2: **HTTP 410 (Gone) — wygasły magic-link (TTL) — NIE
 * jest renderowany jako surowy błąd, lecz jako stan recovery** (`MagicLinkRecoveryState`
 * z akcją „Wyślij nowy link"). Świeży link (2xx) ⇒ normalny claim path.
 *
 * Rozdział scope: dotyczy magic-linka **voucher-claim**, NIE auth-login.
 */

export type VoucherClaimLinkStatus =
  /** Link świeży/ważny (2xx) — normalny claim path. */
  | 'claimable'
  /** Magic-link wygasł (HTTP 410, TTL) — renderuj recovery (NIE raw 410). */
  | 'expired'
  /** Token nieznany/nieprawidłowy (400/404). */
  | 'invalid'
  /** Backend niedostępny / rate-limit (429/5xx) — spróbuj ponownie później. */
  | 'unavailable'

/**
 * Mapuje surowy status HTTP na {@link VoucherClaimLinkStatus}.
 *
 * 410 ⇒ `expired` (kluczowe — TTL magic-linka ⇒ recovery, nie raw error).
 */
export function classifyVoucherClaimLinkStatus(httpStatus: number): VoucherClaimLinkStatus {
  if (httpStatus === 410) return 'expired'
  // 2xx oraz 3xx redirect (np. 303 → `/claim/<token>` dla flow HTML) = świeży
  // link, normalny claim path. 410 jest sprawdzone WYŻEJ (nie wpada tu).
  if (httpStatus >= 200 && httpStatus < 400) return 'claimable'
  if (httpStatus === 429 || httpStatus === 502 || httpStatus === 503) return 'unavailable'
  if (httpStatus === 400 || httpStatus === 404 || httpStatus === 403) return 'invalid'
  // Nieznane 5xx ⇒ traktuj jako tymczasową niedostępność (zachowawczo).
  if (httpStatus >= 500) return 'unavailable'
  return 'invalid'
}

/**
 * Czy dany status powinien wyrenderować stan recovery (`MagicLinkRecoveryState`).
 * Tylko wygaśnięcie magic-linka (TTL/410) jest „odzyskiwalne" przez „nowy link".
 */
export function isRecoverableExpiry(status: VoucherClaimLinkStatus): boolean {
  return status === 'expired'
}
