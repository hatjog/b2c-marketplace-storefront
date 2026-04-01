import { describe, it, expect } from 'vitest';
import { getGpMetadata, getGpField } from '../metadata-utils';

type TestGpType = { sort_rank?: number; vendor_name?: string };

describe('getGpMetadata', () => {
  it('zwraca undefined gdy metadata jest null', () => {
    expect(getGpMetadata<TestGpType>(null)).toBeUndefined();
  });

  it('zwraca undefined gdy metadata jest undefined', () => {
    expect(getGpMetadata<TestGpType>(undefined)).toBeUndefined();
  });

  it('zwraca undefined gdy klucz gp jest nieobecny', () => {
    expect(getGpMetadata<TestGpType>({ other_key: 'value' })).toBeUndefined();
  });

  it('zwraca obiekt gp z typem T', () => {
    const meta = { gp: { sort_rank: 5, vendor_name: 'Salon A' } };
    const result = getGpMetadata<TestGpType>(meta);
    expect(result).toEqual({ sort_rank: 5, vendor_name: 'Salon A' });
    expect(result?.sort_rank).toBe(5);
    expect(result?.vendor_name).toBe('Salon A');
  });

  it('zwraca pusty obiekt gdy gp jest pustym obiektem', () => {
    const meta = { gp: {} };
    const result = getGpMetadata<TestGpType>(meta);
    expect(result).toEqual({});
  });

  it('działa z zagnieżdżonymi typami (GpSeoMetadata)', () => {
    type GpWithSeo = { seo?: { meta_title?: string } };
    const meta = { gp: { seo: { meta_title: 'Test Title' } } };
    const result = getGpMetadata<GpWithSeo>(meta);
    expect(result?.seo?.meta_title).toBe('Test Title');
  });
});

describe('getGpField', () => {
  it('zwraca undefined gdy metadata jest null', () => {
    expect(getGpField<number>(null, 'sort_rank')).toBeUndefined();
  });

  it('zwraca undefined gdy klucz gp jest nieobecny', () => {
    expect(getGpField<number>({ other: 1 }, 'sort_rank')).toBeUndefined();
  });

  it('zwraca undefined gdy pole nie istnieje w gp', () => {
    expect(getGpField<number>({ gp: { vendor_name: 'X' } }, 'sort_rank')).toBeUndefined();
  });

  it('zwraca wartość pola z gp', () => {
    const meta = { gp: { sort_rank: 42 } };
    expect(getGpField<number>(meta, 'sort_rank')).toBe(42);
  });

  it('zwraca string z gp', () => {
    const meta = { gp: { vendor_name: 'Salon B', market_id: 'pl-bon' } };
    expect(getGpField<string>(meta, 'vendor_name')).toBe('Salon B');
    expect(getGpField<string>(meta, 'market_id')).toBe('pl-bon');
  });

  it('zwraca boolean z gp', () => {
    const meta = { gp: { has_vendor_pricing: true } };
    expect(getGpField<boolean>(meta, 'has_vendor_pricing')).toBe(true);
  });
});
