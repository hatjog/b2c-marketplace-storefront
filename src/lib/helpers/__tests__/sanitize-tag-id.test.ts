import { describe, expect, it } from 'vitest';

import {
  isValidTagId,
  normalizeTagIdCandidate,
  sanitizeTagIdList,
  TAG_ID_MAX_LEN,
} from '../sanitize-tag-id';

describe('normalizeTagIdCandidate', () => {
  it('returns null for non-string input', () => {
    expect(normalizeTagIdCandidate(null)).toBeNull();
    expect(normalizeTagIdCandidate(undefined)).toBeNull();
    expect(normalizeTagIdCandidate(123 as unknown)).toBeNull();
  });

  it('trims whitespace and returns NFC form', () => {
    expect(normalizeTagIdCandidate('  k-beauty  ')).toBe('k-beauty');
  });

  it('rejects empty strings and overlong inputs', () => {
    expect(normalizeTagIdCandidate('')).toBeNull();
    expect(normalizeTagIdCandidate('   ')).toBeNull();
    expect(normalizeTagIdCandidate('a'.repeat(TAG_ID_MAX_LEN + 1))).toBeNull();
  });

  it('rejects any non-ASCII codepoint (defense-in-depth vs unicode spoofs)', () => {
    expect(normalizeTagIdCandidate('café')).toBeNull(); // accented letter
    expect(normalizeTagIdCandidate('ｋ-beauty')).toBeNull(); // fullwidth
  });
});

describe('isValidTagId — allowlist branches', () => {
  it('accepts UUID v4', () => {
    expect(isValidTagId('a1b2c3d4-e5f6-7890-abcd-ef0123456789')).toBe(true);
  });

  it('accepts plain alphanumeric (legacy IDs)', () => {
    expect(isValidTagId('naturalny')).toBe(true);
    expect(isValidTagId('abc123')).toBe(true);
    expect(isValidTagId('UPPER')).toBe(true);
  });

  it('accepts kebab-case (BonBeauty StyleSection regression)', () => {
    expect(isValidTagId('k-beauty')).toBe(true);
    expect(isValidTagId('minimalistyczny')).toBe(true);
    expect(isValidTagId('multi-word-tag-id')).toBe(true);
  });

  it('accepts stable config IDs (group:value form)', () => {
    expect(isValidTagId('style:k-beauty')).toBe(true);
    expect(isValidTagId('group:value:nested')).toBe(true);
  });

  it('rejects invalid forms', () => {
    expect(isValidTagId('')).toBe(false);
    expect(isValidTagId('-leading-hyphen')).toBe(false);
    expect(isValidTagId('trailing-hyphen-')).toBe(false);
    expect(isValidTagId('double--hyphen')).toBe(false);
    expect(isValidTagId('with space')).toBe(false);
    expect(isValidTagId('semi;colon')).toBe(false);
  });
});

describe('sanitizeTagIdList — full pipeline', () => {
  it('returns empty array for empty input', () => {
    expect(sanitizeTagIdList(undefined)).toEqual([]);
    expect(sanitizeTagIdList(null)).toEqual([]);
    expect(sanitizeTagIdList('')).toEqual([]);
  });

  it('parses comma-separated and validates each entry', () => {
    expect(sanitizeTagIdList('k-beauty,naturalny,minimalistyczny')).toEqual([
      'k-beauty',
      'naturalny',
      'minimalistyczny',
    ]);
  });

  it('drops invalid entries silently', () => {
    expect(sanitizeTagIdList('k-beauty,,bad value,,naturalny')).toEqual([
      'k-beauty',
      'naturalny',
    ]);
  });

  it('rejects non-ASCII even when comma-mixed', () => {
    expect(sanitizeTagIdList('k-beauty,café,naturalny')).toEqual([
      'k-beauty',
      'naturalny',
    ]);
  });

  it('handles BonBeauty homepage.yaml fixture values (regression)', () => {
    // Source values from gp-ops/markets/bonbeauty/.../homepage.yaml
    expect(sanitizeTagIdList('naturalny,minimalistyczny,odwazny,k-beauty')).toEqual([
      'naturalny',
      'minimalistyczny',
      'odwazny',
      'k-beauty',
    ]);
  });
});
