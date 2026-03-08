import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getBannerSectionData,
  getImageUrl,
  getStyleSectionData,
} from '../homepage-utils';

describe('getImageUrl', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns url from string input', () => {
    expect(getImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns url from object with url field', () => {
    expect(getImageUrl({ url: 'https://example.com/image.jpg' })).toBe('https://example.com/image.jpg');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns fallback when image is null', () => {
    expect(getImageUrl(null, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(console.warn).toHaveBeenCalledWith('[homepage] image missing, using fallback:', '/fallback.jpg');
  });

  it('returns fallback when image is undefined', () => {
    expect(getImageUrl(undefined, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(console.warn).toHaveBeenCalledWith('[homepage] image missing, using fallback:', '/fallback.jpg');
  });

  it('returns null when no image and no fallback', () => {
    expect(getImageUrl(null)).toBeNull();
    expect(getImageUrl(undefined)).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('prefers image over fallback when both present', () => {
    expect(getImageUrl('https://example.com/real.jpg', '/fallback.jpg')).toBe('https://example.com/real.jpg');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns fallback when image is empty string', () => {
    expect(getImageUrl('', '/fallback.jpg')).toBe('/fallback.jpg');
    expect(console.warn).toHaveBeenCalledWith('[homepage] image missing, using fallback:', '/fallback.jpg');
  });

  it('returns fallback when image.url is empty string', () => {
    expect(getImageUrl({ url: '' }, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(console.warn).toHaveBeenCalledWith('[homepage] image missing, using fallback:', '/fallback.jpg');
  });

  it('returns fallback when image.url is null', () => {
    expect(getImageUrl({ url: null }, '/fallback.jpg')).toBe('/fallback.jpg');
    expect(console.warn).toHaveBeenCalledWith('[homepage] image missing, using fallback:', '/fallback.jpg');
  });
});

describe('getBannerSectionData — fallback propagation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(console.warn).not.toHaveBeenCalled();
  });
});
