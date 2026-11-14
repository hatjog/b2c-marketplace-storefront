import { describe, expect, it } from 'vitest';

import {
  decideVoucherAddToCart,
  isVoucherCartLine,
  VOUCHER_LINE_QUANTITY_REASON
} from '../voucher-line-quantity';

describe('Story 3.3 AC2 — krotność linii voucherowej w storefroncie', () => {
  it('rozpoznaje linię voucherową po markerze linii albo profilu produktu (kryterium backendu)', () => {
    expect(isVoucherCartLine({ entitlement_profile: { profile_id: 'p' } })).toBe(true);
    expect(isVoucherCartLine(null, { gp: { entitlement_profile: { profile_id: 'p' } } })).toBe(true);
    expect(isVoucherCartLine({ selected_seller_id: 's' }, { gp: { market_id: 'm' } })).toBe(false);
    expect(isVoucherCartLine(undefined, undefined)).toBe(false);
  });

  it('ponowne dodanie tego samego vouchera ⇒ nazwany wynik rejected (nie ciche zwiększenie do 2)', () => {
    expect(decideVoucherAddToCart({ isVoucher: true, currentQuantity: 1, requestedQuantity: 1 })).toEqual({
      status: 'rejected',
      reason: VOUCHER_LINE_QUANTITY_REASON
    });
    expect(VOUCHER_LINE_QUANTITY_REASON).toBe('voucher_line_quantity_unsupported');
  });

  it('pierwsze dodanie vouchera quantity=1 ⇒ added; produkt nie-voucherowy ⇒ bez limitu', () => {
    expect(decideVoucherAddToCart({ isVoucher: true, currentQuantity: 0, requestedQuantity: 1 })).toEqual({
      status: 'added'
    });
    expect(decideVoucherAddToCart({ isVoucher: false, currentQuantity: 3, requestedQuantity: 2 })).toEqual({
      status: 'added'
    });
  });
});
