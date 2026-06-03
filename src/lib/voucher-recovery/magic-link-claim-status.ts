/**
 * magic-link-claim-status — Story 7.4 (v1.11.0, ADR-138 DEC-2).
 *
 * Czyste mapowanie statusu HTTP zwróconego przez backendowy claim magic-linka
 * voucher-claim (`/api/v1/entitlements/claim` + `/by-claim-token`) na decyzję UI.
 *
 * Sedno kontraktu DEC-2: **HTTP 410 (Gone) + type=magic_link_expired — wygasły
 * magic-link (TTL) — NIE jest renderowany jako surowy błąd, lecz jako stan
 * recovery** (`MagicLinkRecoveryState` z akcją „Wyślij nowy link"). Świeży link
 * (2xx) ⇒ normalny claim path.
 *
 * WAŻNE — semantyka 410: backend zwraca 410 w dwóch kontekstach:
 *   1. Wygasły magic-link (TTL) — body `{ type: "magic_link_expired" }` ⇒ recovery.
 *   2. Stan terminalny vouchera (REFUNDED/VOIDED/etc.) — body `{ type: <state> }` ⇒ terminal (nieodwracalne).
 * Klasyfikator rozróżnia oba przypadki via opcjonalne `bodyType`. Bez podania body
 * (np. HTTP-only catch) ostrożnie traktuje 410 jako terminal (nie recovery) — patrz
 * parametr `bodyType`.
 *
 * Rozdział scope: dotyczy magic-linka **voucher-claim**, NIE auth-login.
 */

export type VoucherClaimLinkStatus =
  /** Link świeży/ważny (2xx) — normalny claim path. */
  | 'claimable'
  /** Magic-link wygasł (HTTP 410, TTL, type=magic_link_expired) — renderuj recovery (NIE raw 410). */
  | 'expired'
  /** Stan terminalny vouchera (HTTP 410, type≠magic_link_expired, np. REFUNDED/VOIDED) — nieodwracalne. */
  | 'terminal'
  /** Token nieznany/nieprawidłowy (400/404). */
  | 'invalid'
  /** Backend niedostępny / rate-limit (429/5xx) — spróbuj ponownie później. */
  | 'unavailable'

/** Typ `type` z body odpowiedzi 410. Backend ustawia "magic_link_expired" dla TTL. */
const MAGIC_LINK_EXPIRED_TYPE = 'magic_link_expired'

/**
 * Mapuje surowy status HTTP + opcjonalny body type na {@link VoucherClaimLinkStatus}.
 *
 * @param httpStatus - kod HTTP z odpowiedzi backendu.
 * @param bodyType - wartość pola `type` z body JSON odpowiedzi (opcjonalna).
 *   Dla 410 wymagana do rozróżnienia wygasłego magic-linka (recovery) od
 *   terminalnego stanu vouchera (nieodwracalne). Gdy nieznana — 410 ⇒ `terminal`.
 */
export function classifyVoucherClaimLinkStatus(
  httpStatus: number,
  bodyType?: string | null
): VoucherClaimLinkStatus {
  if (httpStatus === 410) {
    // Rozróżnij TTL magic-linka (odwracalne, recovery) od stanu terminalnego
    // (nieodwracalne — REFUNDED/VOIDED/EXPIRED/CLOSED). Tylko jawny
    // type="magic_link_expired" daje recovery; inne 410 ⇒ terminal.
    return bodyType === MAGIC_LINK_EXPIRED_TYPE ? 'expired' : 'terminal'
  }
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
