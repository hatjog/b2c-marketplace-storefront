import { describe, it, expect, vi } from 'vitest';

// Mock next/headers — not available outside Next.js runtime
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map())
}));

import { resolveGpSeoMetadata, toSafeOgImageUrl } from './seo';

describe('resolveGpSeoMetadata', () => {
  it('returns gp.seo.* values when present', () => {
    const metadata = {
      gp: {
        seo: {
          meta_title: 'GP Title',
          meta_description: 'GP Description',
          og_image_url: 'https://cdn.example.com/gp.jpg'
        }
      }
    };
    const result = resolveGpSeoMetadata(metadata);
    expect(result.meta_title).toBe('GP Title');
    expect(result.meta_description).toBe('GP Description');
    expect(result.og_image_url).toBe('https://cdn.example.com/gp.jpg');
  });

  it('gp.seo.* wins over legacy metadata.seo.*', () => {
    const metadata = {
      gp: {
        seo: {
          meta_title: 'GP Title',
          meta_description: 'GP Description',
          og_image_url: 'https://cdn.example.com/gp.jpg'
        }
      },
      seo: {
        meta_title: 'Legacy Title',
        meta_description: 'Legacy Description',
        og_image_url: 'https://cdn.example.com/legacy.jpg'
      }
    };
    const result = resolveGpSeoMetadata(metadata);
    expect(result.meta_title).toBe('GP Title');
    expect(result.meta_description).toBe('GP Description');
    expect(result.og_image_url).toBe('https://cdn.example.com/gp.jpg');
  });

  it('falls back to legacy metadata.seo.* when gp.seo.* is absent (backward-compat)', () => {
    const metadata = {
      seo: {
        meta_title: 'Legacy Title',
        meta_description: 'Legacy Description',
        og_image_url: 'https://cdn.example.com/legacy.jpg'
      }
    };
    const result = resolveGpSeoMetadata(metadata);
    expect(result.meta_title).toBe('Legacy Title');
    expect(result.meta_description).toBe('Legacy Description');
    expect(result.og_image_url).toBe('https://cdn.example.com/legacy.jpg');
  });

  it('returns partial gp.seo.* with legacy fallback per field', () => {
    const metadata = {
      gp: {
        seo: {
          meta_title: 'GP Title'
          // meta_description and og_image_url absent
        }
      },
      seo: {
        meta_title: 'Legacy Title',
        meta_description: 'Legacy Description',
        og_image_url: 'https://cdn.example.com/legacy.jpg'
      }
    };
    const result = resolveGpSeoMetadata(metadata);
    expect(result.meta_title).toBe('GP Title');
    expect(result.meta_description).toBe('Legacy Description');
    expect(result.og_image_url).toBe('https://cdn.example.com/legacy.jpg');
  });

  it('returns undefined for all fields when metadata is null', () => {
    const result = resolveGpSeoMetadata(null);
    expect(result.meta_title).toBeUndefined();
    expect(result.meta_description).toBeUndefined();
    expect(result.og_image_url).toBeUndefined();
  });

  it('returns undefined for all fields when metadata is undefined', () => {
    const result = resolveGpSeoMetadata(undefined);
    expect(result.meta_title).toBeUndefined();
    expect(result.meta_description).toBeUndefined();
    expect(result.og_image_url).toBeUndefined();
  });

  it('returns undefined for all fields when metadata is empty object', () => {
    const result = resolveGpSeoMetadata({});
    expect(result.meta_title).toBeUndefined();
    expect(result.meta_description).toBeUndefined();
    expect(result.og_image_url).toBeUndefined();
  });

  it('returns undefined when gp.seo is present but fields are undefined', () => {
    const metadata = {
      gp: {
        seo: {}
      }
    };
    const result = resolveGpSeoMetadata(metadata);
    expect(result.meta_title).toBeUndefined();
    expect(result.meta_description).toBeUndefined();
    expect(result.og_image_url).toBeUndefined();
  });
});

describe('toSafeOgImageUrl', () => {
  const FALLBACK = 'https://example.com/og.png';

  it('returns PNG URL unchanged', () => {
    expect(toSafeOgImageUrl('https://cdn.example.com/image.png', FALLBACK)).toBe(
      'https://cdn.example.com/image.png'
    );
  });

  it('returns JPEG URL unchanged', () => {
    expect(toSafeOgImageUrl('https://cdn.example.com/image.jpg', FALLBACK)).toBe(
      'https://cdn.example.com/image.jpg'
    );
  });

  it('returns fallback for SVG URL', () => {
    expect(toSafeOgImageUrl('https://cdn.example.com/logo.svg', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for SVG with uppercase extension', () => {
    expect(toSafeOgImageUrl('https://cdn.example.com/logo.SVG', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for SVG with query string', () => {
    expect(toSafeOgImageUrl('https://cdn.example.com/logo.svg?v=1', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for SVG with fragment', () => {
    expect(toSafeOgImageUrl('https://cdn.example.com/logo.svg#icon', FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for null', () => {
    expect(toSafeOgImageUrl(null, FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for undefined', () => {
    expect(toSafeOgImageUrl(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('returns fallback for empty string', () => {
    expect(toSafeOgImageUrl('', FALLBACK)).toBe(FALLBACK);
  });
});
