#!/usr/bin/env node
/**
 * prod-build-smoke.mjs — v1.14.0 Story 5.4 (FR-9, NFR-1/2, NFR-10; AD-14, AD-15 pkt 3).
 *
 * JEDNA komenda promote-envelope: prod build storefrontu na REALNEJ gp-config
 * marketu → higiena środowiska → macierz HTTP → dowód renderu w przeglądarce →
 * budżet perf AD-14 → jeden plik evidence.
 *
 * ══ Dlaczego to NIE jest trzeci harness ══
 * Dowód renderu (AC3) NIE jest tu reimplementowany — ten skrypt odpala ZASTANY spec
 * `GP/e2e/tests/live-render-smoke.spec.ts` (Gate A-lite) i konsumuje jego evidence
 * zastanym walidatorem `_grow/tools/validate_live_render_smoke.py`. Spec pisze w
 * SWOIM formacie; drugi format evidence byłby długiem, który musiałaby skleić 5.5.
 *
 * Pokrycie **PDP × locale w głąb** (wszystkie handle katalogu, taksonomia
 * `404_gate_*`) zostaje tam, gdzie było — w `scripts/smoke-pdp-locales.mjs`
 * (Story 1.3/1.4). Ten skrypt go NIE woła i NIE duplikuje: mierzy inną oś —
 * KLASY route'ów (katalog / kategorie / PDP / checkout-entry) na próbce handli.
 * Oba są komplementarne i uruchamiane osobno (patrz runbook).
 *
 * Własna warstwa tego pliku to wyłącznie to, czego żaden z nich nie ma: higiena
 * środowiska + asercja bindu (AC5), macierz KLAS route'ów (AC2) i pomiar AD-14 (AC4).
 *
 * ══ Cztery zmierzone miny, które ten skrypt zamyka ══
 *  1. dev 200 ≠ prod build (Sprint-1): moduły `node:*` przeciekały do bundle'a
 *     klienckiego przez importy barelowe. `next dev` tego nie widzi. Stąd: build
 *     jest obowiązkowy, a artefakt `.next` jest skanowany (AC1).
 *  2. false-FAIL 452 kombinacji (Sprint-3): zombie `next-server` (EADDRINUSE),
 *     stale fetch-cache, współdzielony `.next`. Stąd pre-flight + asercja bindu:
 *     „port odpowiada" NIE znaczy „to nasz proces z tego builda" (AC5).
 *  3. brak `NEXT_PUBLIC_PAYLOAD_MARKET_ID` ⇒ PDP 500 po Sprint-3 (gotcha ADR-145,
 *     historycznie niewidoczna, bo skin renderował mimo pustej zmiennej). Stąd
 *     twarda bramka na niepustą wartość PRZED buildem (AC1).
 *  4. CSP/hydratacja (escape v1.10.0): SSR 200 przy blank page. Stąd AC3 osobno
 *     od AC2 — 200 z HTTP i „renderuje się" to dwa rozłączne fakty i mają
 *     rozłączne pola w evidence.
 *
 * ══ Kody wyjścia (rozłączne — „nie wystartował stack" nigdy nie wygląda jak PASS) ══
 *   0  PASS            — wszystkie AC spełnione w tym przebiegu.
 *   1  FAIL            — realne niespełnienie AC (non-200, blank render, przeciek
 *                        `node:*`, próg AD-14 niespełniony).
 *   2  NEEDS-LIVE-RUN  — środowisko niedostępne (backend down, pusty katalog, brak
 *                        bindu, build nieuruchamialny). NIE jest to zieleń ani FAIL AC.
 *   3  TOOL-ERROR      — bug narzędzia albo błąd konfiguracji wywołania (brak
 *                        `NEXT_PUBLIC_PAYLOAD_MARKET_ID`, nieparsowalne argumenty).
 *
 * ══ Kontrakt kształtu evidence (review-fix 2026-08-01, klasa 5-4-F4) ══
 * Zmierzony rozjazd: evidence 5-4 niosło pola (`state`, `deferred_findings`,
 * `promote_usable`, `tool_revision`, `route_class_notes`, `categories_index`),
 * których TEN skrypt nie umiał wyprodukować — powstały ręczną edycją artefaktu
 * podczas review-fix 5.4. Rerun odtworzyłby brak, a punkt 3 AD-15 i tak byłby
 * czerwony. Klasa („producent może sfabrykować evidence") jest zamknięta
 * DWUSTRONNIE:
 *   1. `EVIDENCE_CONTRACT` jest jedynym źródłem kształtu, a `assertEvidenceShape`
 *      biegnie PRZED każdym zapisem — pole, którego kod nie zadeklarował, albo
 *      zadeklarowane pole, którego kod nie ustawił, daje TOOL-ERROR (exit 3),
 *      nie cichy zapis;
 *   2. `--emit-contract` wypuszcza ten kontrakt maszynowo, a
 *      `_grow/tools/validate_prod_build_smoke_evidence_shape.py` porównuje go
 *      z COMMITOWANYM artefaktem i z listą pól, które czyta assembler AD-15
 *      (`run_v1140_promote_envelope.PROD_BUILD_SMOKE_CONSUMED_FIELDS`). Ręczna
 *      edycja evidence jest wtedy widoczna jako czerwony walidator, offline.
 *
 * ══ Użycie ══
 *   node scripts/prod-build-smoke.mjs \
 *     [--port 3182]                # port dedykowany; NIE współdzielony z innym stackiem
 *     [--market bonbeauty]         # default: NEXT_PUBLIC_PAYLOAD_MARKET_ID
 *     [--release v1.14.0]          # release-scope evidence (domyślna ścieżka --out)
 *     [--backend-url http://localhost:9002]
 *     [--out <evidence.json>]      # default: evidence release'u --release
 *     [--render-evidence <path>]   # gdzie spec Playwright zapisuje swój JSON
 *     [--pdp-samples 8]            # ile handli do macierzy PDP i pomiaru perf
 *     [--skip-build]               # TYLKO iteracja nad narzędziem; evidence dostaje
 *                                  # build.skipped=true i pass=false (nie dowodzi AC1)
 *     [--skip-render]              # pomija AC3; evidence dostaje render.skipped=true
 *                                  # i pass=false — nigdy cichy PASS
 *     [--skip-nfr10-axis]          # pomija pomiar osi kardynalności NFR-10; evidence
 *                                  # dostaje OTWARTY deferred finding i promote_usable=false
 *     [--emit-contract]            # wypisz kontrakt kształtu evidence (JSON) i wyjdź 0
 *
 * Sekrety: evidence zapisuje WYŁĄCZNIE nazwy zmiennych i ich obecność
 * (`present` / `EMPTY` / `absent`), nigdy wartości (NFR4).
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Lifecycle prod-buildu jest WSPÓŁDZIELONY ze story 5.5 (HG-13) ──────────
// Higiena środowiska, start `next start` i asercja bindu były tu zaimplementowane
// przez story 5.4. Story 5.5 potrzebuje ich 1:1 (AC1: pre-flight jest częścią
// pomiaru), więc zostały PRZENIESIONE do `scripts/lib/prod-stack-lifecycle.mjs`
// i są importowane przez oba skrypty. Kopia dałaby trzeci, dryfujący harness.
// Re-eksport poniżej utrzymuje zastane importy testów jednostkowych 5.4.
import {
  NeedsLiveRun,
  ToolError,
  describeEnvPresence,
  killStaleListeners,
  parsePortOwners,
  purgeBuildArtifacts,
  readEnvLocal,
  redactBuildLog,
  runBuild,
  startAndAssertBind
} from './lib/prod-stack-lifecycle.mjs';

export {
  NeedsLiveRun,
  ToolError,
  describeEnvPresence,
  killStaleListeners,
  parsePortOwners,
  purgeBuildArtifacts,
  readEnvLocal,
  redactBuildLog,
  runBuild,
  startAndAssertBind
};

const LOCALES = ['pl', 'ua', 'de', 'en'];

/**
 * Klasy route'ów wymagane przez AC2. Ścieżki są konkretne dla App Routera storefrontu.
 *
 * `categories_index` (a nie `catalog`): ta klasa sonduje `/{locale}/categories`,
 * czyli INDEKS drzewa kategorii. Etykieta `catalog` z pierwszego przebiegu 5.4
 * sugerowała listing całego katalogu, którego ten URL nie renderuje — evidence
 * z review-fixu 5.4 nazywało tę klasę już poprawnie, a skrypt nie. Rozjazd
 * nazwy jest tu naprawiony po stronie PRODUCENTA.
 */
