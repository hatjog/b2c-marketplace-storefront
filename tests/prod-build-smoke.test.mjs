/**
 * Testy klasyfikatorów `scripts/prod-build-smoke.mjs` — Story 5.4.
 *
 * Ciężar dowodu tej story leży na ŻYWYM prod-buildzie (evidence 5.4), nie tutaj.
 * Ten plik pilnuje wyłącznie tego, czego żywy przebieg nie umie pokazać na
 * żądanie: że klasyfikator jest RED na wejściu ODTWARZAJĄCYM zmierzoną awarię
 * i GREEN po poprawce (wzorzec z review 1-4). Każdy blok niżej odtwarza konkretną
 * minę z historii release'u, nie hipotetyczny kształt danych.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTRACT_REQUIRED_ALWAYS,
  assertEvidenceShape,
  buildRouteMatrix,
  classifyCacheSample,
  classifyProbe,
  compareCardinalityArms,
  computeCacheHitRate,
  computeDeferredFindings,
  describeEnvPresence,
  emitContract,
  evaluateBudget,
  findNodeBuiltinLeaks,
  parsePortOwners,
  percentile,
  perfRoutesFor,
  redactBuildLog
} from '../scripts/prod-build-smoke.mjs';

/** Minimalne evidence spełniające kontrakt na ścieżce awaryjnej (state != COMPLETE). */
function minimalEvidence(overrides = {}) {
  const base = {
    tool: 'prod-build-smoke',
    tool_revision: 'sha256:deadbeefdeadbeef',
    state: 'ABORTED',
    story: '5-4-prod-build-smoke-budzet-perf',
    release: 'v1.14.0',
    generated_at: '2026-08-01T00:00:00.000Z',
    market_id: 'bonbeauty',
    promote_usable: false,
    regeneration_required: true,
    regeneration_reason: 'test',
    deferred_findings: [],
    pass: false,
    exit_code: 2
  };
  return { ...base, ...overrides };
}

test('redactBuildLog: sekret z logu builda nie trafia do evidence (NFR4)', () => {
  // Log builda to cudzy stdout — na jednym przebiegu czysty, na następnym może
  // nieść token w query stringu. Redagujemy zawsze, nie „gdy zauważymy".
  const redacted = redactBuildLog(
    'fetch http://localhost:9003/api/market-configs?depth=2&api_key=tajnawartosc123 failed'
  );
  assert.ok(!redacted.includes('tajnawartosc123'));
  assert.ok(redacted.includes('api_key=<REDACTED>'));
  // Nie-sekretne części zostają czytelne — redakcja ma nie zabijać diagnostyki.
  assert.ok(redacted.includes('localhost:9003'));
  assert.ok(redacted.includes('depth=2'));

  assert.ok(!redactBuildLog('key pk_test_ABCdef123456').includes('ABCdef123456'));
  assert.ok(redactBuildLog(`bearer ${'a'.repeat(48)}`).includes('<REDACTED-LONG-TOKEN>'));
});

test('classifyProbe: fail-closed na braku odpowiedzi, timeoucie i 5xx', () => {
  assert.equal(classifyProbe({ status: 200 }).pass, true);

  // Zmierzona klasa: PDP 500 po Sprint-3 przy braku NEXT_PUBLIC_PAYLOAD_MARKET_ID.
  const server = classifyProbe({ status: 500 });
  assert.equal(server.pass, false);
  assert.equal(server.verdict, 'http_5xx_500');

  // Brak odpowiedzi / timeout NIE może zniknąć w statystyce jako „nie wiadomo".
  assert.equal(classifyProbe({ status: null }).pass, false);
  assert.equal(classifyProbe({ status: null }).verdict, 'no_response');
  assert.equal(classifyProbe({ status: null, error: 'ETIMEDOUT' }).verdict, 'fetch_error');
  assert.equal(classifyProbe({ status: 404 }).pass, false);
});

test('computeCacheHitRate: mianownik 0 daje null, NIE 0 ani 1', () => {
  // Klasa błędu: gdyby brak sygnału cache liczył się jako miss, „0%" wyglądałoby
  // jak realne niespełnienie budżetu; gdyby jako hit — jak fałszywa zieleń.
  const noSignal = computeCacheHitRate([
    { url: '/a', cacheStatus: null, ms: 50 },
    { url: '/b', cacheStatus: undefined, ms: 50 }
  ]);
  assert.equal(noSignal.rate, null);
  assert.equal(noSignal.denominator, 0);
  assert.equal(noSignal.no_cache_signal, 2);
  assert.equal(noSignal.signal_breakdown.none, 2);

  const mixed = computeCacheHitRate([
    { url: '/a', cacheStatus: 'HIT' },
    { url: '/b', cacheStatus: 'HIT' },
    { url: '/c', cacheStatus: 'MISS' },
    { url: '/d', cacheStatus: 'STALE' },
    { url: '/e', cacheStatus: null, ms: 10 }
  ]);
  assert.equal(mixed.hits, 2);
  assert.equal(mixed.misses, 2);
  assert.equal(mixed.denominator, 4);
  assert.equal(mixed.rate, 0.5);
  assert.equal(mixed.no_cache_signal, 1);
  assert.equal(mixed.signal_breakdown.header, 4);
});

