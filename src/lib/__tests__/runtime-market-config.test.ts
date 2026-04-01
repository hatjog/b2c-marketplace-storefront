import { describe, it, expect } from 'vitest';
import { normalizeZasadySection } from '../runtime-market-config';

describe('normalizeZasadySection', () => {
  it('returns null for null input', () => {
    expect(normalizeZasadySection(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeZasadySection(undefined)).toBeNull();
  });

  it('returns null for string input', () => {
    expect(normalizeZasadySection('hello')).toBeNull();
  });

  it('returns null for number input', () => {
    expect(normalizeZasadySection(42)).toBeNull();
  });

  it('returns null for array input', () => {
    expect(normalizeZasadySection([])).toBeNull();
  });

  it('returns null when title is missing', () => {
    expect(normalizeZasadySection({ body: 'Some body' })).toBeNull();
  });

  it('returns null when body is missing', () => {
    expect(normalizeZasadySection({ title: 'Title' })).toBeNull();
  });

  it('returns null when title is empty string', () => {
    expect(normalizeZasadySection({ title: '', body: 'Body' })).toBeNull();
  });

  it('returns null when title is whitespace only', () => {
    expect(normalizeZasadySection({ title: '   ', body: 'Body' })).toBeNull();
  });

  it('returns null when body is empty string', () => {
    expect(normalizeZasadySection({ title: 'Title', body: '' })).toBeNull();
  });

  it('returns null when body is whitespace only', () => {
    expect(normalizeZasadySection({ title: 'Title', body: '   ' })).toBeNull();
  });

  it('returns null when title is null', () => {
    expect(normalizeZasadySection({ title: null, body: 'Body' })).toBeNull();
  });

  it('returns null when body is null', () => {
    expect(normalizeZasadySection({ title: 'Title', body: null })).toBeNull();
  });

  it('returns normalized section for valid input', () => {
    const result = normalizeZasadySection({ title: 'Zwroty', body: '<p>14 dni na zwrot</p>' });
    expect(result).toEqual({ title: 'Zwroty', body: '<p>14 dni na zwrot</p>' });
  });

  it('trims whitespace from title', () => {
    const result = normalizeZasadySection({ title: '  Reklamacje  ', body: 'Treść' });
    expect(result?.title).toBe('Reklamacje');
  });

  it('trims whitespace from body', () => {
    const result = normalizeZasadySection({ title: 'Tytuł', body: '  Treść  ' });
    expect(result?.body).toBe('Treść');
  });

  it('ignores extra properties (no leakage)', () => {
    const result = normalizeZasadySection({ title: 'T', body: 'B', extra: 'data' });
    expect(result).toEqual({ title: 'T', body: 'B' });
    expect(result).not.toHaveProperty('extra');
  });
});
