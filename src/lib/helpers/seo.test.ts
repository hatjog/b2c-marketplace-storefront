import { describe, it, expect, vi } from 'vitest';

// Mock next/headers — not available outside Next.js runtime
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map())
}));

import { resolveGpSeoMetadata } from './seo';

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
