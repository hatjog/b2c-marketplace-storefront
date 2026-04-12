import { describe, expect, it } from 'vitest';

import { convertToLocale } from '../money';

describe('convertToLocale', () => {
  it('formats Medusa minor-unit amounts as major currency values', () => {
    const formatted = convertToLocale({ amount: 18000, currency_code: 'PLN', locale: 'en-US' });

    expect(formatted).toContain('180.00');
    expect(formatted).not.toContain('18,000.00');
  });

  it('respects currencies with zero fraction digits', () => {
    const formatted = convertToLocale({ amount: 1500, currency_code: 'JPY', locale: 'en-US' });

    expect(formatted).toContain('1,500');
  });

  it('can format already-normalized major-unit amounts when requested', () => {
    const formatted = convertToLocale({
      amount: 180,
      currency_code: 'PLN',
      locale: 'en-US',
      isMinorUnit: false,
    });

    expect(formatted).toContain('180.00');
  });
});