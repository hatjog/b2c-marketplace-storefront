import { describe, expect, it } from 'vitest';

import { buildMapDeepLink } from '../deepLink';

const coords = { lat: 52.2297, lng: 21.0122, name: 'BonBeauty Centrum' };

describe('buildMapDeepLink', () => {
  it('buduje Apple Maps scheme dla iOS Safari', () => {
    const link = buildMapDeepLink({
      ...coords,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1'
    });

    expect(link.provider).toBe('apple');
    expect(link.primary).toBe(
      'https://maps.apple.com/?ll=52.2297,21.0122&q=BonBeauty%20Centrum'
    );
    expect(link.fallback).toBe(
      'https://www.google.com/maps/search/?api=1&query=52.2297%2C21.0122'
    );
  });

  it('buduje Apple Maps scheme dla Chrome na iOS', () => {
    const link = buildMapDeepLink({
      ...coords,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 CriOS/124.0.0.0 Mobile/15E148 Safari/604.1'
    });

    expect(link.provider).toBe('apple');
    expect(link.primary).toBe(
      'https://maps.apple.com/?ll=52.2297,21.0122&q=BonBeauty%20Centrum'
    );
  });

  it('buduje geo: URL dla Android Chrome', () => {
    const link = buildMapDeepLink({
      ...coords,
      userAgent:
        'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36'
    });

    expect(link.provider).toBe('android');
    expect(link.primary).toBe(
      'geo:52.2297,21.0122?q=52.2297%2C21.0122(BonBeauty%20Centrum)'
    );
  });

  it('buduje geo: URL dla Android Firefox', () => {
    const link = buildMapDeepLink({
      ...coords,
      userAgent: 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0'
    });

    expect(link.provider).toBe('android');
    expect(link.primary.startsWith('geo:52.2297,21.0122?q=')).toBe(true);
  });

  it('używa web fallback dla macOS Safari', () => {
    const link = buildMapDeepLink({
      ...coords,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'
    });

    expect(link.provider).toBe('web');
    expect(link.primary).toBe(link.fallback);
  });

  it('używa web fallback dla Windows Chrome i Linux Firefox', () => {
    const chrome = buildMapDeepLink({
      ...coords,
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36'
    });
    const firefox = buildMapDeepLink({
      ...coords,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0'
    });

    expect(chrome.primary).toBe(chrome.fallback);
    expect(firefox.primary).toBe(firefox.fallback);
  });
});
