import { describe, expect, it } from 'vitest';

import { safeDecodeURIComponent } from '../decode-uri';

describe('safeDecodeURIComponent', () => {
  it('returns a plain string unchanged', () => {
    expect(safeDecodeURIComponent('hello-world')).toBe('hello-world');
  });

  it('decodes a percent-encoded string', () => {
    expect(safeDecodeURIComponent('hello%20world')).toBe('hello world');
  });

  it('returns an already-decoded string unchanged', () => {
    expect(safeDecodeURIComponent('hello world')).toBe('hello world');
  });

  it('returns the original string when the sequence is malformed', () => {
    expect(safeDecodeURIComponent('bad%GGsequence')).toBe('bad%GGsequence');
  });

  it('returns an empty string for empty input', () => {
    expect(safeDecodeURIComponent('')).toBe('');
  });
});