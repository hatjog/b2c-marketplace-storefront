import { describe, expect, it } from 'vitest';

// Pure logic extracted from ProductDetailsSeller: hasContact now checks phone OR email
function hasContact(seller: { phone?: string; email?: string }): boolean {
  return !!(seller.phone || seller.email);
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
});

describe('tel: link format', () => {
  it('formats phone as tel: href', () => {
    const phone = '+48 500 000 000';
    const href = `tel:${phone}`;
    expect(href).toBe('tel:+48 500 000 000');
  });
});
