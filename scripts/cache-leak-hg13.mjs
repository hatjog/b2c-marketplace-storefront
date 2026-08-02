#!/usr/bin/env node
/**
 * cache-leak-hg13.mjs — v1.14.0 Story 5.5 (HG-13; AC1, AC2, AC3; AD-15 pkt 4).
 *
 * JEDNA komenda: pre-flight → prod build na realnej gp-config → `next start`
 * z asercją bindu → zamrożenie niezależnego oracle → formalny profil HG-13
 * w zastanym harnessie `GP/e2e` → jeden plik evidence.
 *
 * ══ Co ten skrypt świadomie NIE robi ══
 *  • nie implementuje drugiego lifecycle prod-buildu — importuje wspólny
 *    `scripts/lib/prod-stack-lifecycle.mjs` (ten sam, którego używa 5.4);
 *  • nie tworzy drugiego frameworka E2E — odpala projekt `hg13-cache-leak`
 *    zastanej instalacji Playwright w `GP/e2e`;
 *  • nie buduje oracle z odpowiedzi mierzonego storefrontu — fingerprinty
 *    pochodzą z gp-ops i są zamrożone (z SHA-256) PRZED pomiarem;
 *  • nie wydaje werdyktu promote — envelope AD-15 składa
 *    `_grow/tools/run_v1140_promote_envelope.py`, a evidence niezależnie
 *    przelicza `_grow/tools/validate_locale_cache_leak_evidence.py`.
 *
 * ══ Dlaczego pre-flight jest CZĘŚCIĄ pomiaru, a nie przygotowaniem do niego ══
 * Sprint-3 dał 452 false-FAIL na zombie `next-server`, stale fetch-cache i
 * współdzielonym `.next`. Sprint-4 (story 5.6) stracił 115 baseline'ów, bo
 * harness cicho zjechał na `next dev`. Oba przebiegi wyglądały na wykonane.
 * Dlatego evidence NIESIE pre-flight (akcje, gitlinki, PID, port, BUILD_ID,
 * SHA kandydata, `runtime_mode`, `build_mode`), a walidator odrzuca ich brak.
 *
 * ══ Kody wyjścia (rozłączne) ══
 *   0  PASS            — HG-13 spełnione w tym przebiegu.
 *   1  FAIL            — realny przeciek / niepełna macierz / za mała współbieżność.
 *   2  NEEDS-LIVE-RUN  — środowisko nie pozwoliło zmierzyć. NIE jest to zieleń.
 *   3  TOOL-ERROR      — bug narzędzia albo błąd wywołania.
 *
 * ══ Użycie ══
 *   node scripts/cache-leak-hg13.mjs \
 *     [--port 3183] [--market bonbeauty] [--environment gp-dev] \
 *     [--backend-url http://localhost:9002] [--waves 20] \
 *     [--sequence-context standalone_harness_run|ad15_step_4] \
 *     [--skip-build]   # TYLKO iteracja nad narzędziem: build_mode != production
 *                      # ⇒ evidence dostaje pass=false i walidator to odrzuca
 *
 * Sekrety: evidence zapisuje obecność/nazwy zmiennych, nigdy wartości (NFR4).
 */
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  NeedsLiveRun,
  ToolError,
  assertNoStaleListener,
  assertServerStillServing,
  describeEnvPresence,
  killStaleListeners,
  purgeBuildArtifacts,
  readEnvLocal,
  runBuild,
  startAndAssertBind
} from './lib/prod-stack-lifecycle.mjs';
import { HG13_CLASSES, HG13_LOCALES, buildOracle } from './lib/hg13-oracle.mjs';

const BUILD_ENV_KEYS = [
  'NEXT_PUBLIC_PAYLOAD_MARKET_ID',
  'PAYLOAD_API_URL',
  'MEDUSA_BACKEND_URL',
  'NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_BASE_URL',
  'NEXT_PUBLIC_DEFAULT_REGION'
];

/** Minimum wymagane przez AC2 — nie wolno ich obniżyć, żeby przebieg przeszedł. */
export const HG13_MIN = Object.freeze({
  waves: 20,
  measuredSamples: 180,
  concurrency: 9
});

const log = (msg) => console.log(`[cache-leak-hg13] ${msg}`);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) throw new ToolError(`nieznany argument pozycyjny: ${key}`);
    const name = key.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[name] = true;
    else { args[name] = next; i++; }
  }
  return args;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function git(repoRoot, args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  return (r.stdout ?? '').trim();
}