test('classifyCacheSample: para cold/warm ratuje pomiar, gdy nagłówka nie ma', () => {
  // Zmierzone na tym buildzie: 36/36 próbek BEZ x-nextjs-cache, bo AD-14/ADR-152
  // dotyczą DATA CACHE (unstable_cache), a nie full route cache. Bez sygnału
  // parowanego hit-rate byłby na zawsze „nierozstrzygnięty" mimo działającego cache'u.
  const cold = new Map([['/pl/products/a', 400], ['/pl/products/b', 400]]);

  // Warm serve ≥2× szybszy ⇒ trafienie.
  assert.deepEqual(classifyCacheSample({ url: '/pl/products/a', ms: 80, cacheStatus: null }, cold), {
    hit: true,
    signal: 'paired_latency'
  });
  // Brak przyspieszenia ⇒ pudło, nie „nie wiadomo".
  assert.deepEqual(classifyCacheSample({ url: '/pl/products/b', ms: 390, cacheStatus: null }, cold), {
    hit: false,
    signal: 'paired_latency'
  });
  // Nagłówek jest autorytatywny i wygrywa z heurystyką czasu.
  assert.deepEqual(classifyCacheSample({ url: '/pl/products/a', ms: 390, cacheStatus: 'HIT' }, cold), {
    hit: true,
    signal: 'header'
  });
  // Brak pary i brak nagłówka ⇒ null, próbka poza mianownikiem.
  assert.deepEqual(classifyCacheSample({ url: '/nieznany', ms: 10, cacheStatus: null }, cold), {
    hit: null,
    signal: 'none'
  });
});

test('percentile: raportuje liczbę próbek (p95 z 3 próbek nie jest p95)', () => {
  const empty = percentile([]);
  assert.equal(empty.value, null);
  assert.equal(empty.samples, 0);

  const small = percentile([100, 200, 300]);
  assert.equal(small.samples, 3); // liczba próbek MUSI być widoczna w evidence
  assert.equal(small.value, 300);

  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const p95 = percentile(values);
  assert.equal(p95.value, 95);
  assert.equal(p95.samples, 100);
});

test('evaluateBudget: RED poniżej progu AD-14, GREEN po poprawce, osobny stan „nierozstrzygnięte"', () => {
  const p95Ok = { value: 400, samples: 40 };

  // RED — hit-rate poniżej 60%.
  const red = evaluateBudget({ hitRate: { hits: 4, denominator: 10, rate: 0.4, no_cache_signal: 0 }, p95: p95Ok });
  assert.equal(red.pass, false);
  assert.ok(red.findings.some((f) => f.rule === 'HIT_RATE_BELOW_BUDGET'));

  // GREEN — te same progi, poprawiony wynik. Progi NIE są ruszane.
  const green = evaluateBudget({ hitRate: { hits: 7, denominator: 10, rate: 0.7, no_cache_signal: 0 }, p95: p95Ok });
  assert.equal(green.pass, true);
  assert.deepEqual(green.findings, []);

  // RED — p95 ponad 800 ms.
  const slow = evaluateBudget({
    hitRate: { hits: 9, denominator: 10, rate: 0.9, no_cache_signal: 0 },
    p95: { value: 1200, samples: 40 }
  });
  assert.ok(slow.findings.some((f) => f.rule === 'P95_ABOVE_BUDGET'));

  // Nierozstrzygnięte ≠ PASS — brak sygnału cache nie może dać zieleni.
  const inconclusive = evaluateBudget({
    hitRate: { hits: 0, denominator: 0, rate: null, no_cache_signal: 32 },
    p95: p95Ok
  });
  assert.equal(inconclusive.pass, false);
  assert.ok(inconclusive.findings.some((f) => f.rule === 'HIT_RATE_INCONCLUSIVE'));
});

