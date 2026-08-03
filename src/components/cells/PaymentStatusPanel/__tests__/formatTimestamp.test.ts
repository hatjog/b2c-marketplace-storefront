/**
 * Tests for formatLastUpdatedTimestamp.
 *
 * R18 / R22 review fix (second pass): proves the formatter actually
 * formats (does NOT pass-through raw ISO), and returns null on
 * unparseable input (does NOT leak the raw value).
 */

import { describe, expect, it } from 'vitest';

import { formatLastUpdatedTimestamp } from '../formatTimestamp';

describe('formatLastUpdatedTimestamp', () => {
  it('returns null for null input', () => {
    expect(formatLastUpdatedTimestamp(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(formatLastUpdatedTimestamp(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(formatLastUpdatedTimestamp('')).toBeNull();
  });

  it('R22: returns null for unparseable input (does NOT leak raw value)', () => {
    expect(formatLastUpdatedTimestamp('garbage-not-an-iso')).toBeNull();
    expect(formatLastUpdatedTimestamp('2024-13-99')).toBeNull();
  });

  it('R18: returns a non-empty formatted string for a valid ISO timestamp', () => {
    const iso = '2024-01-15T10:00:00Z';
    const out = formatLastUpdatedTimestamp(iso);
    expect(out).not.toBeNull();
    expect(typeof out).toBe('string');
    // Critical assertion: the raw ISO must NOT appear in the formatted
    // output. If the formatter regresses to pass-through, this fails.
    expect(out).not.toContain('T10:00:00');
    expect(out).not.toContain('2024-01-15T');
  });

  it('formats different valid ISO timestamps deterministically (different inputs → different outputs)', () => {
    const a = formatLastUpdatedTimestamp('2024-01-15T10:00:00Z');
    const b = formatLastUpdatedTimestamp('2024-06-15T22:30:00Z');
    expect(a).not.toBe(b);
  });
});
