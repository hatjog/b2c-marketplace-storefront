import { describe, it, expect, vi } from 'vitest';

import {
  type CartSettlementContext,
  type RevalidateDeps,
  type SellerStatus,
  revalidateSettlement,
} from '../settlement-revalidation';

const baseCtx = (overrides: Partial<CartSettlementContext> = {}): CartSettlementContext => ({
  cartId: 'cart_1',
  marketId: 'bonbeauty',
  sellerId: 'salon-1',
  customerSessionId: 'sess_xyz',
  vendorArchiveFallbackEnabled: false,
  fallbackVendorId: null,
  ...overrides,
});

const buildDeps = (status: SellerStatus): RevalidateDeps & {
  events: Array<{ event: string; props: Record<string, unknown> }>;
  audits: Array<Parameters<RevalidateDeps['writeAffectedOrders']>[0]>;
} => {
  const events: Array<{ event: string; props: Record<string, unknown> }> = [];
  const audits: Array<Parameters<RevalidateDeps['writeAffectedOrders']>[0]> = [];
  return {
    readSellerStatus: vi.fn(async () => status),
    emit: (event, props) => events.push({ event, props }),
    writeAffectedOrders: vi.fn(async (input) => {
      audits.push(input);
    }),
    now: () => new Date('2026-04-29T12:00:00Z'),
    events,
    audits,
  };
};

describe('revalidateSettlement (D-69 4-step)', () => {
  it('Step 1+2 active: settlement proceeds with original seller', async () => {
    const deps = buildDeps('active');
    const out = await revalidateSettlement(baseCtx(), deps);
    expect(out).toEqual({ ok: true, resolvedSellerId: 'salon-1', usedFallback: false });
    expect(deps.events).toHaveLength(0);
    expect(deps.audits).toHaveLength(0);
  });

  it('Step 2 paused: aborts with Polish copy + emits aborted_by_seller_status + writes audit', async () => {
    const deps = buildDeps('paused');
    const out = await revalidateSettlement(baseCtx(), deps);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected abort');
    expect(out.code).toBe('SELLER_UNAVAILABLE');
    expect(out.sellerStatus).toBe('paused');
    expect(out.message).toBe(
      'Sprzedawca tymczasowo niedostępny — wybierz alternatywnego sprzedawcę'
    );
    expect(deps.events).toEqual([
      {
        event: 'cart.settlement.aborted_by_seller_status',
        props: expect.objectContaining({
          schema: 'cart.settlement.aborted_by_seller_status.v1',
          market_id: 'bonbeauty',
          cart_id: 'cart_1',
          seller_id: 'salon-1',
          current_status: 'paused',
        }),
      },
    ]);
    expect(deps.audits).toHaveLength(1);
    expect(deps.audits[0]).toMatchObject({
      sellerId: 'salon-1',
      cartId: 'cart_1',
      observedStatus: 'paused',
    });
  });

  it('Step 2 pending: aborts (DISABLED-effective per ADR-074)', async () => {
    const deps = buildDeps('pending');
    const out = await revalidateSettlement(baseCtx(), deps);
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected abort');
    expect(out.sellerStatus).toBe('pending');
  });

  it('Step 3 disabled WITH archive fallback enabled: routes to fallback_vendor_id', async () => {
    const deps = buildDeps('disabled');
    const out = await revalidateSettlement(
      baseCtx({ vendorArchiveFallbackEnabled: true, fallbackVendorId: 'salon-fallback' }),
      deps
    );
    expect(out).toEqual({
      ok: true,
      resolvedSellerId: 'salon-fallback',
      usedFallback: true,
    });
    expect(deps.events.map((e) => e.event)).toEqual([
      'cart.settlement.fallback_to_archive_vendor',
    ]);
    expect(deps.audits).toHaveLength(1);
  });

  it('Step 3 disabled WITHOUT archive fallback: aborts (no fallback applied)', async () => {
    const deps = buildDeps('disabled');
    const out = await revalidateSettlement(
      baseCtx({ vendorArchiveFallbackEnabled: false }),
      deps
    );
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected abort');
    expect(out.sellerStatus).toBe('disabled');
    expect(deps.events.map((e) => e.event)).toEqual(['cart.settlement.aborted_by_seller_status']);
  });

  it('Step 3 disabled WITH flag but missing fallbackVendorId: still aborts (defensive)', async () => {
    const deps = buildDeps('disabled');
    const out = await revalidateSettlement(
      baseCtx({ vendorArchiveFallbackEnabled: true, fallbackVendorId: null }),
      deps
    );
    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('expected abort');
    expect(out.sellerStatus).toBe('disabled');
  });

  it('Step 4: writeAffectedOrders is called with the observed status (audit linkage)', async () => {
    const deps = buildDeps('paused');
    await revalidateSettlement(baseCtx({ cartId: 'cart_42' }), deps);
    expect(deps.audits[0]).toMatchObject({
      cartId: 'cart_42',
      observedStatus: 'paused',
    });
  });
});
