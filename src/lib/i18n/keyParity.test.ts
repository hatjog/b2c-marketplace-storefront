import { describe, expect, it } from 'vitest';

import deMessages from '../../../messages/de.json';
import enMessages from '../../../messages/en.json';
import plMessages from '../../../messages/pl.json';
import uaMessages from '../../../messages/ua.json';
import { compareMessageKeyParity, flattenMessageKeys, formatKeyParityReport } from './keyParity';

describe('i18n key parity guard', () => {
  it('keeps all four storefront locale catalogs in exact key parity', () => {
    const report = compareMessageKeyParity([
      { locale: 'pl', messages: plMessages },
      { locale: 'en', messages: enMessages },
      { locale: 'ua', messages: uaMessages },
      { locale: 'de', messages: deMessages },
    ]);

    expect(report.missing).toEqual([]);
    expect(report.keyCount).toBeGreaterThan(0);
  });

  it('reports the exact key and locale when a nested key is missing', () => {
    const report = compareMessageKeyParity([
      { locale: 'pl', messages: { cart: { empty_title: 'Koszyk jest pusty' } } },
      { locale: 'en', messages: { cart: {} } },
    ]);

    expect(report.missing).toEqual([{ locale: 'en', key: 'cart.empty_title' }]);
    expect(formatKeyParityReport(report)).toContain('- en: cart.empty_title');
  });

  it('flattens nested message catalogs while skipping top-level review metadata', () => {
    expect(
      flattenMessageKeys({
        _review: { owner: 'qa' },
        cart: { empty_title: 'Empty' },
        footer: { nav: { help: 'Help' } },
      })
    ).toEqual(['cart.empty_title', 'footer.nav.help']);
  });
});

