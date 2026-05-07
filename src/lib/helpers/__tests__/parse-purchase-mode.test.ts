/**
 * Tests for TF-74: parsePurchaseMode — case-insensitive + whitelist + injection guard.
 * Story: v160-cleanup-32-mv-pdp-residuals AC5
 *
 * AC5 requires:
 *  - ?mode=GIFT, gift, Gift, gIfT all → SelfPurchaseMode.GIFT
 *  - ?mode=SELF (any case) → SelfPurchaseMode.SELF
 *  - invalid input → fallback SelfPurchaseMode.SELF + console.warn
 *  - injection guard: control chars sanitized, non-string rejected
 *  - unit tests: 4 case-mixed valid + 3 invalid (xss/empty/non-string) + 1 missing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parsePurchaseMode, SelfPurchaseMode } from '../parse-purchase-mode';

describe('parsePurchaseMode (TF-74)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ---- Valid case-mixed GIFT inputs (4 variants) ----
  it('parses "GIFT" (uppercase) → SelfPurchaseMode.GIFT', () => {
    expect(parsePurchaseMode('GIFT')).toBe(SelfPurchaseMode.GIFT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses "gift" (lowercase) → SelfPurchaseMode.GIFT', () => {
    expect(parsePurchaseMode('gift')).toBe(SelfPurchaseMode.GIFT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses "Gift" (mixed) → SelfPurchaseMode.GIFT', () => {
    expect(parsePurchaseMode('Gift')).toBe(SelfPurchaseMode.GIFT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses "gIfT" (all-mixed) → SelfPurchaseMode.GIFT', () => {
    expect(parsePurchaseMode('gIfT')).toBe(SelfPurchaseMode.GIFT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ---- Valid SELF inputs ----
  it('parses "SELF" (uppercase) → SelfPurchaseMode.SELF', () => {
    expect(parsePurchaseMode('SELF')).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses "self" (lowercase) → SelfPurchaseMode.SELF', () => {
    expect(parsePurchaseMode('self')).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses "Self" (mixed) → SelfPurchaseMode.SELF', () => {
    expect(parsePurchaseMode('Self')).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ---- Invalid inputs → fallback SELF + warn ----
  it('parses XSS input → fallback SELF + warn', () => {
    expect(parsePurchaseMode('<script>alert(1)</script>')).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[self-purchase]')
    );
  });

  it('parses empty string → fallback SELF (no warn for empty)', () => {
    // Empty string — no warn expected (length === 0)
    expect(parsePurchaseMode('')).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses non-string (number) → fallback SELF + warn', () => {
    expect(parsePurchaseMode(42)).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('non-string type')
    );
  });

  // ---- Missing (null/undefined) ----
  it('parses null → fallback SELF (no warn)', () => {
    expect(parsePurchaseMode(null)).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('parses undefined → fallback SELF (no warn)', () => {
    expect(parsePurchaseMode(undefined)).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ---- Injection guard ----
  it('sanitizes control characters (null byte injection)', () => {
    // \x00GIFT\x00 → sanitized to "GIFT" → SelfPurchaseMode.GIFT
    expect(parsePurchaseMode('\x00GIFT\x00')).toBe(SelfPurchaseMode.GIFT);
  });

  it('sanitizes control characters (CR/LF injection)', () => {
    // "gi\nft" → sanitized to "gift" → GIFT
    expect(parsePurchaseMode('gi\nft')).toBe(SelfPurchaseMode.GIFT);
  });

  it('sanitizes non-string object → fallback SELF + warn', () => {
    expect(parsePurchaseMode({})).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('non-string type')
    );
  });

  it('handles very long string (injection length guard) — truncated to 32 chars', () => {
    // 'gift' repeated many times → first 32 chars is 'giftgiftgiftgiftgiftgiftgiftgift'
    // 'GIFTGIFTGIFTGIFTGIFTGIFTGIFTGIFT' → not in whitelist → fallback SELF
    const longGift = 'gift'.repeat(100);
    expect(parsePurchaseMode(longGift)).toBe(SelfPurchaseMode.SELF);
    expect(warnSpy).toHaveBeenCalled(); // truncated doesn't match whitelist → warn
  });

  // ---- SelfPurchaseMode constant values ----
  it('SelfPurchaseMode.SELF === "self"', () => {
    expect(SelfPurchaseMode.SELF).toBe('self');
  });

  it('SelfPurchaseMode.GIFT === "gift"', () => {
    expect(SelfPurchaseMode.GIFT).toBe('gift');
  });
});
