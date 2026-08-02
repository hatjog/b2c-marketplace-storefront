/**
 * Test-testu klasyfikatorów HG-13 — Story 5.5 (AC2, AC3).
 *
 * Ciężar dowodu HG-13 leży na ŻYWYM przebiegu na prod-buildzie, nie tutaj.
 * Ten plik pilnuje wyłącznie tego, czego żywy przebieg nie umie pokazać na
 * żądanie: że klasyfikator jest RED na wejściu odtwarzającym przeciek, RED na
 * przebiegu pustym/niepełnym i GREEN dopiero na kompletnym, czystym przebiegu.
 *
 * Bez tych trzech przypadków „zielony HG-13" znaczyłby tylko tyle, że nic nie
 * zmierzono — a dokładnie tak wyglądała cicha utrata zdolności wykrywania
 * w story 5.6 (RUNTIME_UNAVAILABLE przechodził jako sukces).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { HG13_MIN, computeHg13Counters, evaluateHg13 } from '../scripts/cache-leak-hg13.mjs';
import {
  markerIsAttributable,
  normalizeText,
  pairwiseDisjointViolations,
  pickCandidates
} from '../scripts/lib/hg13-oracle.mjs';

const LOCALES = ['pl', 'ua', 'de'];
const CLASSES = ['catalog', 'category', 'pdp'];

test('runner Playwrighta nie blokuje drenowania logow next start', () => {
  const source = fs.readFileSync(new URL('../scripts/cache-leak-hg13.mjs', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('async function runHg13Spec'), source.indexOf('/**\n * Liczniki HG-13'));
  assert.match(body, /const child = spawn\(/);
  assert.doesNotMatch(body, /spawnSync\(/);
});

/** Buduje kompletną, czystą macierz: 20 fal × 3 locale × 3 klasy = 180 próbek. */
function cleanRun({ waves = 20, maxInFlight = 9 } = {}) {
  const samples = [];
  let ordinal = 0;
  for (let wave = 0; wave < waves; wave++) {
    for (const cls of CLASSES) {
      for (const locale of LOCALES) {
        samples.push({
          ordinal: ordinal++,
          wave,
          phase: 'measure',
          class: cls,
          locale,
          url: `/${locale}/x`,
          status: 200,
          error: null,
          own_fingerprint_found: true,
          foreign_fingerprints_found: [],
          classification: 'clean',
          excerpt: null
        });
      }
    }
  }
  return {
    samples,
    load_profile: { waves, max_in_flight_measured: maxInFlight }
  };
}

test('GREEN: kompletny przebieg bez przecieku przechodzi', () => {
  const run = cleanRun();
  const counters = computeHg13Counters(run.samples, LOCALES, CLASSES);
  assert.equal(counters.measured_samples, 180);
  assert.equal(counters.foreign_locale_count, 0);
  assert.equal(counters.missing_expected_locale_count, 0);
  assert.equal(counters.unclassified_count, 0);
  assert.deepEqual(counters.empty_cells, []);

  const verdict = evaluateHg13({ counters, loadProfile: run.load_profile });
  assert.equal(verdict.pass, true, JSON.stringify(verdict.findings));
});

test('RED: JEDNA odpowiedź z obcym locale przewraca HG-13 (zero budżetu, G-L1 nie łagodzi)', () => {
  const run = cleanRun();
  // Kontrolowany przeciek: /de dostaje treść z fingerprintem PL.
  const victim = run.samples.find((s) => s.locale === 'de' && s.class === 'pdp');
  victim.foreign_fingerprints_found = ['pl'];
  victim.classification = 'foreign_locale';
  victim.excerpt = '…Peeling kwasami…';

  const counters = computeHg13Counters(run.samples, LOCALES, CLASSES);
  assert.equal(counters.foreign_locale_count, 1);
  assert.equal(counters.foreign_detail.length, 1);

  const verdict = evaluateHg13({ counters, loadProfile: run.load_profile });
  assert.equal(verdict.pass, false);
  assert.ok(
    verdict.findings.some((f) => f.rule === 'FOREIGN_LOCALE_IN_RESPONSE'),
    'jeden przeciek MUSI być twardym FAIL — budżet MEDIUM<=5 z G-L1 nie dotyczy HG-13'
  );
});

