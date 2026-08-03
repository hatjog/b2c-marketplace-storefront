import { describe, expect, it } from 'vitest';

// Mirrors hasContact logic from ProductDetailsSeller
function hasContact(seller: { phone?: string; email?: string }): boolean {
  return !!(seller.phone?.trim() || seller.email?.trim());
}

// Mirrors tel: href sanitization from ProductDetailsSeller
function formatTelHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, '')}`;
}

describe('ProductDetailsSeller contact visibility logic', () => {
  it('returns true when seller has phone', () => {
    expect(hasContact({ phone: '+48 500 000 000' })).toBe(true);
  });

  it('returns true when seller has email', () => {
    expect(hasContact({ email: 'salon@example.com' })).toBe(true);
  });

  it('returns true when seller has both phone and email', () => {
    expect(hasContact({ phone: '+48 500 000 000', email: 'salon@example.com' })).toBe(true);
  });

  it('returns false when seller has neither phone nor email', () => {
    expect(hasContact({})).toBe(false);
  });

  it('returns false when phone and email are empty strings', () => {
    expect(hasContact({ phone: '', email: '' })).toBe(false);
  });

  it('returns false when phone is whitespace only', () => {
    expect(hasContact({ phone: '   ' })).toBe(false);
  });

  it('returns false when email is whitespace only', () => {
    expect(hasContact({ email: '   ' })).toBe(false);
  });

  it('returns false when phone and email are whitespace only', () => {
    expect(hasContact({ phone: '  ', email: '\t' })).toBe(false);
  });

  it('returns true when only one contact value remains after trimming', () => {
    expect(hasContact({ phone: '   ', email: 'salon@example.com' })).toBe(true);
  });
});

describe('tel: link format', () => {
  it('strips spaces from phone number in href', () => {
    expect(formatTelHref('+48 500 000 000')).toBe('tel:+48500000000');
  });

  it('preserves phone without spaces', () => {
    expect(formatTelHref('+48500000000')).toBe('tel:+48500000000');
  });

  it('handles tabs and mixed whitespace', () => {
    expect(formatTelHref('+48\t500 000\t000')).toBe('tel:+48500000000');
  });
});
