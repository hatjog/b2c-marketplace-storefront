/**
 * VoucherClaimRecoveryBoundary.test.tsx — Story 7.4 AC1-b (ADR-138 DEC-2).
 *
 * Kontrakt: HTTP 410 (wygasły magic-link voucher-claim) ⇒ render
 * `MagicLinkRecoveryState` (akcja „Wyślij nowy link"), NIE surowy błąd 410.
 * Świeży link (2xx ⇒ claimable) ⇒ normalny claim path (children).
 *
 * Styl: vitest jsx=automatic, env=node — komponent serwerowy (bez hooków) jest
 * wywoływalny bezpośrednio; inspekcja typu zwróconego elementu (bez DOM).
 */
import { describe, expect, it } from 'vitest';

import { VoucherClaimRecoveryBoundary } from '../VoucherClaimRecoveryBoundary/VoucherClaimRecoveryBoundary';
import { MagicLinkRecoveryState } from '../MagicLinkRecoveryState/MagicLinkRecoveryState';
import {
  classifyVoucherClaimLinkStatus,
  isRecoverableExpiry,
} from '@/lib/voucher-recovery/magic-link-claim-status';

describe('Story 7.4 — classifyVoucherClaimLinkStatus (410 ⇒ expired)', () => {
  it('HTTP 410 ⇒ expired (TTL magic-linka ⇒ recovery)', () => {
    expect(classifyVoucherClaimLinkStatus(410)).toBe('expired');
    expect(isRecoverableExpiry('expired')).toBe(true);
  });

  it('HTTP 200/303 ⇒ claimable (normalny claim path)', () => {
    expect(classifyVoucherClaimLinkStatus(200)).toBe('claimable');
    expect(classifyVoucherClaimLinkStatus(303)).toBe('claimable');
    expect(isRecoverableExpiry('claimable')).toBe(false);
  });

  it('HTTP 404/400 ⇒ invalid, 429/5xx ⇒ unavailable', () => {
    expect(classifyVoucherClaimLinkStatus(404)).toBe('invalid');
    expect(classifyVoucherClaimLinkStatus(400)).toBe('invalid');
    expect(classifyVoucherClaimLinkStatus(429)).toBe('unavailable');
    expect(classifyVoucherClaimLinkStatus(503)).toBe('unavailable');
  });
});

describe('Story 7.4 — VoucherClaimRecoveryBoundary (DEC-2 wiring)', () => {
  it('expired (410) ⇒ renderuje MagicLinkRecoveryState, NIE children/raw 410', () => {
    const element = VoucherClaimRecoveryBoundary({
      status: 'expired',
      locale: 'pl',
      children: 'RAW_410_PLACEHOLDER',
    }) as React.ReactElement;

    expect(element.type).toBe(MagicLinkRecoveryState);
    expect((element.props as { locale: string }).locale).toBe('pl');
  });

  it('claimable ⇒ przepuszcza children (normalny claim path), bez recovery', () => {
    const element = VoucherClaimRecoveryBoundary({
      status: 'claimable',
      locale: 'pl',
      children: 'NORMAL_CLAIM_PATH',
    }) as React.ReactElement;

    expect(element.type).not.toBe(MagicLinkRecoveryState);
    expect((element.props as { children: unknown }).children).toBe('NORMAL_CLAIM_PATH');
  });

  it('invalid/unavailable ⇒ NIE recovery (children), recovery tylko dla expiry', () => {
    for (const status of ['invalid', 'unavailable'] as const) {
      const element = VoucherClaimRecoveryBoundary({
        status,
        locale: 'en',
        children: 'CHILDREN',
      }) as React.ReactElement;
      expect(element.type).not.toBe(MagicLinkRecoveryState);
    }
  });
});
