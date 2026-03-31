import { describe, expect, it } from 'vitest';

import { filterEmptyOptions } from '../filter-utils';

describe('filterEmptyOptions', () => {
  it('returns all options when all have count > 0', () => {
    const options = [
      { id: '1', value: 'a', count: 5 },
      { id: '2', value: 'b', count: 3 },
      { id: '3', value: 'c', count: 1 }
    ];
    const result = filterEmptyOptions(options);
    expect(result).toHaveLength(3);
    expect(result).toEqual(options);
  });

  it('filters out options with count === 0, keeps the rest', () => {
    const options = [
      { id: '1', value: 'a', count: 5 },
      { id: '2', value: 'b', count: 0 },
      { id: '3', value: 'c', count: 2 },
      { id: '4', value: 'd', count: 7 }
    ];
    const result = filterEmptyOptions(options);
    expect(result).toHaveLength(3);
    expect(result?.map(o => o.id)).toEqual(['1', '3', '4']);
  });

  it('returns null when fewer than threshold unique options remain', () => {
    const options = [
      { id: '1', value: 'a', count: 5 },
      { id: '2', value: 'b', count: 0 }
    ];
    const result = filterEmptyOptions(options); // default threshold = 3
    expect(result).toBeNull();
  });

  it('returns null when all options have count === 0', () => {
    const options = [
      { id: '1', value: 'a', count: 0 },
      { id: '2', value: 'b', count: 0 },
      { id: '3', value: 'c', count: 0 }
    ];
    const result = filterEmptyOptions(options);
    expect(result).toBeNull();
  });

  it('preserves options with count === undefined (safe fallback)', () => {
    const options = [
      { id: '1', value: 'a' },
      { id: '2', value: 'b' },
      { id: '3', value: 'c' }
    ];
    const result = filterEmptyOptions(options);
    expect(result).toHaveLength(3);
    expect(result).toEqual(options);
  });

  it('respects custom threshold', () => {
    const options = [
      { id: '1', value: 'a', count: 5 },
      { id: '2', value: 'b', count: 3 }
    ];
    // default threshold=3: should return null (2 < 3)
    expect(filterEmptyOptions(options)).toBeNull();
    // custom threshold=2: should return the 2 options (2 >= 2)
    const result = filterEmptyOptions(options, 2);
    expect(result).toHaveLength(2);
  });

  it('returns null for empty array (0 < threshold)', () => {
    const result = filterEmptyOptions([]);
    expect(result).toBeNull();
  });

  it('mixes undefined and zero counts: keeps undefined, removes zero', () => {
    const options = [
      { id: '1', value: 'a', count: undefined },
      { id: '2', value: 'b', count: 0 },
      { id: '3', value: 'c', count: undefined },
      { id: '4', value: 'd', count: undefined }
    ];
    const result = filterEmptyOptions(options);
    // 3 options with undefined count remain (>= threshold 3)
    expect(result).toHaveLength(3);
    expect(result?.map(o => o.id)).toEqual(['1', '3', '4']);
  });
});