test('parsePortOwners: wyciąga PID listenera (podstawa asercji bindu)', () => {
  // Odtworzenie Sprint-3: na porcie siedzi OBCY next-server z innego builda.
  const ss = [
    'State  Recv-Q Send-Q Local Address:Port  Peer Address:Port',
    'LISTEN 0      511          0.0.0.0:3182       0.0.0.0:*    users:(("next-server",pid=1808775,fd=21))',
    'LISTEN 0      511          0.0.0.0:3001       0.0.0.0:*    users:(("next-server",pid=1808447,fd=21))'
  ].join('\n');

  assert.deepEqual(parsePortOwners(ss, 3182), [1808775]);
  assert.deepEqual(parsePortOwners(ss, 3001), [1808447]);
  // Port bez listenera ⇒ pusta lista ⇒ asercja bindu w skrypcie zawodzi (NEEDS-LIVE-RUN).
  assert.deepEqual(parsePortOwners(ss, 3999), []);
});

test('findNodeBuiltinLeaks: RED na przecieku node:fs do chunku klienckiego (klasa Sprint-1)', () => {
  const leaking = findNodeBuiltinLeaks([
    { file: 'static/chunks/app/page-abc.js', source: 'var a=require("node:fs");var b=1;' }
  ]);
  assert.equal(leaking.length, 1);
  assert.equal(leaking[0].specifier, 'node:fs');
  assert.equal(leaking[0].file, 'static/chunks/app/page-abc.js');

  // GREEN po poprawce (moduł server-only zniknął z chunku klienckiego).
  assert.deepEqual(
    findNodeBuiltinLeaks([{ file: 'static/chunks/app/page-abc.js', source: 'var b=1;' }]),
    []
  );

  // Wielokrotne wystąpienie tego samego specyfikatora w pliku raportujemy raz.
  const deduped = findNodeBuiltinLeaks([
    { file: 'c.js', source: 'import"node:path";import"node:path";import"node:crypto";' }
  ]);
  assert.deepEqual(deduped.map((f) => f.specifier).sort(), ['node:crypto', 'node:path']);
});

test('buildRouteMatrix: KAŻDA klasa × KAŻDY locale (zbiorcze N/N ukrywa, która padła)', () => {
  const rows = buildRouteMatrix({
    locales: ['pl', 'ua', 'de', 'en'],
    categorySlug: 'twarz',
    pdpHandles: ['a', 'b']
  });

  for (const locale of ['pl', 'ua', 'de', 'en']) {
    for (const routeClass of ['categories_index', 'categories', 'pdp', 'checkout_entry']) {
      assert.ok(
        rows.some((r) => r.locale === locale && r.routeClass === routeClass),
        `brak ${routeClass} dla /${locale}`
      );
    }
  }
  assert.ok(rows.some((r) => r.url === '/ua/categories/twarz'));
  assert.ok(rows.some((r) => r.url === '/de/products/b'));
  assert.ok(rows.some((r) => r.url === '/en/cart'));
});

test('describeEnvPresence: obecność, nigdy wartość (NFR4) — puste ≠ ustawione', () => {
  const shape = describeEnvPresence(
    { NEXT_PUBLIC_PAYLOAD_MARKET_ID: 'bonbeauty', REVALIDATE_SECRET: '', OTHER: '  ' },
    ['NEXT_PUBLIC_PAYLOAD_MARKET_ID', 'REVALIDATE_SECRET', 'OTHER', 'NIEUSTAWIONA']
  );
  assert.deepEqual(shape, {
    NEXT_PUBLIC_PAYLOAD_MARKET_ID: 'present',
    REVALIDATE_SECRET: 'EMPTY', // gotcha ADR-145: puste było historycznie niewidoczne
    OTHER: 'EMPTY',
    NIEUSTAWIONA: 'absent'
  });
  // Żadna wartość nie może wyciec do evidence.
  assert.ok(!JSON.stringify(shape).includes('bonbeauty'));
});

// ───────────────────────────────────────────────────────────────────────────
// Kontrakt kształtu evidence (klasa 5-4-F4: producent nie umiał wyprodukować
// pól, które artefakt niósł). Test-the-test: każdy przypadek pokazuje RED na
// wejściu odtwarzającym zmierzony rozjazd i GREEN po poprawce.
// ───────────────────────────────────────────────────────────────────────────

test('assertEvidenceShape: GREEN na kształcie, który producent faktycznie emituje', () => {
  const result = assertEvidenceShape(minimalEvidence());
  assert.deepEqual(result.undeclared, []);
  assert.deepEqual(result.missing, []);
  assert.equal(result.ok, true);
});

