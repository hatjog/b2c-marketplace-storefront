import { describe, expect, it } from 'vitest';
import enMessages from '../../../../../messages/en.json';
import plMessages from '../../../../../messages/pl.json';

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
});
