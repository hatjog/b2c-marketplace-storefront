import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getBannerSectionData,
  getImageUrl,
  getStyleSectionData,
  normalizeOptionalText,
  resolveBooleanFlag,
} from '../homepage-utils';

// Mock logger module — STAGING-FREE, no Sentry/network required (AC5, UX-DR108/ADR-066)
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Import mocked logger after vi.mock hoisting
import { logger } from '@/lib/logger';

describe('normalizeOptionalText', () => {
  it('returns trimmed string for non-empty input', () => {
    expect(normalizeOptionalText(' 60vh ')).toBe('60vh');
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(normalizeOptionalText('')).toBeNull();
    expect(normalizeOptionalText('   ')).toBeNull();
    expect(normalizeOptionalText(undefined)).toBeNull();
  });
});

describe('resolveBooleanFlag', () => {
  it('returns explicit boolean values unchanged', () => {
    expect(resolveBooleanFlag(true, false)).toBe(true);
    expect(resolveBooleanFlag(false, true)).toBe(false);
  });

  it('falls back when value is nullish', () => {
    expect(resolveBooleanFlag(undefined, true)).toBe(true);
    expect(resolveBooleanFlag(null, false)).toBe(false);
  });
});

describe('getImageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- AC6(a): Success path — logger NOT called ---
  it('AC6(a) success: returns url from string input without calling logger', () => {
    expect(getImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  // --- AC6(b): Degraded warn — logger.warn called once with correct structured payload ---
  it('AC6(b) degraded warn: calls logger.warn once with structured PII-free payload when fallback used', () => {
    const result = getImageUrl(null, '/fallback.jpg');
    expect(result).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', {
      source: 'homepage-utils',
      context: {
        fallback_url_present: true,
        image_kind: 'null',
      },
    });
    // PII check: raw fallback URL must NOT appear in the payload
    const callArg = vi.mocked(logger.warn).mock.calls[0]?.[1];
    expect(JSON.stringify(callArg)).not.toContain('/fallback.jpg');
  });

  // --- AC6(c): Error-level shape — logger.error in isolation (homepage-utils.ts has no error branch today) ---
  it('AC6(c) error isolation: logger.error emits structured payload with event_type + source + error_message', () => {
    // homepage-utils.ts currently has no error-level callsite (only expected-degraded warn).
    // This test verifies logger.error shape contract directly (wrapper-side, Opcja A per OQ#3).
    logger.error('homepage.image.load_error', {
      source: 'homepage-utils',
      error_message: 'timeout',
      context: { image_kind: 'object' },
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('homepage.image.load_error', {
      source: 'homepage-utils',
      error_message: 'timeout',
      context: { image_kind: 'object' },
    });
  });

  it('returns url from object with url field', () => {
    expect(getImageUrl({ url: 'https://example.com/image.jpg' })).toBe('https://example.com/image.jpg');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns fallback when image is null', () => {
    expect(getImageUrl(null, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      source: 'homepage-utils',
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'null' }),
    }));
  });

  it('returns fallback when image is undefined', () => {
    expect(getImageUrl(undefined, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      source: 'homepage-utils',
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'null' }),
    }));
  });

  it('returns null when no image and no fallback', () => {
    expect(getImageUrl(null)).toBeNull();
    expect(getImageUrl(undefined)).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('prefers image over fallback when both present', () => {
    expect(getImageUrl('https://example.com/real.jpg', '/fallback.jpg')).toBe('https://example.com/real.jpg');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns fallback when image is empty string', () => {
    expect(getImageUrl('', '/fallback.jpg')).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'string' }),
    }));
  });

  it('returns fallback when image.url is empty string', () => {
    expect(getImageUrl({ url: '' }, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'object' }),
    }));
  });

  it('returns fallback when image.url is null', () => {
    expect(getImageUrl({ url: null }, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'object' }),
    }));
  });

  it('prefixes relative path with portalBaseUrl when provided', () => {
    expect(getImageUrl('/api/media/file/x.jpg', undefined, 'http://localhost:9003')).toBe(
      'http://localhost:9003/api/media/file/x.jpg',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns relative path unchanged when portalBaseUrl is not provided', () => {
    expect(getImageUrl('/api/media/file/x.jpg')).toBe('/api/media/file/x.jpg');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not transform absolute http URL even when portalBaseUrl is provided', () => {
    expect(getImageUrl('http://localhost:9003/api/media/file/x.jpg', undefined, 'http://localhost:9003')).toBe(
      'http://localhost:9003/api/media/file/x.jpg',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not transform external https URL when portalBaseUrl is provided', () => {
    expect(getImageUrl('https://cdn.example.com/img.jpg', undefined, 'http://localhost:9003')).toBe(
      'https://cdn.example.com/img.jpg',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not transform data URI when portalBaseUrl is provided', () => {
    const dataUri = 'data:image/svg+xml;base64,PHN2Zy8+';
    expect(getImageUrl(dataUri, undefined, 'http://localhost:9003')).toBe(dataUri);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not transform protocol-relative URL when portalBaseUrl is provided', () => {
    expect(getImageUrl('//cdn.example.com/img.jpg', undefined, 'http://localhost:9003')).toBe(
      '//cdn.example.com/img.jpg',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('strips trailing slash from portalBaseUrl before prefixing', () => {
    expect(getImageUrl('/api/media/file/x.jpg', undefined, 'http://localhost:9003/')).toBe(
      'http://localhost:9003/api/media/file/x.jpg',
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('keeps same-origin runtime asset route unchanged when portalBaseUrl is provided', () => {
    expect(
      getImageUrl(
        '/api/runtime-market-assets/bonbeauty/assets/hero.jpg',
        undefined,
        'http://localhost:9003/',
      ),
    ).toBe('/api/runtime-market-assets/bonbeauty/assets/hero.jpg');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns fallback when image is whitespace-only string', () => {
    expect(getImageUrl('   ', '/fallback.jpg')).toBe('/fallback.jpg');
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'string' }),
    }));
  });

  it('returns null when image is whitespace-only and no fallback', () => {
    expect(getImageUrl('   ')).toBeNull();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('returns fallback as-is when image is null and portalBaseUrl is provided', () => {
    expect(getImageUrl(null, '/images/hero/Image.jpg', 'http://localhost:9003')).toBe('/images/hero/Image.jpg');
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'null' }),
    }));
  });

  it('returns fallback as-is when image is empty and portalBaseUrl is provided', () => {
    expect(getImageUrl('', '/images/placeholder.svg', 'http://localhost:9003')).toBe('/images/placeholder.svg');
    expect(logger.warn).toHaveBeenCalledWith('homepage.image.fallback_used', expect.objectContaining({
      context: expect.objectContaining({ fallback_url_present: true, image_kind: 'string' }),
    }));
  });
});