/**
 * AC1 pkt 1 — gitlinki submodułów.
 *
 * Runner pracuje w izolowanym worktree, gdzie submoduły bywają NIEZAINICJALIZOWANE.
 * Test uruchomiony wtedy mierzy pusty katalog i przechodzi — pusty diff udaje
 * sukces (lekcja 4 z Dev Notes). Prefiks `-` w `git submodule status` oznacza
 * właśnie taki stan i jest tu twardym błędem.
 *
 * Checkout celuje w SHA ZAPISANE W RODZICU, nigdy w `origin/main`: gałąź mogła
 * pojechać dalej i mierzylibyśmy inny kod niż kandydat release'u.
 */
function assertSubmoduleGitlinks(repoRoot, paths) {
  spawnSync('git', ['submodule', 'sync', ...paths], { cwd: repoRoot, encoding: 'utf8' });
  spawnSync('git', ['submodule', 'update', '--init', ...paths], { cwd: repoRoot, encoding: 'utf8' });
  // UWAGA: NIE trimujemy wyjścia. Pierwszy znak wiersza JEST danymi — spacja
  // znaczy „na gitlinku", `-` „niezainicjalizowany", `+` „inne SHA niż gitlink".
  // `trim()` zjadał wiodącą spację i wywracał parsowanie pierwszego wiersza.
  const raw = spawnSync('git', ['submodule', 'status', ...paths], { cwd: repoRoot, encoding: 'utf8' });
  const status = raw.stdout ?? '';
  const entries = [];
  for (const line of status.split('\n').filter((l) => l.length > 0)) {
    const m = /^([-+U ])([0-9a-f]{40})\s+(\S+)/.exec(line);
    if (!m) throw new ToolError(`nieparsowalny wiersz git submodule status: ${JSON.stringify(line)}`);
    const [, prefix, sha, submodulePath] = m;
    entries.push({
      path: submodulePath,
      sha,
      prefix: prefix === ' ' ? '' : prefix,
      state: prefix === '-' ? 'UNINITIALIZED' : prefix === '+' ? 'DIFFERS_FROM_GITLINK' : prefix === 'U' ? 'MERGE_CONFLICT' : 'AT_GITLINK'
    });
  }
  const bad = entries.filter((e) => e.state === 'UNINITIALIZED' || e.state === 'MERGE_CONFLICT');
  if (bad.length > 0) {
    throw new NeedsLiveRun(
      `submoduły nie są na gitlinku rodzica: ${bad.map((e) => `${e.path}=${e.state}`).join(', ')} — ` +
      'pomiar poza faktycznym kodem submodułu udawałby sukces (lekcja 4, Dev Notes 5.5)'
    );
  }
  return entries;
}

/**
 * Uncached odczyt katalogu z backendu — WYŁĄCZNIE po to, żeby sprawdzić, które
 * zasoby REALNIE istnieją. Treść fingerprintów pochodzi z gp-ops, nie stąd.
 */
async function fetchBackendHandles(backendUrl, publishableKey) {
  const headers = { 'x-publishable-api-key': publishableKey, 'cache-control': 'no-cache' };
  const productsRes = await fetch(`${backendUrl}/store/products?limit=200&fields=handle`, { headers });
  if (!productsRes.ok) throw new NeedsLiveRun(`backend /store/products → HTTP ${productsRes.status}`);
  const products = await productsRes.json();
  const categoriesRes = await fetch(`${backendUrl}/store/product-categories?limit=100&fields=handle`, { headers });
  if (!categoriesRes.ok) throw new NeedsLiveRun(`backend /store/product-categories → HTTP ${categoriesRes.status}`);
  const categories = await categoriesRes.json();
  const productHandles = new Set((products.products ?? []).map((p) => p.handle).filter(Boolean));
  const categoryHandles = new Set((categories.product_categories ?? []).map((c) => c.handle).filter(Boolean));
  if (productHandles.size === 0) throw new NeedsLiveRun('backend zwrócił 0 handli produktów — nie ma czego mierzyć');
  if (categoryHandles.size === 0) throw new NeedsLiveRun('backend zwrócił 0 handli kategorii — klasa katalogu niemierzalna');
  return { productHandles, categoryHandles };
}

