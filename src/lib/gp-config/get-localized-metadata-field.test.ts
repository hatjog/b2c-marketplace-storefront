import { describe, expect, it } from 'vitest';

import { getLocalizedMetadataField } from './get-localized-metadata-field';

const source = {
  editorial: {
    hero: {
      title: {
        'pl-PL': 'Tytuł kanoniczny PL',
        'en-US': 'Canonical English title',
        'de-DE': 'Deutscher Titel'
      },
      subtitle: {
        'pl-PL': 'Polski podtytuł'
      }
    },
    cta: {
      label: 'Kup teraz'
    }
  }
};

describe('getLocalizedMetadataField', () => {
  it('zwraca wartość dla locale żądania, gdy istnieje', () => {
    expect(
      getLocalizedMetadataField({
        source,
        path: 'editorial.hero.title',
        locale: 'de-DE',
        marketDefaultLocale: 'en-US'
      })
    ).toBe('Deutscher Titel');
  });

  it('fallbackuje do domyślnego locale marketu, gdy locale żądania nie istnieje', () => {
    expect(
      getLocalizedMetadataField({
        source,
        path: 'editorial.hero.title',
        locale: 'uk-UA',
        marketDefaultLocale: 'en-US'
      })
    ).toBe('Canonical English title');
  });

  it('fallbackuje do kanonicznego PL, gdy request i market default nie istnieją', () => {
    expect(
      getLocalizedMetadataField({
        source,
        path: 'editorial.hero.subtitle',
        locale: 'uk-UA',
        marketDefaultLocale: 'de-DE'
      })
    ).toBe('Polski podtytuł');
  });

  it('traktuje string bez wariantów locale jako wartość kanoniczną PL', () => {
    expect(
      getLocalizedMetadataField({
        source,
        path: 'editorial.cta.label',
        locale: 'de-DE',
        marketDefaultLocale: 'en-US'
      })
    ).toBe('Kup teraz');
  });

  it('rzuca deterministyczny błąd dla brakującego klucza po pełnym fallback chain', () => {
    expect(() =>
      getLocalizedMetadataField({
        source,
        path: 'editorial.does-not-exist',
        locale: 'de-DE',
        marketDefaultLocale: 'en-US'
      })
    ).toThrow(
      "gp-config: missing key 'editorial.does-not-exist' for locales [de-DE, en-US, pl-PL]"
    );
  });

  it('rzuca deterministyczny błąd dla pustej ścieżki', () => {
    expect(() =>
      getLocalizedMetadataField({
        source,
        path: '',
        locale: 'de-DE',
        marketDefaultLocale: 'en-US'
      })
    ).toThrow('gp-config: invalid path');
  });
});
