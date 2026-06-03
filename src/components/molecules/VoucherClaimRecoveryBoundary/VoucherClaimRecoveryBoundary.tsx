/**
 * VoucherClaimRecoveryBoundary — Story 7.4 (v1.11.0, ADR-138 DEC-2).
 *
 * Cienka granica wiążąca ISTNIEJĄCY `MagicLinkRecoveryState` z kontraktem 410
 * magic-linka voucher-claim: gdy backend zwróci HTTP 410 (wygasły link, TTL),
 * renderuje stan recovery („Wyślij nowy link") ZAMIAST surowego błędu 410.
 * Świeży link (claimable) ⇒ normalny claim path (children).
 *
 * To reuse + wiring (DEC-2), NIE nowy flow ani nowy komponent recovery.
 * Server component (bez hooków) — bezpośrednio wywoływalny w testach jednostkowych.
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
  /** Normalny claim path renderowany dla świeżego linku. */
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * Renderuje `MagicLinkRecoveryState` dla wygasłego magic-linka (410 ⇒ expired),
 * w przeciwnym razie przepuszcza `children` (normalny claim path).
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
  return <>{children}</>;
}