async function runHg13Spec({ repoRoot, baseUrl, oraclePath, samplesPath, waves, reportPath }) {
  const e2eDir = path.join(repoRoot, 'GP', 'e2e');
  if (!fs.existsSync(path.join(e2eDir, 'node_modules', '.bin', 'playwright'))) {
    throw new NeedsLiveRun(`brak zależności Playwright w ${e2eDir} (npm ci) — profil HG-13 niewykonalny`);
  }
  if (fs.existsSync(samplesPath)) fs.rmSync(samplesPath); // stale samples = false-PASS
  // Asynchroniczny child jest konieczny: podczas profilu proces rodzica musi
  // stale drenować stdout/stderr `next start`, inaczej pełny pipe blokuje SSR.
  const child = spawn(
    'node_modules/.bin/playwright',
    ['test', '--project=hg13-cache-leak', '--reporter=list,json'],
    {
      cwd: e2eDir,
      env: {
        ...process.env,
        GP_E2E_SKIP_WEB_SERVER: '1',
        GP_E2E_SKIP_JWT_SEED: '1',
        GP_E2E_SKIP_CONFIG_HELPERS: '1',
        PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
        HG13_BASE_URL: baseUrl,
        HG13_ORACLE: oraclePath,
        HG13_SAMPLES_OUT: samplesPath,
        HG13_WAVES: String(waves),
        NODE_ENV: 'production'
      }
    }
  );
  let output = '';
  const append = (chunk) => {
    output += chunk.toString();
    if (output.length > 64 * 1024 * 1024) output = output.slice(-64 * 1024 * 1024);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  return {
    exit_code: exitCode,
    tail: output.split('\n').slice(-30).join('\n')
  };
}

/**
 * Liczniki HG-13 z surowych próbek fazy pomiarowej.
 *
 * Rozłączne kategorie NIE są tu użyte celowo: jedna odpowiedź może jednocześnie
 * nie zawierać własnego locale i zawierać obcy. Zliczanie „albo-albo" ukryłoby
 * jeden z tych faktów, więc każdy licznik jest niezależny (AC3).
 */
export function computeHg13Counters(samples, locales, classes) {
  const measured = samples.filter((s) => s.phase === 'measure');
  const matrix = {};
  for (const locale of locales) {
    for (const cls of classes) matrix[`${cls}|${locale}`] = { samples: 0, http_200: 0, clean: 0 };
  }
  let foreign = 0;
  let missing = 0;
  let unclassified = 0;
  const foreignDetail = [];
  for (const s of measured) {
    const key = `${s.class}|${s.locale}`;
    if (matrix[key]) {
      matrix[key].samples += 1;
      if (s.status === 200) matrix[key].http_200 += 1;
      if (s.classification === 'clean') matrix[key].clean += 1;
    }
    if (Array.isArray(s.foreign_fingerprints_found) && s.foreign_fingerprints_found.length > 0) {
      foreign += 1;
      if (foreignDetail.length < 20) {
        foreignDetail.push({
          ordinal: s.ordinal, wave: s.wave, class: s.class, locale: s.locale,
          url: s.url, foreign: s.foreign_fingerprints_found, excerpt: s.excerpt
        });
      }
    }
    if (s.status === 200 && !s.error && s.own_fingerprint_found === false) missing += 1;
    if (s.status !== 200 || s.error) unclassified += 1;
  }
  const emptyCells = Object.entries(matrix).filter(([, v]) => v.samples === 0).map(([k]) => k);
  return {
    measured_samples: measured.length,
    foreign_locale_count: foreign,
    missing_expected_locale_count: missing,
    unclassified_count: unclassified,
    matrix,
    empty_cells: emptyCells,
    foreign_detail: foreignDetail
  };
}

/**
 * Werdykt HG-13. Zero budżetu wyjątków: G-L1 (`MEDIUM <= 5`) NIE łagodzi HG-13.
 * Niepełna macierz, za mała współbieżność i za mała próba są takim samym
 * brakiem dowodu jak przeciek — „nie zmierzyliśmy" nie może wyglądać na PASS.
 */
export function evaluateHg13({ counters, loadProfile, minimums = HG13_MIN }) {
  const findings = [];
  if (counters.foreign_locale_count > 0) {
    findings.push({ ac: 'AC3', rule: 'FOREIGN_LOCALE_IN_RESPONSE', detail: `${counters.foreign_locale_count} odpowiedzi z fingerprintem obcego locale (budżet HG-13 = 0)` });
  }
  if (counters.missing_expected_locale_count > 0) {
    findings.push({ ac: 'AC3', rule: 'MISSING_EXPECTED_LOCALE', detail: `${counters.missing_expected_locale_count} odpowiedzi bez fingerprintu własnego locale` });
  }
  if (counters.unclassified_count > 0) {
    findings.push({ ac: 'AC3', rule: 'UNCLASSIFIED_SAMPLE', detail: `${counters.unclassified_count} próbek non-200/błąd — brak rozróżnialnej treści to brak dowodu` });
  }
  if (counters.empty_cells.length > 0) {
    findings.push({ ac: 'AC2', rule: 'INCOMPLETE_MATRIX', detail: `komórki bez próbek: ${counters.empty_cells.join(', ')}` });
  }
  if (counters.measured_samples < minimums.measuredSamples) {
    findings.push({ ac: 'AC2', rule: 'SAMPLE_FLOOR_NOT_MET', detail: `${counters.measured_samples} < ${minimums.measuredSamples} zakończonych odpowiedzi w fazie pomiarowej` });
  }
  if ((loadProfile?.waves ?? 0) < minimums.waves) {
    findings.push({ ac: 'AC2', rule: 'WAVE_FLOOR_NOT_MET', detail: `${loadProfile?.waves ?? 0} < ${minimums.waves} fal` });
  }
  if ((loadProfile?.max_in_flight_measured ?? 0) < minimums.concurrency) {
    findings.push({ ac: 'AC2', rule: 'CONCURRENCY_FLOOR_NOT_MET', detail: `zmierzone max_in_flight ${loadProfile?.max_in_flight_measured ?? 0} < ${minimums.concurrency}` });
  }
  return { pass: findings.length === 0, findings };
}

async function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv);
  const envLocal = readEnvLocal(cwd);
  const env = { ...process.env, ...envLocal, ...process.env };
  const repoRoot = path.resolve(cwd, '..', '..');

  const port = Number(args.port ?? 3183);
  if (!Number.isInteger(port) || port < 1024) throw new ToolError(`--port musi być liczbą ≥1024, dostałem: ${args.port}`);
  const market = String(args.market ?? env.NEXT_PUBLIC_PAYLOAD_MARKET_ID ?? '').trim();
  const environment = String(args.environment ?? 'gp-dev');
  const backendUrl = String(args['backend-url'] ?? env.MEDUSA_BACKEND_URL ?? 'http://localhost:9002');
  const waves = Number(args.waves ?? HG13_MIN.waves);
  const skipBuild = args['skip-build'] === true;
  const sequenceContext = String(args['sequence-context'] ?? 'standalone_harness_run');
  const publishableKey = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_PUBLISHABLE_API_KEY;

  if (!market) {
    throw new ToolError(
      'NEXT_PUBLIC_PAYLOAD_MARKET_ID jest puste/nieustawione (ani --market). Po Sprint-3 brak tej ' +
      'zmiennej daje PDP 500 — pomiar bez niej dotyczy innego systemu niż promote (gotcha ADR-145).'
    );
  }
  if (!publishableKey) throw new ToolError('brak NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (env / .env.local)');

  const evidenceDir = path.join(repoRoot, '_bmad-output', 'releases', 'v1.14.0', 'implementation-artifacts', 'evidence');
  const outPath = path.resolve(cwd, String(args.out ?? path.join(evidenceDir, '5-5-cache-leak-e2e.json')));
  const oraclePath = path.join(evidenceDir, '5-5-cache-leak-oracle.json');
  const samplesPath = path.join(repoRoot, 'GP', 'e2e', 'test-results', 'hg13-cache-leak-samples.json');
  const reportPath = path.join(repoRoot, 'GP', 'e2e', 'test-results', 'hg13-cache-leak-playwright.json');

  const buildEnv = { ...env, NEXT_PUBLIC_PAYLOAD_MARKET_ID: market, NODE_ENV: 'production' };
  const baseUrl = `http://127.0.0.1:${port}`;
  const failures = [];

  const evidence = {
    schema: 'gp.v1140.hg13-cache-leak.v1',
    tool: 'cache-leak-hg13',
    story: '5-5-test-przecieku-locale-promote-envelope',
    release: 'v1.14.0',
    gate: 'HG-13',
    market,
    environment,
    acceptance_criteria: ['AC1', 'AC2', 'AC3'],
    generated_at: new Date().toISOString(),
    sequence_context: sequenceContext,
    sequence_context_note:
      'ad15_step_4 = przebieg wykonany jako krok 4 assemblera AD-15 (wiążący dla promote); ' +
      'standalone_harness_run = przebieg harnessu poza sekwencją promote',
    base_url: baseUrl,
    backend_url: backendUrl,
    locales: HG13_LOCALES,
    classes: HG13_CLASSES,
    minimums: HG13_MIN
  };

  // ── AC1 pkt 1: gitlinki submodułów ─────────────────────────────────────
  log('pre-flight: gitlinki submodułów');
  const submodules = assertSubmoduleGitlinks(repoRoot, ['GP/storefront', 'GP/backend']);
  const candidateSha = git(repoRoot, ['rev-parse', 'HEAD']);
  const storefrontSha = git(cwd, ['rev-parse', 'HEAD']);

  // ── AC1 pkt 2: higiena portu ───────────────────────────────────────────
  log(`pre-flight: higiena portu ${port}`);
  const killed = killStaleListeners(port);
  const listenerCheck = assertNoStaleListener(port);
  if (!listenerCheck.clean) {
    throw new NeedsLiveRun(
      `na :${port} po ubiciu wciąż nasłuchują [${listenerCheck.listeners_after_kill.join(', ')}] — ` +
      'obcy listener; pomiar odpytywałby cudzy proces (klasa false-FAIL ze Sprint-3)'
    );
  }

  // ── AC1 pkt 3: fetch-cache / współdzielony .next ───────────────────────
  const artifactActions = purgeBuildArtifacts(cwd, { fullRebuild: !skipBuild });

  evidence.preflight = {
    actions: [
      `git submodule sync + update --init do SHA rodzica (${submodules.map((s) => `${s.path}@${s.sha.slice(0, 12)}`).join(', ')})`,
      `ubito ${killed.killed.length} procesów Next na :${port}` +
        (killed.spared_foreign.length ? `; oszczędzono ${killed.spared_foreign.length} obcych procesów (nie nasze do zabijania)` : ''),
      `potwierdzono brak listenera na :${port} po ubiciu`,
      ...artifactActions
    ],
    submodules,
    port,
    killed_listeners: killed.killed,
    spared_foreign_listeners: killed.spared_foreign,
    listener_check_after_kill: listenerCheck,
    artifact_actions: artifactActions,
    candidate_sha: candidateSha,
    storefront_sha: storefrontSha,
    runtime_mode: 'next_start',
    build_mode: skipBuild ? 'skipped' : 'production',
    env_presence: describeEnvPresence(buildEnv, BUILD_ENV_KEYS),
    env_presence_note: 'zapisana OBECNOŚĆ zmiennych, nigdy wartości (NFR4)',
    policy:
      '`next dev`, pusty submoduł, brak cleanupu fetch-cache i „port odpowiada" bez asercji ownership ' +
      'kończą się TOOL-ERROR/NEEDS-LIVE-RUN/FAIL — nigdy PASS (AC1)'
  };

  // ── AC1 pkt 4: build ───────────────────────────────────────────────────
  if (skipBuild) {
    failures.push({ ac: 'AC1', rule: 'BUILD_SKIPPED', detail: '--skip-build: build_mode != production, przebieg NIE dowodzi AC1' });
    log('UWAGA: --skip-build — ten przebieg NIE dowodzi AC1');
  } else {
    log('next build (to potrwa)…');
    const build = runBuild(cwd, buildEnv);
    evidence.build = { ...build, mode: 'next build (produkcyjny) — dowód z `next dev` nie domyka AC1' };
    if (build.exit_code !== 0) {
      evidence.build.result = 'FAIL';
      failures.push({ ac: 'AC1', rule: 'BUILD_FAILED', detail: `next build exit ${build.exit_code}` });
      finish(evidence, failures, outPath, 1, `next build padł:\n${build.tail}`);
      return;
    }
    evidence.build.result = 'PASS';
    log(`next build OK w ${(build.duration_ms / 1000).toFixed(0)} s`);
  }

  // ── Oracle: zamrożony PRZED pomiarem, z niezależnego źródła ────────────
  log('oracle: zamrażanie fingerprintów z gp-ops (uncached kontrola istnienia w backendzie)');
  const { productHandles, categoryHandles } = await fetchBackendHandles(backendUrl, publishableKey);
  const oracle = buildOracle(repoRoot, {
    market,
    environment,
    availableCategoryHandles: categoryHandles,
    availableProductHandles: productHandles
  });
  const oracleJson = `${JSON.stringify(oracle, null, 2)}\n`;
  fs.mkdirSync(path.dirname(oraclePath), { recursive: true });
  fs.writeFileSync(oraclePath, oracleJson);
  const oracleViolations = oracle.disjointness.flatMap((d) => d.violations);
  if (oracleViolations.length > 0) {
    failures.push({ ac: 'AC2', rule: 'ORACLE_NOT_DISJOINT', detail: JSON.stringify(oracleViolations).slice(0, 400) });
  }
  evidence.oracle = {
    path: path.relative(repoRoot, oraclePath),
    sha256: sha256(Buffer.from(oracleJson, 'utf8')),
    frozen_at: oracle.generated_at,
    independence: oracle.independence,
    sources: oracle.sources,
    resources: oracle.resources.map((r) => ({ class: r.class, resource_id: r.resource_id, url_template: r.url_template })),
    disjointness: oracle.disjointness,
    same_resource_across_classes:
      'katalog i kategoria dzielą resource_id; PDP ma własny — AC2 wymaga TYCH SAMYCH identyfikatorów, ' +
      'zmienną jest wyłącznie locale'
  };
  log(`oracle: ${oracle.resources.map((r) => `${r.class}=${r.resource_id}`).join(', ')}`);

  // ── Start prod-buildu + asercja bindu ──────────────────────────────────
  log(`next start -p ${port} + asercja bindu`);
  const { child, assertion, getServerLogTail } = await startAndAssertBind(cwd, buildEnv, port);
  evidence.preflight.bind_assertion = assertion;
  evidence.preflight.build_id = assertion.build_id;
  evidence.preflight.pid = assertion.child_pid;
  evidence.preflight.listening_pids_owned_by_run = assertion.listening_pids_owned_by_run;
  log(`bind OK: BUILD_ID=${assertion.build_id}, listener ${assertion.listening_pids_owned_by_run.join(',')}`);

  try {
    // ── AC2/AC3: profil HG-13 w zastanym harnessie ───────────────────────
    log(`profil HG-13: cold-fill + ${waves} fal × ${HG13_LOCALES.length * HG13_CLASSES.length} żądań równoległych`);
    const spec = await runHg13Spec({ repoRoot, baseUrl, oraclePath, samplesPath, waves, reportPath });
    evidence.harness = {
      runner: 'GP/e2e — projekt `hg13-cache-leak` (zastana instalacja Playwright, nie nowy framework)',
      spec: 'GP/e2e/specs/locale-cache-leak-hg13.spec.ts',
      spec_exit_code: spec.exit_code,
      raw_report: path.relative(repoRoot, reportPath),
      raw_samples: path.relative(repoRoot, samplesPath),
      tail: spec.tail
    };

    // ── Asercja żywotności PO obciążeniu ────────────────────────────────
    // Asercja bindu biegnie PRZED pomiarem i opiera się na statyku z dysku, więc
    // nie widzi serwera, który zakleszczył się DOPIECO pod obciążeniem profilu.
    // Bez tego kroku przebieg, w którym serwer padł w połowie fal, mógłby dojść
    // do werdyktu na niepełnych próbkach — a „proces żyje, port zbindowany"
    // wyglądałoby na zdrowie. Fail-closed: NeedsLiveRun, nigdy PASS.
    try {
      evidence.preflight.post_load_liveness = await assertServerStillServing(port, {
        paths: HG13_LOCALES.map((l) => `/${l}`),
        budgetMs: 30_000,
        buildId: assertion.build_id,
        phase: 'po profilu HG-13'
      });
    } catch (error) {
      error.message += `\nOgon logu next start:\n${getServerLogTail() || '<pusty>'}`;
      throw error;
    }
    log(`żywotność po obciążeniu OK: ${HG13_LOCALES.map((l) => `/${l}`).join(', ')} renderują`);

    if (!fs.existsSync(samplesPath)) {
      throw new NeedsLiveRun(
        `spec nie wyprodukował ${samplesPath} — brak próbek. „0 tests" albo padnięty selektor to ` +
        `TOOL-ERROR, nie sukces. Ogon:\n${spec.tail}`
      );
    }
    const samplesRaw = fs.readFileSync(samplesPath, 'utf8');
    const samplesDoc = JSON.parse(samplesRaw);
    evidence.harness.raw_samples_sha256 = sha256(Buffer.from(samplesRaw, 'utf8'));

    // Asercja niepustości: selektor, który wykonał 0 testów, ma dać TOOL-ERROR.
    let executedTests = null;
    if (fs.existsSync(reportPath)) {
      try {
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        executedTests = (report.suites ?? []).reduce(
          function count(acc, suite) {
            return acc + (suite.specs ?? []).length +
              (suite.suites ?? []).reduce((a, s) => count(a, s), 0);
          },
          0
        );
      } catch { executedTests = null; }
    }
    evidence.harness.executed_tests = executedTests;
    if (executedTests === 0) {
      throw new ToolError('projekt `hg13-cache-leak` wykonał 0 testów — selektor nie łapie specu (TOOL-ERROR, nie PASS)');
    }

    // Luka i18n zmierzona przy okazji, ale JAWNIE poza werdyktem HG-13:
    // PL-owe `seo.meta_title` serializuje sie w payloadzie RSC na kazdym
    // locale. To nie jest przeciek cache'u — i nie zostaje przemilczane.
    evidence.seo_metadata_locale_gap = samplesDoc.seo_metadata_locale_gap ?? null;

    const counters = computeHg13Counters(samplesDoc.samples ?? [], HG13_LOCALES, HG13_CLASSES);
    const verdict = evaluateHg13({ counters, loadProfile: samplesDoc.load_profile });
    evidence.load_profile = samplesDoc.load_profile;
    evidence.counters = counters;
    evidence.verdict = verdict;
    evidence.budget_policy =
      'budżet G-L1 (MEDIUM <= 5) NIE dotyczy HG-13: jeden przeciek = twardy FAIL, zero wyjątków (AC3)';
    for (const f of verdict.findings) failures.push(f);

    log(
      `HG-13: ${counters.measured_samples} próbek pomiarowych, obce=${counters.foreign_locale_count}, ` +
      `brak własnego=${counters.missing_expected_locale_count}, nieklasyfikowane=${counters.unclassified_count}, ` +
      `max_in_flight=${samplesDoc.load_profile?.max_in_flight_measured}`
    );
  } finally {
    child.kill('SIGKILL');
  }

  evidence.evidence_chain = [
    evidence.harness?.raw_report,
    evidence.harness?.raw_samples,
    evidence.oracle?.path,
    path.relative(repoRoot, outPath)
  ].filter(Boolean);

  finish(evidence, failures, outPath, failures.length === 0 ? 0 : 1, null);
}

