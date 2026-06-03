/**
 * VoucherClaimRecoveryBoundary — Story 7.4 (v1.11.0, ADR-138 DEC-2).
 *
 * Cienka granica wiążąca ISTNIEJĄCY `MagicLinkRecoveryState` z kontraktem 410
 * magic-linka voucher-claim. Klasyfikuje status linku i renderuje właściwy UI:
 *
 *   - `expired` (410 + type=magic_link_expired, TTL) ⇒ `MagicLinkRecoveryState`
 *     z akcją „Wyślij nowy link" (recovery, odwracalne).
 *   - `terminal` (410 + type≠magic_link_expired, np. REFUNDED/VOIDED) ⇒ `children`
 *     z `data-terminal` flag; konsument (strona claim) renderuje właściwy stan końcowy.
 *   - `claimable` (2xx) ⇒ normalny claim path (`children`).
 *   - `invalid`/`unavailable` ⇒ `children` (konsument obsługuje błąd).
 *
 * To reuse + wiring (DEC-2), NIE nowy flow ani nowy komponent recovery.
 * Server component (bez hooków) — bezpośrednio wywoływalny w testach jednostkowych.
 *
 * WIRING NOTE (Story 7.4 / ADR-138 DEC-2): Ten komponent jest pre-wired —
 * zdefiniowany + pokryty testami jednostkowymi w tej story. Integracja z realną
 * stroną claim (`/[locale]/(main)/claim/`) i fetcherem `by-claim-token`/`claim`
 * domyka się w **ra-1 live-capture (Story 7.6)** — tam strona claim wołając
 * klasyfikator + boundary zastąpi inline ?status=expired obsługę.
 */
import type { ReactNode } from 'react';

import {
  isRecoverableExpiry,
  type VoucherClaimLinkStatus,
} from '@/lib/voucher-recovery/magic-link-claim-status';

import { MagicLinkRecoveryState } from '../MagicLinkRecoveryState/MagicLinkRecoveryState';

interface VoucherClaimRecoveryBoundaryProps {
  /** Status claim magic-linka (z `classifyVoucherClaimLinkStatus`). */
  status: VoucherClaimLinkStatus;
  /** Locale przekazywane do recovery UI. */
  locale: string;
  /** Normalny claim path / terminal state renderowany dla claimable/terminal/invalid/unavailable. */
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * Renderuje `MagicLinkRecoveryState` dla wygasłego magic-linka (expired ⇒ 410 TTL),
 * dodaje `data-terminal` dla stanów terminalnych vouchera, w przeciwnym razie
 * przepuszcza `children` (normalny claim path lub terminal UI).
 */
export function VoucherClaimRecoveryBoundary({
  status,
  locale,
  children,
  'data-testid': dataTestId = 'voucher-claim-expired-recovery',
}: VoucherClaimRecoveryBoundaryProps) {
  if (isRecoverableExpiry(status)) {
    return (
      <MagicLinkRecoveryState
        locale={locale}
        data-testid={dataTestId}
      />
    );
  }
  // Stan terminalny (REFUNDED/VOIDED/etc., 410 z innym type): przekazujemy children
  // z atrybutem data-terminal, żeby konsument mógł wyrenderować właściwy komunikat.
  if (status === 'terminal') {
    return <div data-terminal="true" data-testid={dataTestId}>{children}</div>;
  }
  return <>{children}</>;
}
