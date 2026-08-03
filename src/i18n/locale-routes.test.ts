import { describe, expect, it } from 'vitest';
import enMessages from '../../messages/en.json';
import plMessages from '../../messages/pl.json';
import { generateLocaleRewrites } from './locale-rewrite-rules';

describe('locale-aware route resolution', () => {
  it('PL routes.terms_of_service resolves to /regulamin', () => {
    expect(plMessages.routes.terms_of_service).toBe('/regulamin');
  });

  it('EN routes.terms_of_service resolves to /terms-of-service', () => {
    expect(enMessages.routes.terms_of_service).toBe('/terms-of-service');
  });

  it('PL routes.privacy_policy resolves to /polityka-prywatnosci', () => {
    expect(plMessages.routes.privacy_policy).toBe('/polityka-prywatnosci');
  });

  it('EN routes.privacy_policy resolves to /privacy-policy', () => {
    expect(enMessages.routes.privacy_policy).toBe('/privacy-policy');
  });

  it('route values start with /', () => {
    for (const [key, value] of Object.entries(enMessages.routes)) {
      expect(value, `EN routes.${key}`).toMatch(/^\//);
    }
    for (const [key, value] of Object.entries(plMessages.routes)) {
      expect(value, `PL routes.${key}`).toMatch(/^\//);
    }
  });

  it('EN and PL have same route keys', () => {
    expect(Object.keys(enMessages.routes).sort()).toEqual(
      Object.keys(plMessages.routes).sort()
    );
  });

  it('generates rewrites for locale routes that differ from the default locale', () => {
    expect(
      generateLocaleRewrites('pl', {
        pl: plMessages.routes,
        en: enMessages.routes
      })
    ).toEqual([
      { source: '/en/terms-of-service', destination: '/en/regulamin' },
      { source: '/en/privacy-policy', destination: '/en/polityka-prywatnosci' }
    ]);
  });

  it('skips rewrites when a locale route matches the default locale path', () => {
    expect(
      generateLocaleRewrites('pl', {
        pl: { terms_of_service: '/regulamin' },
        en: { terms_of_service: '/regulamin' }
      })
    ).toEqual([]);
  });

  it('auto-generates rewrites for newly added locales', () => {
    expect(
      generateLocaleRewrites('pl', {
        pl: { terms_of_service: '/regulamin', privacy_policy: '/polityka-prywatnosci' },
        en: { terms_of_service: '/terms-of-service', privacy_policy: '/privacy-policy' },
        de: { terms_of_service: '/agb', privacy_policy: '/datenschutz' }
      })
    ).toEqual([
      { source: '/en/terms-of-service', destination: '/en/regulamin' },
      { source: '/en/privacy-policy', destination: '/en/polityka-prywatnosci' },
      { source: '/de/agb', destination: '/de/regulamin' },
      { source: '/de/datenschutz', destination: '/de/polityka-prywatnosci' }
    ]);
  });
});