function finish(evidence, failures, outPath, exitCode, extraMessage) {
  evidence.failures = failures;
  evidence.pass = failures.length === 0;
  evidence.result = failures.length === 0 ? 'PASS' : 'FAIL';
  evidence.exit_code = exitCode;
  evidence.exit_code_semantics = {
    0: 'PASS — HG-13 spełnione w tym przebiegu',
    1: 'FAIL — przeciek / niepełna macierz / za mała próba lub współbieżność',
    2: 'NEEDS-LIVE-RUN — środowisko nie pozwoliło zmierzyć (NIE jest to zieleń)',
    3: 'TOOL-ERROR — bug narzędzia albo błąd wywołania'
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
  log(`evidence: ${outPath}`);
  if (extraMessage) console.error(extraMessage);
  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} niespełnionych warunków:`);
    for (const f of failures) console.error(`  [${f.ac}] ${f.rule}: ${f.detail}`);
  } else {
    log('PASS: HG-13 — zero obcych fingerprintów na pełnej macierzy.');
  }
  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    if (error instanceof ToolError) {
      console.error(`TOOL-ERROR: ${error.message}`);
      process.exit(3);
    }
    if (error instanceof NeedsLiveRun) {
      console.error(`NEEDS-LIVE-RUN: ${error.message}`);
      console.error('To NIE jest zieleń ani FAIL AC — środowisko nie pozwoliło wykonać pomiaru.');
      process.exit(2);
    }
    console.error('TOOL-ERROR: nieoczekiwany błąd (bug skryptu, NIE brak stacku):');
    console.error(error?.stack ?? String(error));
    process.exit(3);
  });
}
