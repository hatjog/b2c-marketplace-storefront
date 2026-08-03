import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyLocalizedRender,
  isProductDescriptionBelowBar,
  readCanonicalProductBarThreshold
} from '../../scripts/smoke-pdp-locales.mjs';

/**
 * Cykl 3 (1-4-c3-classifier-invariant): przed 1.4-c3 klasyfikator porównywał
 * h1 renderu WYŁĄCZNIE z h1 renderu /pl — dla nazw własnych identycznych w
 * PL i locale docelowym (np. „Hammam" bez tłumaczenia) `render.h1 ===
 * plRender.h1`, więc `bodyLocalized` wychodziło false i wynik był fałszywym
 * `pl_fallback_body`, mimo że treść JEST zlokalizowana (h1 == backend_title
 * docelowego locale).
 */
describe('smoke-pdp-locales — classifyLocalizedRender (cykl 3)', () => {
  test('HG-6: 200 z opisem poniżej 80 słów jest fail-closed', () => {
    assert.equal(isProductDescriptionBelowBar(79), true);
    assert.equal(isProductDescriptionBelowBar(80), false);
    assert.equal(isProductDescriptionBelowBar(189), false);
  });

  test('HG-6 czyta próg z kanonicznego content-bar.ts (AD-4)', () => {
    assert.equal(readCanonicalProductBarThreshold(), 80);
  });

  test('translation-invariant: h1 == backend_title docelowego locale, identyczny z PL ⇒ 200_ok_localized', () => {
    const result = classifyLocalizedRender({
      render: { status: 200, title: 'Hammam | Sklep', description: 'Opis DE', h1: 'Hammam' },
      plRender: { status: 200, title: 'Hammam | Sklep', description: 'Opis PL', h1: 'Hammam' },
      backendEntry: { title: 'Hammam' },
      backendPl: { title: 'Hammam' }
    });

    assert.equal(result.verdict, '200_ok_localized');
    assert.equal(result.translationInvariant, true);
  });

  test('realny fallback NIE jest osłabiony: h1 == PL i h1 != target ⇒ nadal pl_fallback_body', () => {
    const result = classifyLocalizedRender({
      render: { status: 200, title: 'Produkt PL | Sklep', description: 'Opis PL', h1: 'Produkt PL' },
      plRender: { status: 200, title: 'Produkt PL | Sklep', description: 'Opis PL', h1: 'Produkt PL' },
      backendEntry: { title: 'Produkt DE' },
      backendPl: { title: 'Produkt PL' }
    });

    assert.equal(result.verdict, 'pl_fallback_body');
    assert.equal(result.translationInvariant, false);
  });

  test('realna lokalizacja (h1 różny od PL i od target string-match nie wymagany) ⇒ 200_ok_localized, translationInvariant=false', () => {
    const result = classifyLocalizedRender({
      render: { status: 200, title: 'Produkt DE | Shop', description: 'Beschreibung DE', h1: 'Produkt DE' },
      plRender: { status: 200, title: 'Produkt PL | Sklep', description: 'Opis PL', h1: 'Produkt PL' },
      backendEntry: { title: 'Produkt DE' },
      backendPl: { title: 'Produkt PL' }
    });

    assert.equal(result.verdict, '200_ok_localized');
    assert.equal(result.translationInvariant, false);
  });

  test('brak sygnału h1 po którejkolwiek stronie ⇒ fail-closed pl_fallback_body', () => {
    const result = classifyLocalizedRender({
      render: { status: 200, title: 'Produkt DE | Shop', description: 'Beschreibung DE', h1: null },
      plRender: { status: 200, title: 'Produkt PL | Sklep', description: 'Opis PL', h1: 'Produkt PL' },
      backendEntry: { title: 'Produkt DE' },
      backendPl: { title: 'Produkt PL' }
    });

    assert.equal(result.verdict, 'pl_fallback_body');
  });
});
