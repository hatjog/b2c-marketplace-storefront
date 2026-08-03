import { describe, expect, it } from 'vitest';

import { normalizePurchaseMode } from './CheckoutPurchaseMode';

describe('normalizePurchaseMode', () => {
  it('returns gift for exact gift mode', () => {
    expect(normalizePurchaseMode('gift')).toBe('gift');
  });

  it('normalizes mixed-case gift mode', () => {
    expect(normalizePurchaseMode('Gift')).toBe('gift');
    expect(normalizePurchaseMode('GIFT')).toBe('gift');
  });

  it('normalizes surrounding whitespace for gift mode', () => {
    expect(normalizePurchaseMode(' gift ')).toBe('gift');
    expect(normalizePurchaseMode('\tgift\n')).toBe('gift');
  });

  it('falls back to self for empty or invalid values', () => {
    expect(normalizePurchaseMode('')).toBe('self');
    expect(normalizePurchaseMode('   ')).toBe('self');
    expect(normalizePurchaseMode('self')).toBe('self');
    expect(normalizePurchaseMode('foo')).toBe('self');
    expect(normalizePurchaseMode(null)).toBe('self');
    expect(normalizePurchaseMode(undefined)).toBe('self');
  });
});