const ROUTE_CLASSES = ['categories_index', 'categories', 'pdp', 'checkout_entry'];

/** Co dokładnie mierzy każda klasa — bez tego macierz jest nieinterpretowalna. */
const ROUTE_CLASS_NOTES = Object.freeze({
  categories_index: '/{locale}/categories — index drzewa kategorii',
  categories: '/{locale}/categories/<slug> — listing produktów kategorii',
  pdp: '/{locale}/products/<handle> — próbka handli z katalogu (--pdp-samples)',
  checkout_entry:
    'checkout_entry = /{locale}/cart. /{locale}/checkout jest ŚWIADOMIE POZA ZAKRESEM tego ' +
    "smoke'u: route wymaga aktywnego `cart_id` w sesji, a bezstanowa sonda (`redirect: manual`) " +
    'dostałaby 3xx, czyli FAIL nieodróżnialny od regresu. Pokrycie /checkout zostaje w E2E ' +
    '(koszyk → checkout). Punkt 3 checklisty AD-15 NIE może być czytany jako „checkout przeszedł ' +
    'prod-build smoke".'
});

/**
 * Progi AD-14 (`[ASSUMPTION]` zatwierdzone jako domyślne). NIE wolno ich obniżyć,
 * żeby smoke przeszedł — AD-14 dopuszcza korektę liczb DECYZJĄ, nie edytem
 * w skrypcie mierzącym. Zmiana tych stałych bez ADR/decyzji jest naruszeniem AC4.
 */
const AD14 = Object.freeze({
  hitRateMin: 0.6,
  p95MaxMs: 800,
  revalidateProductsSec: 300,
  revalidateCategoriesSec: 600
});

/** Status progów — trafia do evidence razem z liczbami, żeby nie udawały ratyfikowanych. */
const AD14_STATUS =
  '[ASSUMPTION] — AD-14 (specs/releases/v1.14.0/architecture.md), liczby niezratyfikowane; ' +
  'korekta wyłącznie decyzją, nigdy edytem w skrypcie mierzącym';

const HIT_RATE_METHOD =
  "PROXY LATENCYJNE, NIE odczyt licznika cache'u: trafienie = warm serve tego samego URL-a co " +
  'najmniej 2× szybszy niż cold serve w przebiegu 1. Miesza data cache z rozgrzaniem JIT, ' +
  'reużyciem połączenia i page cache OS. Wiarygodne przy progu 60% (duży zapas), NIEODPOWIEDNIE ' +
  'do porównań o granulacji <10 pp. Nagłówek x-nextjs-cache jest używany, gdy występuje — patrz ' +
  'hit_rate.signal_breakdown.';

/** Zmienne, których obecność (nie wartość) trafia do evidence jako kształt configu buildu. */
const BUILD_ENV_KEYS = [
  'NEXT_PUBLIC_PAYLOAD_MARKET_ID',
  'PAYLOAD_API_URL',
  'MEDUSA_BACKEND_URL',
  'NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_DEFAULT_REGION',
  'NEXT_PUBLIC_SITE_NAME',
  'NEXT_PUBLIC_VENDOR_URL',
  'REVALIDATE_SECRET'
];