test('RED: pusty przebieg NIE jest sukcesem (zero próbek to brak dowodu)', () => {
  const counters = computeHg13Counters([], LOCALES, CLASSES);
  assert.equal(counters.measured_samples, 0);
  assert.equal(counters.empty_cells.length, LOCALES.length * CLASSES.length);

  const verdict = evaluateHg13({ counters, loadProfile: { waves: 0, max_in_flight_measured: 0 } });
  assert.equal(verdict.pass, false);
  for (const rule of ['INCOMPLETE_MATRIX', 'SAMPLE_FLOOR_NOT_MET', 'WAVE_FLOOR_NOT_MET', 'CONCURRENCY_FLOOR_NOT_MET']) {
    assert.ok(verdict.findings.some((f) => f.rule === rule), `brak reguły ${rule}`);
  }
});

test('RED: niepełna macierz (brakująca komórka locale × klasa) nie przechodzi', () => {
  const run = cleanRun();
  // Wycinamy CAŁĄ komórkę ua×category — reszta zostaje zielona.
  run.samples = run.samples.filter((s) => !(s.locale === 'ua' && s.class === 'category'));
  const counters = computeHg13Counters(run.samples, LOCALES, CLASSES);
  assert.deepEqual(counters.empty_cells, ['category|ua']);

  const verdict = evaluateHg13({ counters, loadProfile: run.load_profile });
  assert.equal(verdict.pass, false);
  assert.ok(verdict.findings.some((f) => f.rule === 'INCOMPLETE_MATRIX'));
  assert.ok(
    verdict.findings.some((f) => f.rule === 'SAMPLE_FLOOR_NOT_MET'),
    'ubytek komórki musi też zbić próbę poniżej podłogi — inaczej 179/180 udawałoby komplet'
  );
});

test('RED: sekwencyjny przebieg (max_in_flight=1) nie dowodzi współbieżności', () => {
  const run = cleanRun({ maxInFlight: 1 });
  const counters = computeHg13Counters(run.samples, LOCALES, CLASSES);
  const verdict = evaluateHg13({ counters, loadProfile: run.load_profile });
  assert.equal(verdict.pass, false);
  assert.ok(verdict.findings.some((f) => f.rule === 'CONCURRENCY_FLOOR_NOT_MET'));
});

test('RED: timeout/non-200 liczy się jako brak dowodu, nie jako „czysto"', () => {
  const run = cleanRun();
  const victim = run.samples.find((s) => s.locale === 'ua' && s.class === 'catalog');
  victim.status = null;
  victim.error = 'timeout 30000ms';
  victim.own_fingerprint_found = false;
  victim.classification = 'unclassified';

  const counters = computeHg13Counters(run.samples, LOCALES, CLASSES);
  assert.equal(counters.unclassified_count, 1);
  assert.equal(
    counters.missing_expected_locale_count, 0,
    'próbka bez odpowiedzi NIE może być liczona jako „brak własnego locale" — to inny fakt'
  );
  const verdict = evaluateHg13({ counters, loadProfile: run.load_profile });
  assert.equal(verdict.pass, false);
  assert.ok(verdict.findings.some((f) => f.rule === 'UNCLASSIFIED_SAMPLE'));
});

test('liczniki są NIEZALEŻNE: brak własnego locale i obcy locale w jednej odpowiedzi liczą się osobno', () => {
  const run = cleanRun();
  const victim = run.samples[0];
  victim.own_fingerprint_found = false;
  victim.foreign_fingerprints_found = ['de'];
  victim.classification = 'foreign_locale';

  const counters = computeHg13Counters(run.samples, LOCALES, CLASSES);
  assert.equal(counters.foreign_locale_count, 1);
  assert.equal(
    counters.missing_expected_locale_count, 1,
    'zliczanie „albo-albo" ukryłoby jeden z dwóch zmierzonych faktów (AC3)'
  );
});

// ── Oracle: niezależność i rozłączność (AC2) ──────────────────────────────

test('normalizeText: encje HTML nie mogą udawać braku własnego locale', () => {
  assert.equal(normalizeText('Wellness &amp; SPA'), 'Wellness & SPA');
  assert.equal(normalizeText('  Schönheit\n\t '), 'Schönheit');
  assert.equal(normalizeText('it&#x27;s'), "it's");
});

test('pairwiseDisjointViolations: identyczna nazwa w dwóch locale to NIE jest marker', () => {
  assert.deepEqual(pairwiseDisjointViolations({ pl: 'Uroda', ua: 'Краса', de: 'Schönheit' }), []);

  const identical = pairwiseDisjointViolations({ pl: 'Botox', ua: 'Botox', de: 'Schönheit' });
  assert.equal(identical.length, 1);
  assert.equal(identical[0].rule, 'IDENTICAL_ACROSS_LOCALES');

  const substring = pairwiseDisjointViolations({ pl: 'Peeling', ua: 'Peeling kwasami', de: 'Säurepeeling' });
  assert.ok(substring.some((v) => v.rule === 'SUBSTRING_OVERLAP'));

  const empty = pairwiseDisjointViolations({ pl: 'Uroda', ua: '', de: 'Schönheit' });
  assert.ok(empty.some((v) => v.rule === 'EMPTY_FINGERPRINT'));
});

