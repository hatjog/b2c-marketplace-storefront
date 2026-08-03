import { describe, expect, it } from 'vitest';

import { convertToLocale } from '../money';

// " zł" with a non-breaking space — built from escapes so the assertions do not depend
// on the editor's encoding of the suffix.
const ZL = `${String.fromCharCode(0xa0)}z${String.fromCharCode(0x142)}`;

describe('convertToLocale', () => {
  it('formats whole PLN amounts as "kwota zł" with no decimal zeros (Robert UX directive)', () => {
    const formatted = convertToLocale({ amount: 18000, currency_code: 'PLN', locale: 'en-US' });

    // 18000 minor units → 180.00 → whole → "180 zł" (not "PLN 180.00", not "180.00 zł").
    expect(formatted).toBe(`180${ZL}`);
    expect(formatted).not.toContain('PLN');
    expect(formatted).not.toContain('.00');
  });

  it('keeps 2 decimals for fractional PLN amounts', () => {
    expect(convertToLocale({ amount: 26050, currency_code: 'PLN', locale: 'en-US' })).toBe(`260.50${ZL}`);
    // Polish locale uses a comma decimal separator (thousands grouping is ICU-data
    // dependent in the test runtime, so assert only the decimal + suffix).
    expect(convertToLocale({ amount: 126050, currency_code: 'PLN', locale: 'pl-PL' })).toMatch(
      new RegExp(`^1\\s?260,50${ZL}$`)
    );
  });

  it('uses the "zł" suffix regardless of the viewing locale (currency is PLN, not the UI lang)', () => {
    expect(convertToLocale({ amount: 26000, currency_code: 'pln', locale: 'de-DE' })).toContain(ZL);
    expect(convertToLocale({ amount: 26000, currency_code: 'PLN', locale: 'en-US' })).toBe(`260${ZL}`);
  });

  it('formats Medusa minor-unit amounts without spurious thousands grouping of the minor value', () => {
    const formatted = convertToLocale({ amount: 18000, currency_code: 'PLN', locale: 'en-US' });

    expect(formatted).toBe(`180${ZL}`);
    expect(formatted).not.toContain('18,000');
  });

  it('leaves non-PLN currencies in their Intl currency format', () => {
    expect(convertToLocale({ amount: 1500, currency_code: 'JPY', locale: 'en-US' })).toContain('1,500');
    expect(convertToLocale({ amount: 26000, currency_code: 'EUR', locale: 'en-US' })).toContain('€260.00');
  });

  it('can format already-normalized major-unit PLN amounts when requested', () => {
    const formatted = convertToLocale({
      amount: 180,
      currency_code: 'PLN',
      locale: 'en-US',
      isMinorUnit: false,
    });

    expect(formatted).toBe(`180${ZL}`);
  });

  it('coerces non-finite amounts to 0 (never renders "NaN" — e.g. shipping option without price)', () => {
    for (const amount of [undefined, null, NaN] as unknown as number[]) {
      const formatted = convertToLocale({ amount, currency_code: 'PLN', locale: 'en-US' });
      expect(formatted).not.toMatch(/NaN/);
      expect(formatted).toBe(`0${ZL}`);
    }
  });
});
