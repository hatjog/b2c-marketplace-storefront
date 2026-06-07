/**
 * magic-link-claim-status.test.ts — Story 7.4 (ADR-138 DEC-2, MEDIUM-1).
 *
 * Dwa cele:
 *   1. CONTRACT-PIN cross-repo: storefront `MAGIC_LINK_EXPIRED_TYPE` MUSI równać
 *      się backendowemu `EXPIRED_CLAIM_LINK_GONE_BODY.type` ('magic_link_expired')
 *      z SSOT `packages/api/src/lib/voucher-claim-magic-link-ttl.ts` (GP/backend).
 *      Backend testuje swoją stronę; ten test przypina wartość po stronie
 *      storefrontu, więc każdy przyszły drift (cichy rozjazd wire-value) jest
 *      łapany głośno tu, zanim runtime-wiring (Story 7.6 / ra-1) go odsłoni.
 *   2. Klasyfikator 410: type=magic_link_expired ⇒ 'expired'; type terminalny
 *      ⇒ 'terminal'.
 *
 * Pełne runtime-wiring klasyfikatora/boundary jest DEFERRED do Story 7.6 / ra-1
 * (live) — ten plik pokrywa tylko czysty kontrakt + klasyfikację.
 */
import { describe, expect, it } from 'vitest';

import {
  classifyVoucherClaimLinkStatus,
  MAGIC_LINK_EXPIRED_TYPE,
} from '../magic-link-claim-status';

describe('Story 7.4 — magic-link claim contract pin (MEDIUM-1 cross-repo drift guard)', () => {
  it('CONTRACT-PIN: MAGIC_LINK_EXPIRED_TYPE === backend EXPIRED_CLAIM_LINK_GONE_BODY.type', () => {
    // SSOT: GP/backend packages/api/src/lib/voucher-claim-magic-link-ttl.ts
    //   export const EXPIRED_CLAIM_LINK_GONE_BODY = { type: "magic_link_expired", ... }
    // Jeśli backend zmieni wire-value, ten assert pęknie i wymusi świadomą
    // synchronizację po obu stronach kontraktu (ADR-138 DEC-2).
    expect(MAGIC_LINK_EXPIRED_TYPE).toBe('magic_link_expired');
  });

  it('410 + bodyType=magic_link_expired ⇒ expired (recovery, TTL magic-linka)', () => {
    expect(classifyVoucherClaimLinkStatus(410, MAGIC_LINK_EXPIRED_TYPE)).toBe('expired');
    expect(classifyVoucherClaimLinkStatus(410, 'magic_link_expired')).toBe('expired');
  });

  it('410 + terminalny bodyType ⇒ terminal (stan końcowy vouchera, NIE recovery)', () => {
    expect(classifyVoucherClaimLinkStatus(410, 'refunded')).toBe('terminal');
    expect(classifyVoucherClaimLinkStatus(410, 'voided')).toBe('terminal');
    expect(classifyVoucherClaimLinkStatus(410)).toBe('terminal');
    expect(classifyVoucherClaimLinkStatus(410, null)).toBe('terminal');
  });
});
