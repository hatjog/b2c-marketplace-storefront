import { describe, expect, it } from 'vitest';

import { safeDecodeURI } from '../url';

describe('safeDecodeURI', () => {
  it('returns a plain string unchanged', () => {
    expect(safeDecodeURI('hello-world')).toBe('hello-world');
  });

  it('decodes a percent-encoded string', () => {
    expect(safeDecodeURI('hello%20world')).toBe('hello world');
  });

  it('returns an already-decoded string unchanged', () => {
    expect(safeDecodeURI('hello world')).toBe('hello world');
  });

  it('returns the original string when the sequence is malformed', () => {
    expect(safeDecodeURI('bad%GGsequence')).toBe('bad%GGsequence');
  });

  it('returns an empty string for empty input', () => {
    expect(safeDecodeURI('')).toBe('');
  });
});