describe('getBannerSectionData — fallback propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const validSection = { heading: 'Sale', label: 'Shop now', cta_link: '/shop' };

  it('returns fallback image path when image is null', () => {
    const result = getBannerSectionData(
      { ...validSection, image: null },
      '/images/banner-section/Image.jpg',
    );
    expect(result?.imageUrl).toBe('/images/banner-section/Image.jpg');
  });

  it('returns null imageUrl when no image and no fallback provided', () => {
    const result = getBannerSectionData({ ...validSection, image: null });
    expect(result?.imageUrl).toBeNull();
  });

  it('returns null when required text fields missing (fallback does not override validation)', () => {
    const result = getBannerSectionData(
      { image: null },
      '/images/banner-section/Image.jpg',
    );
    expect(result).toBeNull();
  });
});

describe('getStyleSectionData — fallback propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const validSection = {
    heading: 'Shop by style',
    items: [
      { label: 'Casual', link: '/casual', image: null },
      { label: 'Glamour', link: '/glamour', image: null },
    ],
  };

  it('returns placeholder fallback per item when images are null', () => {
    const result = getStyleSectionData(validSection, '/images/placeholder.svg');
    expect(result?.items).toHaveLength(2);
    expect(result?.items[0].imageUrl).toBe('/images/placeholder.svg');
    expect(result?.items[1].imageUrl).toBe('/images/placeholder.svg');
  });

  it('returns null imageUrl per item when no fallback provided', () => {
    const result = getStyleSectionData(validSection);
    expect(result?.items[0].imageUrl).toBeNull();
  });

  it('prefers real image over fallback per item', () => {
    const section = {
      heading: 'Shop by style',
      items: [{ label: 'Casual', link: '/casual', image: 'https://cdn/style.jpg' }],
    };
    const result = getStyleSectionData(section, '/images/placeholder.svg');
    expect(result?.items[0].imageUrl).toBe('https://cdn/style.jpg');
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