test('assertEvidenceShape: RED na polu dopisanym RĘCZNIE do artefaktu (klasa 5-4-F4)', () => {
  // Dokładnie ten rozjazd: review-fix 5.4 dopisał do evidence pola, których
  // skrypt nie emitował. Kontrakt musi to nazwać, a nie przepuścić.
  const result = assertEvidenceShape(minimalEvidence({ recznie_dopisane_pole: 'x' }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.undeclared, ['recznie_dopisane_pole']);
});

test('assertEvidenceShape: RED, gdy kod przestał ustawiać pole wymagane kontraktem', () => {
  const evidence = minimalEvidence();
  delete evidence.promote_usable;
  const result = assertEvidenceShape(evidence);
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes('promote_usable'));
});

test('assertEvidenceShape: state COMPLETE wymaga pełnego zestawu pomiarów', () => {
  // „Domknięty" przebieg bez macierzy i bez perf to nie jest domknięty przebieg.
  const result = assertEvidenceShape(minimalEvidence({ state: 'COMPLETE' }));
  assert.equal(result.ok, false);
  assert.ok(result.missing.includes('http_matrix.per_class_per_locale'));
  assert.ok(result.missing.includes('perf_budget.nfr10_cardinality'));
});

test('assertEvidenceShape: nieznany state jest RED (RUNNING nigdy nie jest werdyktem)', () => {
  const result = assertEvidenceShape(minimalEvidence({ state: 'ZIELONY' }));
  assert.equal(result.ok, false);
  assert.equal(result.bad_state, 'ZIELONY');
});

test('emitContract: kontrakt jest maszynowy i pokrywa pola czytane przez assembler AD-15', () => {
  const contract = emitContract();
  for (const field of ['promote_usable', 'regeneration_required', 'state', 'deferred_findings',
    'build.skipped', 'pass', 'generated_at', 'market_id', 'release', 'tool_revision',
    'http_matrix.per_class_per_locale']) {
    assert.ok(contract.paths.includes(field), `assembler czyta ${field}, a kontrakt go nie zna`);
  }
  for (const field of CONTRACT_REQUIRED_ALWAYS) {
    assert.ok(contract.paths.includes(field), `${field} wymagane, a spoza kontraktu`);
  }
});

test('computeDeferredFindings: NFR-10 OTWARTY bez ramienia ×1, ZAMKNIĘTY po pomiarze', () => {
  const notMeasured = computeDeferredFindings({
    perf_budget: { nfr10_cardinality: { measurement_status: 'SKIPPED' } }
  });
  assert.equal(notMeasured.length, 1);
  assert.equal(notMeasured[0].rule, 'NFR10_BEFORE_STATE_NOT_MEASURED');
  assert.equal(notMeasured[0].severity, 'open');

  const measured = computeDeferredFindings({
    perf_budget: { nfr10_cardinality: { measurement_status: 'MEASURED' } }
  });
  assert.deepEqual(measured, []);

  // Brak sekcji perf w ogóle też jest brakiem pomiaru, nie zieleń.
  assert.equal(computeDeferredFindings({}).length, 1);
});

test('perfRoutesFor: ramię ×1 i ×4 mierzą TE SAME URL-e /pl (porównanie like-for-like)', () => {
  const x1 = perfRoutesFor(['pl'], ['a', 'b']).map((r) => r.url);
  const x4 = perfRoutesFor(['pl', 'ua', 'de', 'en'], ['a', 'b'])
    .filter((r) => r.locale === 'pl')
    .map((r) => r.url);
  assert.deepEqual(x1, x4);
  assert.ok(x1.includes('/pl/categories'));
  assert.ok(x1.includes('/pl/products/b'));
});

test('compareCardinalityArms: surowa delta, bez werdyktu i bez dzielenia przez zero', () => {
  const armX4 = {
    cold_p95_ms: { value: 200, samples: 9 },
    warm_p95_ms: { value: 60, samples: 9 },
    warm_hit_rate: { misses: 3 }
  };
  const armX1 = {
    cold_p95_ms: { value: 160, samples: 9 },
    warm_p95_ms: { value: 50, samples: 9 },
    warm_hit_rate: { misses: 1 }
  };
  const cmp = compareCardinalityArms(armX4, armX1);
  assert.equal(cmp.cold_p95_delta_ms, 40);
  assert.equal(cmp.cold_p95_ratio_x4_over_x1, 1.25);
  assert.equal(cmp.miss_delta, 2);
  assert.ok(!('pass' in cmp), 'skrypt nie wystawia werdyktu na osi bez progu w AD-14');

  const nulls = compareCardinalityArms(
    { cold_p95_ms: { value: null }, warm_p95_ms: { value: null }, warm_hit_rate: { misses: 0 } },
    { cold_p95_ms: { value: 0 }, warm_p95_ms: { value: null }, warm_hit_rate: { misses: 0 } }
  );
  assert.equal(nulls.cold_p95_delta_ms, null);
  assert.equal(nulls.cold_p95_ratio_x4_over_x1, null);
});
