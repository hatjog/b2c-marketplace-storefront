import { describe, expect, it } from 'vitest';

import {
  getShippingCoverage,
  missingShippingSellerNames
} from '../shippingCoverage';

const optA = { id: 'so_a', seller: { id: 'sel_a', name: 'KREM i DOTYK' } };
const optB = { id: 'so_b', seller: { id: 'sel_b', name: 'Studio Nova' } };

const itemA = { product: { seller: { id: 'sel_a', name: 'KREM i DOTYK' } } };
const itemB = { product: { seller: { id: 'sel_b', name: 'Studio Nova' } } };

describe('getShippingCoverage', () => {
  it('single-seller cart with its method selected → complete', () => {
    const cart = { items: [itemA], shipping_methods: [{ shipping_option_id: 'so_a' }] };
    const cov = getShippingCoverage(cart, [optA]);
    expect(cov.isComplete).toBe(true);
    expect(cov.missingSellers).toEqual([]);
  });

  it('single-seller cart with NO method → incomplete (lists the seller)', () => {
    const cart = { items: [itemA], shipping_methods: [] };
    const cov = getShippingCoverage(cart, [optA]);
    expect(cov.isComplete).toBe(false);
    expect(cov.missingSellers).toEqual([{ id: 'sel_a', name: 'KREM i DOTYK' }]);
    expect(missingShippingSellerNames(cov)).toEqual(['KREM i DOTYK']);
  });

  it('multi-seller cart with only ONE seller covered → incomplete (the user bug)', () => {
    const cart = {
      items: [itemA, itemB],
      shipping_methods: [{ shipping_option_id: 'so_a' }]
    };
    const cov = getShippingCoverage(cart, [optA, optB]);
    expect(cov.isComplete).toBe(false);
    expect(cov.missingSellers).toEqual([{ id: 'sel_b', name: 'Studio Nova' }]);
  });

  it('multi-seller cart with BOTH sellers covered → complete', () => {
    const cart = {
      items: [itemA, itemB],
      shipping_methods: [{ shipping_option_id: 'so_a' }, { shipping_option_id: 'so_b' }]
    };
    const cov = getShippingCoverage(cart, [optA, optB]);
    expect(cov.isComplete).toBe(true);
    expect(cov.missingSellers).toEqual([]);
  });

  it('no available options (nothing requires shipping) → complete', () => {
    const cart = { items: [itemA], shipping_methods: [] };
    expect(getShippingCoverage(cart, []).isComplete).toBe(true);
    expect(getShippingCoverage(cart, null).isComplete).toBe(true);
  });

  it('return options are ignored when computing required sellers', () => {
    const ret = { id: 'so_ret', seller: { id: 'sel_a' }, rules: [{ attribute: 'is_return', value: 'true' }] };
    const cart = { items: [itemA], shipping_methods: [] };
    // only a return option exists for sel_a → not a required (outbound) seller
    expect(getShippingCoverage(cart, [ret]).isComplete).toBe(true);
  });

  it('falls back to the cart sole seller when an option lacks seller attribution', () => {
    const optNoSeller = { id: 'so_x' };
    const cart = { items: [itemA], shipping_methods: [] };
    const cov = getShippingCoverage(cart, [optNoSeller]);
    expect(cov.isComplete).toBe(false);
    expect(cov.missingSellers[0].id).toBe('sel_a');
  });

  it('resolves seller via seller_id/seller_name fallback fields', () => {
    const optFlat = { id: 'so_a', seller_id: 'sel_a', seller_name: 'KREM i DOTYK' };
    const cart = { items: [itemA], shipping_methods: [{ shipping_option_id: 'so_a' }] };
    expect(getShippingCoverage(cart, [optFlat]).isComplete).toBe(true);
  });

  it('a selected method for an unknown option does not cover any seller', () => {
    const cart = {
      items: [itemA, itemB],
      shipping_methods: [{ shipping_option_id: 'so_unknown' }]
    };
    const cov = getShippingCoverage(cart, [optA, optB]);
    expect(cov.isComplete).toBe(false);
    expect(cov.missingSellers.map(s => s.id).sort()).toEqual(['sel_a', 'sel_b']);
  });
});
