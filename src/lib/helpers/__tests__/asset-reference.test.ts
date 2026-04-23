import { describe, expect, it } from 'vitest';

import {
  STOREFRONT_PLACEHOLDER_IMAGE_SRC,
  resolveStorefrontImageSrc,
} from '../asset-reference';

describe('resolveStorefrontImageSrc', () => {
  const marketId = 'bonbeauty';

  it('returns absolute URLs unchanged', () => {
    expect(resolveStorefrontImageSrc('https://example.com/image.jpg', marketId)).toBe(
      'https://example.com/image.jpg'
    );
  });

  it('returns app-relative URLs unchanged', () => {
    expect(resolveStorefrontImageSrc('/images/product.jpg', marketId)).toBe(
      '/images/product.jpg'
    );
  });

  it('maps runtime asset paths to the runtime asset route', () => {
    expect(resolveStorefrontImageSrc('assets/products/mezoterapia.jpg', marketId)).toBe(
      '/api/runtime-market-assets/bonbeauty/assets/products/mezoterapia.jpg'
    );
  });

  it('keeps malformed percent-encoding safe by routing through runtime assets', () => {
    expect(resolveStorefrontImageSrc('assets/products/mezoterapia%GG.jpg', marketId)).toBe(
      '/api/runtime-market-assets/bonbeauty/assets/products/mezoterapia%25GG.jpg'
    );
  });

  it('falls back to the placeholder for unsafe relative paths', () => {
    expect(resolveStorefrontImageSrc('../mezoterapia.jpg', marketId)).toBe(
      STOREFRONT_PLACEHOLDER_IMAGE_SRC
    );
  });
});