test('markerIsAttributable: kolizja WEWNĄTRZ locale z innym zasobem dyskwalifikuje marker', () => {
  // Zmierzona mina: „Twarz" jest podciągiem „Twarz – pielęgnacja i terapie".
  const labeled = [
    { handle: 'twarz', locale: 'pl', text: 'Twarz' },
    { handle: 'twarz-pielegnacja', locale: 'pl', text: 'Twarz – pielęgnacja i terapie' },
    { handle: 'uroda', locale: 'pl', text: 'Uroda' }
  ];
  assert.equal(
    markerIsAttributable('Twarz', 'twarz', 'pl', labeled), false,
    'trafienie w „Twarz – pielęgnacja…" zostałoby przypisane zasobowi „twarz"'
  );
  assert.equal(markerIsAttributable('Uroda', 'uroda', 'pl', labeled), true);
});

test('markerIsAttributable: PL-owa nazwa użyta w NIEMIECKIM opisie tego samego zasobu dyskwalifikuje marker', () => {
  // Dokładnie ta mina wyprodukowała 64/180 fałszywych „przecieków" w pierwszym
  // żywym przebiegu: niemiecki opis brzmi „Uroda ist die Kategorie für…".
  const labeled = [
    { handle: 'uroda', locale: 'pl', text: 'Uroda' },
    { handle: 'uroda', locale: 'de', text: 'Uroda ist die Kategorie für die tägliche Pflege' }
  ];
  assert.equal(
    markerIsAttributable('Uroda', 'uroda', 'pl', labeled), false,
    'PL-owy marker obecny w niemieckiej treści to luka tłumaczeń, nie przeciek cache\'u'
  );
});

test('markerIsAttributable: własny opis w tym SAMYM locale NIE dyskwalifikuje markera', () => {
  const labeled = [
    { handle: 'peeling', locale: 'pl', text: 'Peeling węglowy' },
    { handle: 'peeling', locale: 'pl', text: 'Peeling węglowy to zabieg dla cery mieszanej.' }
  ];
  assert.equal(
    markerIsAttributable('Peeling węglowy', 'peeling', 'pl', labeled), true,
    'tytuł produktu prawie zawsze występuje w jego własnym opisie — atrybucja jest wtedy poprawna'
  );
});

test('pickCandidates: odrzuca zasób spoza katalogu backendu i bez kompletu locale', () => {
  const labeled = [
    { handle: 'brak-w-backendzie', locale: 'pl', text: 'Uroda' },
    { handle: 'brak-w-backendzie', locale: 'ua', text: 'Краса' },
    { handle: 'brak-w-backendzie', locale: 'de', text: 'Schönheit' },
    { handle: 'niepelny', locale: 'pl', text: 'Sierota' },
    { handle: 'niepelny', locale: 'de', text: 'Waise' }
  ];
  const items = [
    { handle: 'brak-w-backendzie', active: true, fingerprints: { pl: 'Uroda', ua: 'Краса', de: 'Schönheit' } },
    { handle: 'niepelny', active: true, fingerprints: { pl: 'Sierota', ua: null, de: 'Waise' } }
  ];
  const rejected = [];
  const picked = pickCandidates(items, labeled, new Set(['inny-handle']), rejected);
  assert.deepEqual(picked, [], 'fail-closed, nie „weź pierwszy z brzegu"');
  assert.equal(rejected[0].rule, 'NOT_IN_BACKEND_CATALOG');
  assert.equal(rejected[1].rule, 'NOT_IN_BACKEND_CATALOG');

  const rejected2 = [];
  const picked2 = pickCandidates(items, labeled, new Set(['niepelny']), rejected2);
  assert.deepEqual(picked2, []);
  assert.ok(rejected2.some((r) => r.rule === 'MISSING_LOCALE_FINGERPRINT'));
});

test('progi HG13_MIN są tym, czego wymaga AC2 (20 fal / 180 próbek / współbieżność 9)', () => {
  assert.equal(HG13_MIN.waves, 20);
  assert.equal(HG13_MIN.measuredSamples, 180);
  assert.equal(HG13_MIN.concurrency, 9);
});