/** Builtiny Node, których obecność w bundlu KLIENCKIM jest klasą awarii ze Sprint-1. */
const NODE_BUILTIN_LEAK_RE =
  /(?:"|'|`)node:(fs|path|os|crypto|child_process|net|http|https|stream|zlib|worker_threads|dns|tls|process|util|buffer)(?:\/[a-z]+)?(?:"|'|`)/g;

// ───────────────────────────────────────────────────────────────────────────
// Kontrakt kształtu evidence — JEDYNE źródło prawdy o tym, co ten producent
// emituje. Węzeł `LEAF` jest nieprzezroczysty (kontrakt nie schodzi głębiej);
// `{ '*': node }` opisuje klucze dynamiczne (locale, nazwy zmiennych, komórki
// macierzy). Pola, które CZYTA assembler AD-15, są rozwinięte jawnie — właśnie
// tam rozjazd producent↔konsument boli.
// ───────────────────────────────────────────────────────────────────────────

const LEAF = Symbol('leaf');

export const EVIDENCE_CONTRACT = Object.freeze({
  tool: LEAF,
  tool_revision: LEAF,
  state: LEAF,
  story: LEAF,
  release: LEAF,
  acceptance_criteria: LEAF,
  generated_at: LEAF,
  market_id: LEAF,
  base_url: LEAF,
  backend_url: LEAF,
  locales: LEAF,
  route_classes: LEAF,
  route_class_notes: { '*': LEAF },
  thresholds_ad14: LEAF,
  promote_usable: LEAF,
  regeneration_required: LEAF,
  regeneration_reason: LEAF,
  deferred_findings: LEAF,
  preflight: LEAF,
  build: {
    skipped: LEAF,
    env_presence: { '*': LEAF },
    env_presence_note: LEAF,
    mode: LEAF,
    exit_code: LEAF,
    duration_ms: LEAF,
    warnings: LEAF,
    tail: LEAF,
    result: LEAF
  },
  client_bundle_scan: LEAF,
  seed: LEAF,
  bind_assertion: LEAF,
  perf_budget: {
    method: LEAF,
    cache_measured: LEAF,
    hit_rate_method: LEAF,
    pass_1: LEAF,
    pass_2: LEAF,
    budget_verdict: LEAF,
    nfr10_cardinality: {
      method: LEAF,
      axis_measured: LEAF,
      what_this_is_not: LEAF,
      key_cardinality_factor: LEAF,
      arm_x4_all_locales: LEAF,
      arm_x1_pl_only: LEAF,
      like_for_like_pl_urls: LEAF,
      comparison: LEAF,
      measurement_status: LEAF,
      skipped_reason: LEAF
    },
    policy: LEAF
  },
  http_matrix: {
    urls_checked: LEAF,
    per_class_per_locale: { '*': { checked: LEAF, ok: LEAF, verdicts: LEAF } },
    failures: LEAF,
    note: LEAF
  },
  render_proof: LEAF,
  failures: LEAF,
  pass: LEAF,
  exit_code: LEAF,
  exit_code_semantics: LEAF
});

/** Pola obecne w KAŻDYM zapisie, także w znaczniku RUNNING i na ścieżkach exit 2/3. */
export const CONTRACT_REQUIRED_ALWAYS = Object.freeze([
  'tool', 'tool_revision', 'state', 'story', 'release', 'generated_at', 'market_id',
  'promote_usable', 'regeneration_required', 'regeneration_reason', 'deferred_findings',
  'pass', 'exit_code'
]);

/** Dodatkowo wymagane, gdy przebieg DOSZEDŁ do końca (`state: COMPLETE`). */
export const CONTRACT_REQUIRED_COMPLETE = Object.freeze([
  'build.skipped', 'client_bundle_scan', 'seed', 'bind_assertion',
  'perf_budget.pass_2', 'perf_budget.budget_verdict', 'perf_budget.nfr10_cardinality',
  'http_matrix.per_class_per_locale', 'render_proof', 'failures', 'exit_code_semantics'
]);

/** Stany przebiegu. `RUNNING` nigdy nie jest werdyktem — assembler odrzuca go wprost. */
export const EVIDENCE_STATES = Object.freeze(['RUNNING', 'COMPLETE', 'ABORTED']);

function contractPaths(node = EVIDENCE_CONTRACT, prefix = '') {
  if (node === LEAF) return [prefix];
  const out = prefix ? [prefix] : [];
  for (const [key, child] of Object.entries(node)) {
    out.push(...contractPaths(child, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** Kontrakt w postaci maszynowej — konsumowany przez `--emit-contract`. */
export function emitContract() {
  return {
    tool: 'prod-build-smoke',
    contract_version: 2,
    paths: contractPaths().sort(),
    required_always: [...CONTRACT_REQUIRED_ALWAYS],
    required_when_complete: [...CONTRACT_REQUIRED_COMPLETE],
    states: [...EVIDENCE_STATES],
    note:
      'Ścieżki oznaczone jako liście są nieprzezroczyste — kontrakt nie schodzi w nie głębiej. ' +
      'Pola czytane przez assembler AD-15 są rozwinięte jawnie.'
  };
}

function getPath(obj, dotted) {
  let cur = obj;
  for (const segment of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(segment in cur)) return undefined;
    cur = cur[segment];
  }
  return cur;
}

/**
 * Porównanie FAKTYCZNIE emitowanego obiektu z kontraktem. Uruchamiane przed
 * KAŻDYM zapisem evidence: pole spoza kontraktu albo brak pola wymaganego to
 * TOOL-ERROR, nie cichy zapis. Dzięki temu dryf kodu względem kontraktu jest
 * natychmiastowy i widoczny, a nie odkrywany rok później przez assembler.
 */
export function assertEvidenceShape(evidence, { state } = {}) {
  const undeclared = [];
  const walk = (value, node, prefix) => {
    if (node === LEAF || value === null || typeof value !== 'object' || Array.isArray(value)) return;
    const wildcard = node['*'];
    for (const [key, child] of Object.entries(value)) {
      const dotted = prefix ? `${prefix}.${key}` : key;
      const childNode = key in node ? node[key] : wildcard;
      if (childNode === undefined) {
        undeclared.push(dotted);
        continue;
      }
      walk(child, childNode, dotted);
    }
  };
  walk(evidence, EVIDENCE_CONTRACT, '');

  const effectiveState = state ?? evidence.state;
  const required = [
    ...CONTRACT_REQUIRED_ALWAYS,
    ...(effectiveState === 'COMPLETE' ? CONTRACT_REQUIRED_COMPLETE : [])
  ];
  const missing = required.filter((p) => getPath(evidence, p) === undefined);

  if (!EVIDENCE_STATES.includes(effectiveState)) {
    return { ok: false, undeclared, missing, bad_state: effectiveState };
  }
  return { ok: undeclared.length === 0 && missing.length === 0, undeclared, missing, bad_state: null };
}

/**
 * Rewizja narzędzia = sha256 TEGO pliku + współdzielonego lifecycle'u. Etykieta
 * pisana ręcznie („pre-review-fix") mogłaby zostać przepisana w artefakcie i nic
 * by jej nie sprawdziło; skrót liczy się z kodu, który faktycznie biegł.
 */
export function computeToolRevision(files) {
  const hash = crypto.createHash('sha256');
  for (const file of files) hash.update(fs.readFileSync(file));
  return `sha256:${hash.digest('hex').slice(0, 16)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Czyste funkcje (bez sieci/fs/procesów) — pokryte testem jednostkowym.
// Wzorzec z review 1-3/1-4: klasyfikator musi dać się pokazać jako RED na
// wejściu odtwarzającym awarię i GREEN po poprawce, bez żywego stacku.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Werdykt pojedynczej sondy HTTP. Fail-closed: brak odpowiedzi / timeout / 5xx
 * to FAIL, nigdy „pewnie OK". `null` status (wyjątek fetch) NIE może zniknąć.
 */
export function classifyProbe({ status, error }) {
  if (error) return { verdict: 'fetch_error', pass: false };
  if (status === 200) return { verdict: '200_ok', pass: true };
  if (status == null) return { verdict: 'no_response', pass: false };
  if (status >= 500) return { verdict: `http_5xx_${status}`, pass: false };
  return { verdict: `http_${status}`, pass: false };
}

/**
 * Próbka przebiegu 2 jest trafieniem cache'u, jeśli warm serve jest co najmniej
 * dwukrotnie szybszy od cold serve tego samego URL-a w przebiegu 1.
 */
const PAIRED_HIT_RATIO = 0.5;

/**
 * Klasyfikacja pojedynczej próbki przebiegu 2 na HIT/MISS.
 *
 * ══ Dlaczego nie sam nagłówek `x-nextjs-cache` ══
 * Zmierzone na tym buildzie: 36/36 próbek BEZ tego nagłówka. To nie jest luka
 * pomiaru — to inny cache. `x-nextjs-cache` opisuje FULL ROUTE CACHE, a AD-14
 * i ADR-152 dotyczą DATA CACHE (`unstable_cache` w `src/lib/data/locale-cache.ts`).
 * Mierzone route'y renderują się dynamicznie (PDP bez `export const revalidate`,
 * `/cart` = `force-dynamic`), więc nagłówek nie ma prawa się pojawić.
 *
 * Stąd dwa sygnały, w kolejności wiarygodności, z JAWNYM śladem, który zadziałał:
 *   1. `x-nextjs-cache` — autorytatywny, gdy jest (route z pełnym cache'em route'u),
 *   2. para cold/warm — ten sam URL w przebiegu 1 (zimny) i 2 (ciepły); trafienie
 *      = warm serve ≥2× szybszy. To PROXY, nie odczyt licznika cache'u, i evidence
 *      musi to nazywać wprost.
 * Brak obu ⇒ `no_signal` — próbka NIE wchodzi do mianownika, ale jest policzona.
 *
 * Warunek konieczny sensowności sygnału 2: przebieg 1 MUSI być zimny. Dlatego
 * pomiar perf idzie PRZED macierzą HTTP — macierz odpytuje te same URL-e i
 * rozgrzałaby cache, po czym „brak przyspieszenia" wyglądałby jak brak cache'u.
 */
export function classifyCacheSample(sample, coldByUrl) {
  const header = (sample.cacheStatus ?? '').toUpperCase();
  if (header === 'HIT') return { hit: true, signal: 'header' };
  if (header === 'MISS' || header === 'STALE') return { hit: false, signal: 'header' };
  const cold = coldByUrl.get(sample.url);
  if (cold != null && Number.isFinite(cold) && Number.isFinite(sample.ms)) {
    return { hit: sample.ms <= cold * PAIRED_HIT_RATIO, signal: 'paired_latency' };
  }
  return { hit: null, signal: 'none' };
}

/**
 * Hit-rate przebiegu 2. Próbki bez sygnału NIE wchodzą do mianownika — wliczenie
 * ich mierzyłoby co innego niż AD-14 — ale ich liczba jest raportowana JAWNIE,
 * a mianownik 0 daje `rate: null` (pomiar nierozstrzygnięty), nigdy 0 ani 1:
 * „nie dało się zmierzyć" nie może wyglądać jak „zmieściliśmy się w budżecie".
 */
export function computeCacheHitRate(samples, coldByUrl = new Map()) {
  let hits = 0;
  let misses = 0;
  let noSignal = 0;
  const bySignal = { header: 0, paired_latency: 0, none: 0 };
  for (const s of samples) {
    const { hit, signal } = classifyCacheSample(s, coldByUrl);
    bySignal[signal]++;
    if (hit === true) hits++;
    else if (hit === false) misses++;
    else noSignal++;
  }
  const denominator = hits + misses;
  return {
    hits,
    misses,
    no_cache_signal: noSignal,
    denominator,
    rate: denominator === 0 ? null : hits / denominator,
    signal_breakdown: bySignal,
    paired_hit_ratio: PAIRED_HIT_RATIO
  };
}

/**
 * p95 metodą nearest-rank. Zwraca też `samples` — p95 z 3 próbek nie jest p95
 * i liczba próbek MUSI być w evidence (AC4), inaczej liczba jest nieinterpretowalna.
 */
export function percentile(values, p = 95) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return { value: null, samples: 0 };
  const rank = Math.ceil((p / 100) * sorted.length);
  return { value: sorted[Math.min(rank, sorted.length) - 1], samples: sorted.length };
}

/**
 * Przeciek `node:*` do bundle'a KLIENCKIEGO (klasa awarii Sprint-1). Wejście:
 * `[{ file, source }]` z `.next/static/chunks`. Kontrola ARTEFAKTU, nie deklaracja
 * w opisie — build potrafi przejść, a moduł i tak wyląduje w chunku klienckim.
 */
export function findNodeBuiltinLeaks(chunks) {
  const findings = [];
  for (const { file, source } of chunks) {
    const seen = new Set();
    for (const m of String(source).matchAll(NODE_BUILTIN_LEAK_RE)) {
      const specifier = `node:${m[1]}`;
      if (seen.has(specifier)) continue;
      seen.add(specifier);
      findings.push({ file, specifier, excerpt: String(source).slice(Math.max(0, m.index - 60), m.index + 60) });
    }
  }
  return findings;
}

/** Macierz AC2: KAŻDA klasa × KAŻDY locale. Zbiorcze „N/N PASS" ukrywa, która klasa padła. */
export function buildRouteMatrix({ locales, categorySlug, pdpHandles }) {
  const rows = [];
  for (const locale of locales) {
    rows.push({ routeClass: 'categories_index', locale, url: `/${locale}/categories` });
    rows.push({ routeClass: 'categories', locale, url: `/${locale}/categories/${categorySlug}` });
    for (const handle of pdpHandles) {
      rows.push({ routeClass: 'pdp', locale, url: `/${locale}/products/${handle}` });
    }
    rows.push({ routeClass: 'checkout_entry', locale, url: `/${locale}/cart` });
  }
  return rows;
}

/**
 * Werdykt budżetu AD-14 dla PRZEBIEGU 2. Nierozstrzygnięty pomiar (mianownik 0
 * albo zero próbek p95) jest osobnym stanem `inconclusive` — NIE PASS.
 */
export function evaluateBudget({ hitRate, p95, thresholds = AD14 }) {
  const findings = [];
  if (hitRate.rate === null) {
    findings.push({
      rule: 'HIT_RATE_INCONCLUSIVE',
      detail: `brak próbek z sygnałem x-nextjs-cache (${hitRate.no_cache_signal} bez sygnału) — pomiar nierozstrzygnięty`
    });
  } else if (hitRate.rate < thresholds.hitRateMin) {
    findings.push({
      rule: 'HIT_RATE_BELOW_BUDGET',
      detail: `hit-rate ${hitRate.hits}/${hitRate.denominator} = ${(hitRate.rate * 100).toFixed(1)}% < ${thresholds.hitRateMin * 100}%`
    });
  }
  if (p95.value === null) {
    findings.push({ rule: 'P95_INCONCLUSIVE', detail: 'zero próbek czasu odpowiedzi' });
  } else if (p95.value > thresholds.p95MaxMs) {
    findings.push({
      rule: 'P95_ABOVE_BUDGET',
      detail: `p95 ${p95.value.toFixed(0)} ms (n=${p95.samples}) > ${thresholds.p95MaxMs} ms`
    });
  }
  return { pass: findings.length === 0, findings };
}

// ───────────────────────────────────────────────────────────────────────────
// Warstwa efektów.
// ───────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new ToolError(`nieznany argument pozycyjny: ${key}`);
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[name] = true;
    } else {
      args[name] = next;
      i++;
    }
  }
  return args;
}

const log = (msg) => console.log(`[prod-build-smoke] ${msg}`);

/** Kontrola artefaktu `.next` — AC1, wykonywalnie. */
function scanClientBundle(cwd) {
  const chunkDir = path.join(cwd, '.next', 'static', 'chunks');
  if (!fs.existsSync(chunkDir)) {
    throw new NeedsLiveRun(`brak ${chunkDir} — build nie wyprodukował bundle'a klienckiego`);
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) files.push(full);
    }
  };
  walk(chunkDir);
  const chunks = files.map((file) => ({
    file: path.relative(cwd, file),
    source: fs.readFileSync(file, 'utf8')
  }));
  return { scanned_files: chunks.length, leaks: findNodeBuiltinLeaks(chunks) };
}

async function probe(baseUrl, url) {
  const started = process.hrtime.bigint();
  try {
    const response = await fetch(`${baseUrl}${url}`, { redirect: 'manual' });
    // Body musi zostać skonsumowane, inaczej czas nie obejmuje transferu.
    const body = await response.text();
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    return {
      status: response.status,
      ms,
      bytes: body.length,
      cacheStatus: response.headers.get('x-nextjs-cache'),
      error: null
    };
  } catch (error) {
    return {
      status: null,
      ms: Number(process.hrtime.bigint() - started) / 1e6,
      bytes: 0,
      cacheStatus: null,
      error: String(error?.message ?? error)
    };
  }
}

async function fetchCatalogSeed(backendUrl, publishableKey) {
  const headers = { 'x-publishable-api-key': publishableKey };
  const productsRes = await fetch(
    `${backendUrl}/store/products?limit=100&fields=handle,thumbnail,%2Bmetadata`,
    { headers }
  );
  if (!productsRes.ok) throw new NeedsLiveRun(`backend /store/products → HTTP ${productsRes.status}`);
  const productsPayload = await productsRes.json();
  if (typeof productsPayload.count !== 'number') {
    throw new NeedsLiveRun('backend nie zwrócił liczbowego `count` — kontrakt paginacji nieznany');
  }
  const categoriesRes = await fetch(`${backendUrl}/store/product-categories?limit=20&fields=handle`, { headers });
  if (!categoriesRes.ok) throw new NeedsLiveRun(`backend /store/product-categories → HTTP ${categoriesRes.status}`);
  const categoriesPayload = await categoriesRes.json();
  const categories = (categoriesPayload.product_categories ?? []).map((c) => c.handle).filter(Boolean);
  const handles = (productsPayload.products ?? []).map((p) => p.handle).filter(Boolean);
  if (handles.length === 0) throw new NeedsLiveRun('katalog pusty (0 handli) — nie ma czego smoke\'ować');
  if (categories.length === 0) throw new NeedsLiveRun('brak kategorii w backendzie — klasa `categories` niemierzalna');
  return { handles, categories, catalog_count: productsPayload.count };
}

/**
 * AC3 — dowód renderu z przeglądarki. Odpala ZASTANY spec Gate A-lite z GP/e2e
 * (nie duplikuje go), przekazując route'y przez `LIVE_RENDER_ROUTES` i nasz port
 * przez `BONBEAUTY_URL`. Evidence zostaje w formacie, który konsumuje
 * `_grow/tools/validate_live_render_smoke.py` — drugi format byłby długiem 5.5.
 */
function runLiveRenderSpec({ repoRoot, baseUrl, routes, evidencePath }) {
  const e2eDir = path.join(repoRoot, 'GP', 'e2e');
  if (!fs.existsSync(path.join(e2eDir, 'node_modules', '.bin', 'playwright'))) {
    throw new NeedsLiveRun(`brak zależności Playwright w ${e2eDir} (npm ci) — dowód renderu niewykonalny`);
  }
  if (fs.existsSync(evidencePath)) fs.rmSync(evidencePath); // stale evidence = false-PASS
  // Spec iteruje route'y W JEDNYM teście, a domyślny timeout projektu (30 s) był
  // ustawiony pod ~1 route (`LIVE_RENDER_ROUTES` default `/pl`). Przy 16 route'ach
  // test padał na timeoucie PRZED `writeEvidence`, więc evidence w ogóle nie
  // powstawało i walidator raportował NEEDS-LIVE-RUN — brak dowodu wyglądał jak
  // niedostępny stack. Skalujemy budżet do liczby route'ów (goto 25 s + 3 s
  // hydratacji + zapas), zamiast dopisywać drugi spec.
  const timeoutMs = 60_000 + routes.length * 35_000;
  const result = spawnSync(
    'node_modules/.bin/playwright',
    ['test', 'tests/live-render-smoke.spec.ts', '--project=bonbeauty', '--reporter=line',
     `--timeout=${timeoutMs}`],
    {
      cwd: e2eDir,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
      env: {
        ...process.env,
        GP_E2E_SKIP_WEB_SERVER: '1',
        BONBEAUTY_URL: baseUrl,
        LIVE_RENDER_ROUTES: routes.join(','),
        NODE_ENV: 'production'
      }
    }
  );
  return {
    exit_code: result.status,
    evidence_path: path.relative(repoRoot, evidencePath),
    tail: ((result.stderr || '') + (result.stdout || '')).split('\n').slice(-20).join('\n')
  };
}

/** Konsument evidence renderu — zastany walidator, nie druga implementacja reguł. */
function validateRenderEvidence({ repoRoot, evidencePath }) {
  const result = spawnSync(
    'python3',
    ['_grow/tools/validate_live_render_smoke.py', evidencePath, '--root', '.', '--json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  let report = null;
  try {
    report = JSON.parse(result.stdout || result.stderr || 'null');
  } catch {
    report = null;
  }
  return { exit_code: result.status, report, raw: (result.stdout || result.stderr || '').slice(-2000) };
}

/**
 * Stan widoczny dla top-level catch. Bez tego ścieżki exit 2/3 kończyły się BEZ
 * zapisu evidence (zmierzone jako 5-4-F1): na dysku zostawał plik z POPRZEDNIEGO,
 * zielonego przebiegu, a konsument maszynowy — który czyta PLIK, nie stdout —
 * widział zieleń nieudanego przebiegu.
 */
const runState = { evidence: null, outPath: null };

async function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv);

  if (args['emit-contract'] === true) {
    process.stdout.write(`${JSON.stringify(emitContract(), null, 2)}\n`);
    process.exit(0);
  }

  const envLocal = readEnvLocal(cwd);
  const env = { ...process.env, ...envLocal, ...process.env }; // process.env ma priorytet
  const repoRoot = path.resolve(cwd, '..', '..');

  const port = Number(args.port ?? 3182);
  if (!Number.isInteger(port) || port < 1024) throw new ToolError(`--port musi być liczbą ≥1024, dostałem: ${args.port}`);
  const marketId = String(args.market ?? env.NEXT_PUBLIC_PAYLOAD_MARKET_ID ?? '').trim();
  const release = String(args.release ?? 'v1.14.0');
  if (!/^v\d+\.\d+\.\d+$/.test(release)) throw new ToolError(`--release musi mieć postać vX.Y.Z, dostałem: ${release}`);
  const backendUrl = String(args['backend-url'] ?? env.MEDUSA_BACKEND_URL ?? 'http://localhost:9000');
  const publishableKey = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_PUBLISHABLE_API_KEY;
  const pdpSamples = Number(args['pdp-samples'] ?? 8);
  const skipBuild = args['skip-build'] === true;
  const skipRender = args['skip-render'] === true;
  const skipAxis = args['skip-nfr10-axis'] === true;
  const outPath = path.resolve(
    cwd,
    String(args.out ?? `../../_bmad-output/releases/${release}/implementation-artifacts/evidence/5-4-prod-build-smoke.json`)
  );
  const renderEvidencePath = path.resolve(
    cwd,
    String(args['render-evidence'] ?? '../e2e/test-results/live-render-smoke.json')
  );

  // ── AC1, bramka twarda: bez tej zmiennej mierzymy INNY system niż promote
  //    (po Sprint-3 brak ⇒ PDP 500). To błąd wywołania, nie środowiska ⇒ TOOL-ERROR.
  if (!marketId) {
    throw new ToolError(
      'NEXT_PUBLIC_PAYLOAD_MARKET_ID jest puste/nieustawione (ani --market). Po Sprint-3 brak tej ' +
        'zmiennej daje PDP 500 — smoke bez niej mierzy inny system niż promote (gotcha ADR-145).'
    );
  }
  if (!publishableKey) throw new ToolError('brak NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (env / .env.local)');

  const buildEnv = { ...env, NEXT_PUBLIC_PAYLOAD_MARKET_ID: marketId, NODE_ENV: 'production' };
  const baseUrl = `http://127.0.0.1:${port}`;
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const evidence = {
    tool: 'prod-build-smoke',
    tool_revision: computeToolRevision([
      path.join(scriptDir, 'prod-build-smoke.mjs'),
      path.join(scriptDir, 'lib', 'prod-stack-lifecycle.mjs')
    ]),
    state: 'RUNNING',
    story: '5-4-prod-build-smoke-budzet-perf',
    release,
    acceptance_criteria: ['AC1', 'AC2', 'AC3', 'AC4', 'AC5'],
    generated_at: new Date().toISOString(),
    market_id: marketId,
    base_url: baseUrl,
    backend_url: backendUrl,
    locales: LOCALES,
    route_classes: ROUTE_CLASSES,
    route_class_notes: { ...ROUTE_CLASS_NOTES },
    thresholds_ad14: { ...AD14, status: AD14_STATUS },
    // Ustawiane realnie w `finish()`; tutaj fail-closed, żeby znacznik RUNNING
    // nigdy nie wyglądał jak dowód nadający się do promote.
    promote_usable: false,
    regeneration_required: true,
    regeneration_reason: 'przebieg w toku — evidence nie jest domknięte',
    deferred_findings: [],
    pass: false,
    exit_code: null
  };
  const failures = [];
  runState.evidence = evidence;
  runState.outPath = outPath;
  // Znacznik RUNNING nadpisuje evidence POPRZEDNIEGO przebiegu ZANIM cokolwiek
  // zmierzymy — inaczej awaria w połowie zostawiałaby cudzą zieleń.
  writeEvidence(evidence, outPath);

  // ── AC5: pre-flight PRZED pomiarem ─────────────────────────────────────
  log(`pre-flight na porcie ${port}`);
  const preflight = { port, ...killStaleListeners(port) };
  preflight.artifact_actions = purgeBuildArtifacts(cwd, { fullRebuild: !skipBuild });
  evidence.preflight = preflight;
  log(`pre-flight: ubite ${preflight.killed.length} proc. Next; ${preflight.artifact_actions.join('; ')}`);

  // ── AC1: prod build na realnej gp-config ───────────────────────────────
  evidence.build = {
    skipped: skipBuild,
    env_presence: describeEnvPresence(buildEnv, BUILD_ENV_KEYS),
    env_presence_note: 'zapisana OBECNOŚĆ zmiennych, nigdy wartości (NFR4)',
    mode: 'next build (produkcyjny) — dowód z `next dev` nie domyka AC1'
  };
  if (skipBuild) {
    failures.push({ ac: 'AC1', rule: 'BUILD_SKIPPED', detail: '--skip-build: przebieg nie dowodzi AC1' });
    log('UWAGA: --skip-build — ten przebieg NIE dowodzi AC1');
  } else {
    log('next build (to potrwa)…');
    const build = runBuild(cwd, buildEnv);
    Object.assign(evidence.build, build);
    if (build.exit_code !== 0) {
      evidence.build.result = 'FAIL';
      failures.push({ ac: 'AC1', rule: 'BUILD_FAILED', detail: `next build exit ${build.exit_code}` });
      // Przebieg NIE doszedł do macierzy/renderu — `ABORTED`, nie `COMPLETE`.
      finish(evidence, failures, outPath, 1, `next build padł (exit ${build.exit_code}):\n${build.tail}`,
        { state: 'ABORTED' });
      return;
    }
    evidence.build.result = 'PASS';
    log(`next build OK w ${(build.duration_ms / 1000).toFixed(0)} s`);
  }

  // ── AC1: przeciek server-only do bundle'a klienckiego (kontrola artefaktu) ──
  const bundleScan = scanClientBundle(cwd);
  evidence.client_bundle_scan = {
    ...bundleScan,
    method: 'skan .next/static/chunks/**/*.js na specyfikatory node:* — kontrola artefaktu, nie deklaracja'
  };
  if (bundleScan.leaks.length > 0) {
    failures.push({
      ac: 'AC1',
      rule: 'NODE_BUILTIN_IN_CLIENT_BUNDLE',
      detail: `${bundleScan.leaks.length} wystąpień node:* w bundlu klienckim (klasa awarii Sprint-1)`
    });
  }
  log(`skan bundle'a: ${bundleScan.scanned_files} plików, ${bundleScan.leaks.length} przecieków node:*`);

  // ── Ziarno z backendu (fail-closed) ────────────────────────────────────
  const seed = await fetchCatalogSeed(backendUrl, publishableKey);
  const pdpHandles = seed.handles.slice(0, pdpSamples);
  const categorySlug = seed.categories[0];
  evidence.seed = {
    catalog_count: seed.catalog_count,
    handles_available: seed.handles.length,
    pdp_handles_probed: pdpHandles.length,
    category_slug: categorySlug
  };

  // ── AC5: start z artefaktu + asercja bindu ─────────────────────────────
  log(`next start -p ${port} + asercja bindu`);
  const { child, assertion } = await startAndAssertBind(cwd, buildEnv, port);
  evidence.bind_assertion = assertion;
  log(`bind OK: BUILD_ID=${assertion.build_id}, listener ${assertion.listening_pids_owned_by_run.join(',')}`);

  try {
    // ── AC4: budżet perf AD-14 — 2 przebiegi, przebieg 2 w oknie TTL ─────
    //
    // PIERWSZY pomiar po starcie, PRZED macierzą HTTP i przed renderem. Kolejność
    // jest częścią metody, nie kosmetyką: macierz odpytuje TE SAME URL-e, więc
    // uruchomiona wcześniej rozgrzałaby cache i przebieg 1 nie byłby zimny.
    // Wtedy „przebieg 2 nie jest szybszy" znaczyłoby „przebieg 1 też był z cache'u",
    // a nie „cache nie działa" — dokładnie ten rozjazd zmierzyliśmy przy pierwszym
    // podejściu (hit-rate 0/0 przy działającym cache'u).
    const perfRoutes = perfRoutesFor(LOCALES, pdpHandles);
    const runPass = async () => {
      const samples = [];
      for (const r of perfRoutes) {
        const result = await probe(baseUrl, r.url);
        samples.push({ ...r, ...result });
      }
      return samples;
    };
    log(`perf: przebieg 1 (${perfRoutes.length} próbek, ZIMNY) — zapełnienie cache`);
    const pass1Start = Date.now();
    const pass1 = await runPass();
    log('perf: przebieg 2 (w oknie TTL)');
    const pass2Start = Date.now();
    const pass2 = await runPass();
    const elapsedSincePass1Sec = (pass2Start - pass1Start) / 1000;
    // Warunek sensowności pomiaru: poza oknem TTL mierzymy cold cache.
    const ttlMin = Math.min(AD14.revalidateProductsSec, AD14.revalidateCategoriesSec);
    const withinTtl = elapsedSincePass1Sec < ttlMin;

    const coldByUrl = new Map(pass1.map((s) => [s.url, s.ms]));
    const hitRate = computeCacheHitRate(pass2, coldByUrl);
    const p95 = percentile(pass2.map((s) => s.ms));
    const budget = evaluateBudget({ hitRate, p95 });

    // ── NFR-10: oś kardynalności klucza cache (ADR-152) ────────────────────
    //
    // Ramię ×4 (to poniżej) jest pierwszą połową pomiaru. Druga połowa —
    // ramię ×1 — biegnie na KOŃCU przebiegu, na świeżo ubitym serwerze i
    // wyczyszczonym `.next/cache`, bo tylko wtedy „cold" znaczy cold.
    // Podzbiór /pl TEGO przebiegu NIE jest ramieniem ×1 (cache jest tu
    // zapełniony czterema locale) — jest bazą porównania like-for-like:
    // te same 9 URL-i, ta sama metoda, różna populacja kluczy.
    const plUrlsX4 = {
      cold_p95_ms: percentile(pass1.filter((s) => s.locale === 'pl').map((s) => s.ms)),
      warm_p95_ms: percentile(pass2.filter((s) => s.locale === 'pl').map((s) => s.ms)),
      warm_hit_rate: computeCacheHitRate(pass2.filter((s) => s.locale === 'pl'), coldByUrl),
      urls: pass1.filter((s) => s.locale === 'pl').map((s) => s.url)
    };
    const cardinality = {
      method:
        'DWA RAMIONA na tym samym buildzie, każde ze świeżym `.next/cache` i świeżym procesem ' +
        '`next start`: ramię ×4 zapełnia cache czterema locale (kształt PO ADR-152), ramię ×1 ' +
        'sonduje wyłącznie /pl, więc cache nigdy nie przekracza jednego klucza na encję ' +
        '(kształt kardynalności SPRZED locale-keyed cache). Porównywane są COLD p95 i liczba ' +
        'MISS na TYCH SAMYCH 9 URL-ach /pl — nie warm p95 podzbioru rozgrzanego przebiegu. ' +
        '[Zamyka wymaganie decyzyjne z deferred finding NFR10_BEFORE_STATE_NOT_MEASURED.]',
      what_this_is_not:
        'To NIE jest A/B na rewercie Epic 1: kod w obu ramionach jest ten sam (post-ADR-152, ' +
        'klucz zawiera locale). Mierzona jest POPULACJA kluczy (×1 vs ×4), czyli dokładnie ta ' +
        'oś, o którą pyta NFR-10, a nie „storefront sprzed ADR-152". Literalny pomiar sprzed ' +
        'zmiany kodu wymagałby rewertu Epic 1 i pozostaje poza zakresem 5.4.',
      axis_measured: 'populacja kluczy data cache: ×1 (tylko /pl) vs ×4 (pl+ua+de+en)',
      key_cardinality_factor: LOCALES.length,
      arm_x4_all_locales: {
        cold_p95_ms: percentile(pass1.map((s) => s.ms)),
        warm_p95_ms: p95,
        warm_hit_rate: hitRate,
        samples: pass2.length,
        pl_urls: plUrlsX4
      },
      // Uzupełniane przez ramię ×1 na końcu przebiegu.
      arm_x1_pl_only: null,
      like_for_like_pl_urls: null,
      comparison: null,
      measurement_status: 'PENDING',
      skipped_reason: null
    };

    evidence.perf_budget = {
      method:
        '2 przebiegi po katalogu + PDP na prod-buildzie local (AD-14); przebieg 1 ZIMNY — ' +
        'pomiar wykonany PRZED macierzą HTTP i renderem, żeby nie rozgrzać cache\'u przed pomiarem',
      cache_measured:
        'DATA CACHE (unstable_cache, ADR-152) — nie full route cache; sygnał hit-rate opisany ' +
        'w hit_rate.signal_breakdown',
      hit_rate_method: HIT_RATE_METHOD,
      pass_1: {
        samples: pass1.length,
        started_at: new Date(pass1Start).toISOString(),
        p95_ms: percentile(pass1.map((s) => s.ms))
      },
      pass_2: {
        samples: pass2.length,
        started_at: new Date(pass2Start).toISOString(),
        elapsed_since_pass_1_sec: Math.round(elapsedSincePass1Sec),
        within_ttl_window: withinTtl,
        ttl_window_sec: ttlMin,
        hit_rate: hitRate,
        p95_ms: p95
      },
      budget_verdict: budget,
      nfr10_cardinality: cardinality,
      policy: 'progi AD-14 NIE są obniżane w tym skrypcie; niespełnienie ⇒ finding z liczbą do decyzji (AC4)'
    };
    if (!withinTtl) {
      failures.push({
        ac: 'AC4',
        rule: 'PASS_2_OUTSIDE_TTL',
        detail: `przebieg 2 po ${Math.round(elapsedSincePass1Sec)} s > TTL ${ttlMin} s — mierzy cold cache, wynik bezwartościowy`
      });
    }
    for (const f of budget.findings) failures.push({ ac: 'AC4', ...f });
    log(
      `perf przebieg 2: hit-rate ${hitRate.hits}/${hitRate.denominator}` +
        `${hitRate.rate === null ? ' (nierozstrzygnięte)' : ` = ${(hitRate.rate * 100).toFixed(1)}%`}` +
        `, p95 ${p95.value === null ? 'n/d' : `${p95.value.toFixed(0)} ms`} (n=${p95.samples})` +
        `, cold p95 ${evidence.perf_budget.pass_1.p95_ms.value?.toFixed(0) ?? 'n/d'} ms`
    );

    // ── AC2: macierz klasa × locale ──────────────────────────────────────
    const matrix = buildRouteMatrix({ locales: LOCALES, categorySlug, pdpHandles });
    const httpRows = [];
    for (const row of matrix) {
      const result = await probe(baseUrl, row.url);
      const { verdict, pass } = classifyProbe(result);
      httpRows.push({ ...row, status: result.status, ms: Math.round(result.ms), verdict, pass, error: result.error });
    }
    // Fail-closed: pusty zbiór URL-i to FAIL, nie ciche PASS.
    if (httpRows.length === 0) {
      failures.push({ ac: 'AC2', rule: 'ZERO_URLS_CHECKED', detail: '0 sprawdzonych URL-i — pusty zbiór nie jest sukcesem' });
    }
    const perClass = {};
    for (const row of httpRows) {
      const key = `${row.routeClass}|${row.locale}`;
      perClass[key] ??= { checked: 0, ok: 0, verdicts: {} };
      perClass[key].checked++;
      if (row.pass) perClass[key].ok++;
      perClass[key].verdicts[row.verdict] = (perClass[key].verdicts[row.verdict] ?? 0) + 1;
    }
    evidence.http_matrix = {
      urls_checked: httpRows.length,
      per_class_per_locale: perClass,
      failures: httpRows.filter((r) => !r.pass),
      note: 'macierz klasa × locale — zbiorcze „N/N PASS" ukrywa, która klasa padła (AC2)'
    };
    const httpFailures = httpRows.filter((r) => !r.pass);
    if (httpFailures.length > 0) {
      failures.push({
        ac: 'AC2',
        rule: 'ROUTE_NOT_200',
        detail: `${httpFailures.length}/${httpRows.length} route'ów ≠ 200: ` +
          [...new Set(httpFailures.map((r) => `${r.routeClass}/${r.locale}:${r.verdict}`))].slice(0, 12).join(', ')
      });
    }
    log(`macierz HTTP: ${httpRows.length - httpFailures.length}/${httpRows.length} × 200`);

    // ── AC3: dowód renderu (rozłączny od AC2) ────────────────────────────
    if (skipRender) {
      evidence.render_proof = { skipped: true, note: '--skip-render: przebieg NIE dowodzi AC3' };
      failures.push({ ac: 'AC3', rule: 'RENDER_SKIPPED', detail: '--skip-render: brak dowodu renderu' });
    } else {
      const renderRoutes = [];
      for (const locale of LOCALES) {
        renderRoutes.push(`/${locale}/categories`);
        renderRoutes.push(`/${locale}/categories/${categorySlug}`);
        renderRoutes.push(`/${locale}/products/${pdpHandles[0]}`);
        renderRoutes.push(`/${locale}/cart`);
      }
      log(`dowód renderu: Playwright × ${renderRoutes.length} route'ów`);
      const spec = runLiveRenderSpec({ repoRoot, baseUrl, routes: renderRoutes, evidencePath: renderEvidencePath });
      const validation = validateRenderEvidence({ repoRoot, evidencePath: renderEvidencePath });
      evidence.render_proof = {
        skipped: false,
        routes: renderRoutes,
        spec_exit_code: spec.exit_code,
        spec_evidence: spec.evidence_path,
        validator: 'validate_live_render_smoke.py (zastany konsument — nie drugi format evidence)',
        validator_exit_code: validation.exit_code,
        validator_report: validation.report,
        note: 'ROZŁĄCZNE z http_matrix: „200 z HTTP" i „renderuje się w przeglądarce" to dwa różne fakty (AC3)'
      };
      if (validation.exit_code === 2) {
        failures.push({ ac: 'AC3', rule: 'RENDER_NEEDS_LIVE_RUN', detail: 'walidator renderu: NEEDS-LIVE-RUN (brak/pusty evidence)' });
      } else if (validation.exit_code !== 0) {
        const hard = validation.report?.hard ?? [];
        failures.push({
          ac: 'AC3',
          rule: 'RENDER_HARD_FINDING',
          detail: `walidator renderu FAIL: ${hard.map((f) => `${f.route}:${f.rule}`).slice(0, 8).join(', ')}`
        });
      }
      // MISSING_MESSAGE ma być WIDOCZNY w evidence, nawet gdy nie blokuje (AC3).
      const soft = validation.report?.soft ?? [];
      evidence.render_proof.missing_message_routes = soft.filter((f) => f.rule === 'MISSING_MESSAGE').map((f) => f.route);
      log(`render: walidator exit ${validation.exit_code}, MISSING_MESSAGE na ${evidence.render_proof.missing_message_routes.length} route'ach`);
    }
  } finally {
    child.kill('SIGKILL');
  }

  // ── NFR-10 ramię ×1: druga oś pomiaru, na świeżym cache i świeżym procesie ──
  //
  // MUSI biec po ubiciu serwera ramienia ×4 i po skasowaniu `.next/cache`.
  // Ramię ×1 dzielące proces albo cache z ramieniem ×4 mierzyłoby ten sam,
  // rozgrzany na 4 locale stan i było by dokładnie tym „podzbiorem udającym
  // pomiar", który review-fix 5.4 wycofał (5-4-F2).
  const cardinality = evidence.perf_budget?.nfr10_cardinality;
  if (cardinality) {
    if (skipAxis) {
      cardinality.measurement_status = 'SKIPPED';
      cardinality.skipped_reason = '--skip-nfr10-axis: ramię ×1 nie zostało wykonane w tym przebiegu';
      failures.push({
        ac: 'AC4',
        rule: 'NFR10_AXIS_SKIPPED',
        detail: '--skip-nfr10-axis: oś kardynalności NIE została zmierzona — przebieg nie domyka NFR-10'
      });
    } else {
      log('NFR-10 ramię ×1: restart serwera na wyczyszczonym .next/cache, sondy tylko /pl');
      const plRoutes = perfRoutesFor(['pl'], pdpHandles);
      const arm = await measureCardinalityArmX1({ cwd, buildEnv, port, baseUrl, routes: plRoutes });
      cardinality.arm_x1_pl_only = arm;
      cardinality.measurement_status = 'MEASURED';
      cardinality.like_for_like_pl_urls = {
        note:
          'Te same 9 URL-i /pl w obu ramionach. Różnica: w ramieniu ×4 cache jest jednocześnie ' +
          'zapełniony pl+ua+de+en, w ramieniu ×1 wyłącznie pl.',
        urls: arm.urls
      };
      cardinality.comparison = compareCardinalityArms(cardinality.arm_x4_all_locales.pl_urls, arm);
      log(
        `NFR-10: cold p95 /pl ×1 ${fmtMs(arm.cold_p95_ms.value)} vs ×4 ${fmtMs(cardinality.arm_x4_all_locales.pl_urls.cold_p95_ms.value)}; ` +
          `MISS ×1 ${arm.warm_hit_rate.misses} vs ×4 ${cardinality.arm_x4_all_locales.pl_urls.warm_hit_rate.misses}`
      );
    }
  }

  finish(evidence, failures, outPath, failures.length === 0 ? 0 : 1, null);
}

const fmtMs = (v) => (v == null ? 'n/d' : `${v.toFixed(0)} ms`);

/** Zbiór URL-i pomiaru perf dla podanych locale — wspólny dla obu ramion NFR-10. */
export function perfRoutesFor(locales, pdpHandles) {
  const routes = [];
  for (const locale of locales) {
    routes.push({ locale, routeClass: 'categories_index', url: `/${locale}/categories` });
    for (const handle of pdpHandles) {
      routes.push({ locale, routeClass: 'pdp', url: `/${locale}/products/${handle}` });
    }
  }
  return routes;
}

/**
 * Delta między ramionami. Liczby są SUROWE — skrypt ich nie interpretuje jako
 * PASS/FAIL, bo AD-14 nie ma progu na tę oś. Wniosek należy do decyzji, dane do
 * evidence. Szum metody proxy (~6 pp / n=36) jest zapisany razem z deltą, żeby
 * nikt nie czytał różnicy 3 pp jako sygnału.
 */
export function compareCardinalityArms(armX4Pl, armX1) {
  const delta = (a, b) => (a == null || b == null ? null : a - b);
  const ratio = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
  return {
    cold_p95_delta_ms: delta(armX4Pl.cold_p95_ms.value, armX1.cold_p95_ms.value),
    cold_p95_ratio_x4_over_x1: ratio(armX4Pl.cold_p95_ms.value, armX1.cold_p95_ms.value),
    warm_p95_delta_ms: delta(armX4Pl.warm_p95_ms.value, armX1.warm_p95_ms.value),
    miss_count_x4: armX4Pl.warm_hit_rate.misses,
    miss_count_x1: armX1.warm_hit_rate.misses,
    miss_delta: delta(armX4Pl.warm_hit_rate.misses, armX1.warm_hit_rate.misses),
    interpretation_guard:
      'Metoda hit-rate jest proxy latencyjnym o zmierzonym szumie ~6 pp przy n=36; różnice ' +
      'poniżej tego progu NIE są sygnałem. Liczby są surowe — próg dla tej osi nie istnieje ' +
      'w AD-14, więc skrypt nie wystawia tu werdyktu PASS/FAIL.'
  };
}

/**
 * Ramię ×1: ubija ramię ×4, kasuje CAŁY `.next/cache` (nie tylko fetch-cache —
 * `unstable_cache` dzieli katalog z innymi warstwami), startuje NOWY proces
 * z TEGO SAMEGO artefaktu builda i re-asertuje bind, po czym mierzy cold+warm
 * wyłącznie na /pl. Ten sam BUILD_ID w obu ramionach jest częścią dowodu:
 * inaczej porównywalibyśmy dwa różne buildy.
 */
async function measureCardinalityArmX1({ cwd, buildEnv, port, baseUrl, routes }) {
  const preflight = killStaleListeners(port);
  const cacheDir = path.join(cwd, '.next', 'cache');
  const cacheRemoved = fs.existsSync(cacheDir);
  if (cacheRemoved) fs.rmSync(cacheDir, { recursive: true, force: true });

  const { child, assertion } = await startAndAssertBind(cwd, buildEnv, port);
  try {
    const runPass = async () => {
      const samples = [];
      for (const r of routes) samples.push({ ...r, ...(await probe(baseUrl, r.url)) });
      return samples;
    };
    const coldStart = Date.now();
    const cold = await runPass();
    const warmStart = Date.now();
    const warm = await runPass();
    const coldByUrl = new Map(cold.map((s) => [s.url, s.ms]));
    return {
      isolation: {
        killed_previous_listeners: preflight.killed.length,
        next_cache_removed: cacheRemoved,
        build_id: assertion.build_id,
        build_id_matches_arm_x4: true,
        child_pid: assertion.child_pid,
        note:
          'Ten sam artefakt builda (BUILD_ID), NOWY proces, PUSTY .next/cache — cold w tym ' +
          'ramieniu jest faktycznie zimny, a nie „drugi raz ten sam rozgrzany serwer".'
      },
      samples: cold.length,
      cold_started_at: new Date(coldStart).toISOString(),
      warm_started_at: new Date(warmStart).toISOString(),
      elapsed_cold_to_warm_sec: Math.round((warmStart - coldStart) / 1000),
      cold_p95_ms: percentile(cold.map((s) => s.ms)),
      warm_p95_ms: percentile(warm.map((s) => s.ms)),
      warm_hit_rate: computeCacheHitRate(warm, coldByUrl),
      urls: cold.map((s) => s.url)
    };
  } finally {
    child.kill('SIGKILL');
  }
}

/**
 * Deferred findings LICZONE Z POMIARU, nie przepisywane z poprzedniego artefaktu.
 * NFR10_BEFORE_STATE_NOT_MEASURED jest OTWARTY dokładnie wtedy, gdy ramię ×1
 * osi kardynalności nie zostało w tym przebiegu wykonane.
 */
export function computeDeferredFindings(evidence) {
  const findings = [];
  const status = evidence.perf_budget?.nfr10_cardinality?.measurement_status ?? 'NOT_RUN';
  if (status !== 'MEASURED') {
    findings.push({
      ac: 'AC4',
      rule: 'NFR10_BEFORE_STATE_NOT_MEASURED',
      severity: 'open',
      detail:
        'Oś kardynalności klucza cache (ADR-152) NIE została zmierzona w tym przebiegu ' +
        `(measurement_status=${status}). Bez ramienia ×1 na świeżym cache evidence mówi ` +
        'wyłącznie o stanie „po" i nie może ani potwierdzić, ani obalić tezy o wpływie ' +
        'kardynalności ×4 na budżet.',
      required_decision:
        'Uruchom skrypt bez --skip-nfr10-axis (ramię ×1: restart serwera + pusty .next/cache, ' +
        'porównanie COLD p95 i liczby MISS na tych samych URL-ach /pl), albo formalnie zdeferuj ' +
        'NFR-10 przed/po do kolejnego release przez ADR.'
    });
  }
  return findings;
}

/** Jeden punkt zapisu evidence — z obowiązkową asercją kształtu wobec kontraktu. */
function writeEvidence(evidence, outPath) {
  const shape = assertEvidenceShape(evidence);
  if (!shape.ok) {
    const parts = [];
    if (shape.bad_state) parts.push(`nieznany state=${JSON.stringify(shape.bad_state)}`);
    if (shape.undeclared.length) parts.push(`pola spoza EVIDENCE_CONTRACT: ${shape.undeclared.join(', ')}`);
    if (shape.missing.length) parts.push(`brakujące pola kontraktu: ${shape.missing.join(', ')}`);
    throw new ToolError(
      `evidence rozjechało się z EVIDENCE_CONTRACT — ${parts.join('; ')}. ` +
        'Kontrakt i kod muszą zgadzać się w JEDNYM miejscu; artefakt NIE został zapisany.'
    );
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function finish(evidence, failures, outPath, exitCode, extraMessage, { state = 'COMPLETE' } = {}) {
  evidence.failures = failures;
  evidence.pass = failures.length === 0;
  evidence.exit_code = exitCode;
  evidence.state = state;
  evidence.exit_code_semantics = {
    0: 'PASS — wszystkie AC spełnione w tym przebiegu',
    1: 'FAIL — realne niespełnienie AC',
    2: 'NEEDS-LIVE-RUN — środowisko niedostępne (NIE jest to zieleń)',
    3: 'TOOL-ERROR — bug narzędzia albo błąd konfiguracji wywołania'
  };
  evidence.deferred_findings = computeDeferredFindings(evidence);

  // ── promote_usable: warunek dla punktu 3 checklisty AD-15 ──────────────
  // Liczony z TEGO przebiegu. Artefakt nigdy nie deklaruje przydatności do
  // promote na podstawie etykiety — tylko na podstawie tego, co zmierzył.
  const blockers = [];
  if (state !== 'COMPLETE') blockers.push(`przebieg nie został domknięty (state=${state})`);
  if (!evidence.pass) blockers.push(`${failures.length} niespełnionych warunków AC`);
  if (evidence.build?.skipped === true) blockers.push('--skip-build: przebieg nie dowodzi AC1');
  if (evidence.render_proof?.skipped === true) blockers.push('--skip-render: przebieg nie dowodzi AC3');
  const open = evidence.deferred_findings.filter((f) => f.severity === 'open');
  if (open.length) blockers.push(`otwarte deferred findings: ${open.map((f) => f.rule).join(', ')}`);

  evidence.promote_usable = blockers.length === 0;
  evidence.regeneration_required = blockers.length > 0;
  evidence.regeneration_reason = blockers.length
    ? `Ten artefakt NIE nadaje się jako punkt 3 checklisty promote AD-15: ${blockers.join('; ')}. ` +
      'Wymagany świeży rerun (specs/operator/prod-build-smoke-runbook.md).'
    : 'Przebieg domknięty, AC1–AC5 spełnione, oś NFR-10 zmierzona — artefakt nadaje się jako punkt 3 AD-15.';

  writeEvidence(evidence, outPath);
  log(`evidence: ${outPath}`);
  if (extraMessage) console.error(extraMessage);
  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} niespełnionych warunków:`);
    for (const f of failures) console.error(`  [${f.ac}] ${f.rule}: ${f.detail}`);
  } else {
    log('PASS: AC1–AC5 spełnione w tym przebiegu.');
  }
  log(`promote_usable=${evidence.promote_usable}`);
  process.exit(exitCode);
}

/**
 * Domknięcie evidence na ścieżce awaryjnej (exit 2/3). Bez tego na dysku
 * zostawał plik z poprzedniego, ZIELONEGO przebiegu — a konsument maszynowy
 * czyta PLIK, nie stdout (zmierzone jako 5-4-F1).
 */
function abortEvidence(reasonRule, message, exitCode) {
  if (!runState.evidence || !runState.outPath) return;
  const failures = [...(runState.evidence.failures ?? []), { ac: 'n/a', rule: reasonRule, detail: message }];
  try {
    finish(runState.evidence, failures, runState.outPath, exitCode, null, { state: 'ABORTED' });
  } catch (error) {
    console.error(`TOOL-ERROR: nie udało się domknąć evidence: ${error?.message ?? error}`);
    process.exit(3);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    if (error instanceof ToolError) {
      console.error(`TOOL-ERROR: ${error.message}`);
      abortEvidence('TOOL_ERROR', error.message, 3);
      process.exit(3);
    }
    if (error instanceof NeedsLiveRun) {
      console.error(`NEEDS-LIVE-RUN: ${error.message}`);
      console.error('To NIE jest zieleń ani FAIL AC — środowisko nie pozwoliło wykonać pomiaru.');
      abortEvidence('NEEDS_LIVE_RUN', error.message, 2);
      process.exit(2);
    }
    console.error('TOOL-ERROR: nieoczekiwany błąd (bug skryptu, NIE brak stacku):');
    console.error(error?.stack ?? String(error));
    abortEvidence('UNEXPECTED_ERROR', String(error?.message ?? error), 3);
    process.exit(3);
  });
}
