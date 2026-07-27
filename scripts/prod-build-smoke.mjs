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
 * ══ Użycie ══
 *   node scripts/prod-build-smoke.mjs \
 *     [--port 3182]                # port dedykowany; NIE współdzielony z innym stackiem
 *     [--market bonbeauty]         # default: NEXT_PUBLIC_PAYLOAD_MARKET_ID
 *     [--backend-url http://localhost:9002]
 *     [--out <evidence.json>]      # default: evidence release'u v1.14.0
 *     [--render-evidence <path>]   # gdzie spec Playwright zapisuje swój JSON
 *     [--pdp-samples 8]            # ile handli do macierzy PDP i pomiaru perf
 *     [--skip-build]               # TYLKO iteracja nad narzędziem; evidence dostaje
 *                                  # build.skipped=true i pass=false (nie dowodzi AC1)
 *     [--skip-render]              # pomija AC3; evidence dostaje render.skipped=true
 *                                  # i pass=false — nigdy cichy PASS
 *
 * Sekrety: evidence zapisuje WYŁĄCZNIE nazwy zmiennych i ich obecność
 * (`present` / `EMPTY` / `absent`), nigdy wartości (NFR4).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES = ['pl', 'ua', 'de', 'en'];

/** Klasy route'ów wymagane przez AC2. Ścieżki są konkretne dla App Routera storefrontu. */
const ROUTE_CLASSES = ['catalog', 'categories', 'pdp', 'checkout_entry'];

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

class ToolError extends Error {}
class NeedsLiveRun extends Error {}

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
 * PID-y nasłuchujące na porcie, wyciągnięte z `ss -lptn`. Asercja bindu (AC5)
 * stoi na tym, że listener jest NASZYM procesem — „port odpowiada" to za mało,
 * bo dokładnie tak wygląda zombie next-server z innego builda.
 */
export function parsePortOwners(ssOutput, port) {
  const pids = new Set();
  for (const line of String(ssOutput).split('\n')) {
    if (!new RegExp(`[:.]${port}\\s`).test(line)) continue;
    for (const m of line.matchAll(/pid=(\d+)/g)) pids.add(Number(m[1]));
  }
  return [...pids];
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
    rows.push({ routeClass: 'catalog', locale, url: `/${locale}/categories` });
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

/**
 * Redakcja logu builda przed zapisem do evidence (NFR4).
 *
 * Log builda to zrzut cudzego stdout — nie kontrolujemy, co się w nim znajdzie.
 * Na tym przebiegu było czysto (same URL-e `localhost`), ale wystarczy jeden
 * `fetch` z tokenem w query stringu, żeby sekret wylądował w artefakcie
 * commitowanym do repo. Redagujemy więc zawsze, a nie „gdy zauważymy".
 */
export function redactBuildLog(text) {
  return String(text)
    .replace(
      /([?&][^=&\s]*(?:key|token|secret|password|auth|pwd|sig)[^=&\s]*=)([^&\s"'`]+)/gi,
      '$1<REDACTED>'
    )
    .replace(/\b((?:pk|sk|rk)_(?:test|live)_)[A-Za-z0-9]+/g, '$1<REDACTED>')
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '<REDACTED-LONG-TOKEN>');
}

/** Obecność zmiennych — NIGDY wartości (NFR4). */
export function describeEnvPresence(env, keys) {
  const out = {};
  for (const key of keys) {
    const value = env[key];
    out[key] = value === undefined ? 'absent' : String(value).trim() === '' ? 'EMPTY' : 'present';
  }
  return out;
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

/** Minimalny parser `.env.local` — Next auto-loaduje go w runtime, my nie. */
function readEnvLocal(cwd) {
  const envPath = path.resolve(cwd, '.env.local');
  const result = {};
  if (!fs.existsSync(envPath)) return result;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) result[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return result;
}

const log = (msg) => console.log(`[prod-build-smoke] ${msg}`);

/**
 * Pre-flight AC5 krok 1: ubicie procesów `next-server`/`next start` nasłuchujących
 * na NASZYM porcie. Bez tego smoke potrafi odpytywać stary proces z innego builda
 * (zmierzone w Sprint-3), a wynik — zielony czy czerwony — jest nieinterpretowalny.
 */
function killStaleListeners(port) {
  const ss = spawnSync('ss', ['-lptn'], { encoding: 'utf8' });
  const owners = parsePortOwners(ss.stdout ?? '', port);
  const killed = [];
  for (const pid of owners) {
    let cmdline = '';
    try {
      cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
    } catch {
      continue;
    }
    // Ubijamy WYŁĄCZNIE procesy Next — nie chcemy zabić cudzego stacku dlatego,
    // że akurat trafił na ten sam port. Obcy listener ⇒ NEEDS-LIVE-RUN niżej.
    if (/next-server|next start|next\/dist/.test(cmdline)) {
      try {
        process.kill(pid, 'SIGKILL');
        killed.push({ pid, cmdline: cmdline.slice(0, 120) });
      } catch { /* zniknął sam */ }
    }
  }
  return { owners_before: owners, killed };
}

/** Pre-flight AC5 krok 2/3: stale fetch-cache i współdzielony `.next`. */
function purgeBuildArtifacts(cwd, { fullRebuild }) {
  const nextDir = path.join(cwd, '.next');
  const fetchCache = path.join(nextDir, 'cache', 'fetch-cache');
  const actions = [];
  if (fullRebuild) {
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
      actions.push('rm -rf .next (współdzielony .next kontaminuje middleware)');
    } else {
      actions.push('.next nie istniał (nic do usunięcia)');
    }
  } else if (fs.existsSync(fetchCache)) {
    fs.rmSync(fetchCache, { recursive: true, force: true });
    actions.push('rm -rf .next/cache/fetch-cache (stale fetch-cache)');
  } else {
    actions.push('.next/cache/fetch-cache nie istniał');
  }
  return actions;
}

function runBuild(cwd, env) {
  const started = Date.now();
  const result = spawnSync('node_modules/.bin/next', ['build'], {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const failed = result.status !== 0;
  return {
    exit_code: result.status,
    duration_ms: Date.now() - started,
    warnings: [...stdout.matchAll(/^.*\b(Warning|warn)\b.*$/gim)]
      .map((m) => redactBuildLog(m[0].trim()))
      .slice(0, 40),
    // Ogon logu trafia do evidence WYŁĄCZNIE przy padniętym buildzie, gdzie jest
    // niezbędny diagnostycznie — i nawet wtedy po redakcji. Na ścieżce sukcesu
    // nie ma powodu commitować cudzego stdout do repo (NFR4).
    tail: failed
      ? redactBuildLog((stderr || stdout).split('\n').slice(-25).join('\n'))
      : '(pominięty — build zakończony sukcesem; ogon logu zapisujemy tylko przy FAIL, NFR4)'
  };
}

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

/**
 * Start z artefaktu prod-build + ASERCJA BINDU (AC5 pkt 4). Trzy niezależne
 * dowody, że pytamy TEN proces z TEGO builda:
 *   (a) marker gotowości w stdout naszego dziecka,
 *   (b) PID nasłuchujący na porcie należy do drzewa procesów naszego dziecka,
 *   (c) serwowany HTML odwołuje się do `/_next/static/<BUILD_ID>` z naszego `.next`.
 * Brak którejkolwiek ⇒ NEEDS-LIVE-RUN, nigdy PASS.
 */
async function startAndAssertBind(cwd, env, port) {
  const buildIdPath = path.join(cwd, '.next', 'BUILD_ID');
  if (!fs.existsSync(buildIdPath)) {
    throw new NeedsLiveRun('brak .next/BUILD_ID — nie ma artefaktu prod-build do wystartowania');
  }
  const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();

  const child = spawn('node_modules/.bin/next', ['start', '-p', String(port)], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });

  const deadline = Date.now() + 90_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new NeedsLiveRun(`next start zakończył się kodem ${child.exitCode}:\n${serverLog.slice(-1500)}`);
    }
    if (/Ready in|- Local:|started server on/i.test(serverLog)) { ready = true; break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    child.kill('SIGKILL');
    throw new NeedsLiveRun(`next start nie zgłosił gotowości w 90 s:\n${serverLog.slice(-1500)}`);
  }

  // (b) właściciel portu w drzewie naszego dziecka
  const tree = new Set([child.pid]);
  for (let depth = 0; depth < 4; depth++) {
    const pgrep = spawnSync('pgrep', ['-P', [...tree].join(',')], { encoding: 'utf8' });
    for (const line of (pgrep.stdout ?? '').split('\n')) {
      const pid = Number(line.trim());
      if (pid) tree.add(pid);
    }
  }
  const ss = spawnSync('ss', ['-lptn'], { encoding: 'utf8' });
  const owners = parsePortOwners(ss.stdout ?? '', port);
  const ownedByUs = owners.filter((pid) => tree.has(pid));
  if (owners.length === 0 || ownedByUs.length === 0) {
    child.kill('SIGKILL');
    throw new NeedsLiveRun(
      `asercja bindu NIEUDANA: na :${port} nasłuchują [${owners.join(', ')}], ` +
        `nasze drzewo to [${[...tree].join(', ')}] — „port odpowiada" nie znaczy „to nasz proces"`
    );
  }

  // (c) serwowany artefakt pochodzi z TEGO builda.
  //
  // Sprawdzamy `/_next/static/<BUILD_ID>/_ssgManifest.js`, a NIE obecność BUILD_ID
  // w HTML: App Router nie wstawia ścieżki `/_next/static/<BUILD_ID>/` do markupu
  // (to konwencja Pages Routera), więc asercja na HTML odrzucała poprawny bind.
  // Manifest leży pod BUILD_ID naszego `.next`, więc 200 znaczy „serwer czyta TEN
  // katalog builda".
  //
  // Kontrola negatywna jest częścią asercji, nie ozdobą: serwer, który na wszystko
  // odpowiada 200 (proxy, catch-all, obcy stack), przepuściłby sam pozytywny
  // strzał. Zmyślony BUILD_ID MUSI dać nie-200, inaczej dowód jest pusty.
  const manifestUrl = (id) => `http://127.0.0.1:${port}/_next/static/${id}/_ssgManifest.js`;
  const ours = await fetch(manifestUrl(buildId), { redirect: 'manual' });
  const bogusId = `${buildId}-nie-istnieje`;
  const bogus = await fetch(manifestUrl(bogusId), { redirect: 'manual' });
  if (ours.status !== 200 || bogus.status === 200) {
    child.kill('SIGKILL');
    throw new NeedsLiveRun(
      `asercja bindu NIEUDANA: serwer na :${port} nie potwierdza BUILD_ID=${buildId} ` +
        `(manifest naszego builda → HTTP ${ours.status}, zmyślony BUILD_ID → HTTP ${bogus.status}; ` +
        'oczekiwane 200 / nie-200) — odpowiada inny build albo catch-all (klasa false-FAIL ze Sprint-3)'
    );
  }

  return {
    child,
    assertion: {
      port,
      build_id: buildId,
      child_pid: child.pid,
      listening_pids: owners,
      listening_pids_owned_by_run: ownedByUs,
      build_id_manifest_status: ours.status,
      bogus_build_id_manifest_status: bogus.status,
      build_id_negative_control: 'zmyślony BUILD_ID musi dać nie-200 — inaczej catch-all udaje nasz build',
      ready_marker: /Ready in|- Local:|started server on/i.exec(serverLog)?.[0] ?? null
    }
  };
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

async function main() {
  const cwd = process.cwd();
  const args = parseArgs(process.argv);
  const envLocal = readEnvLocal(cwd);
  const env = { ...process.env, ...envLocal, ...process.env }; // process.env ma priorytet
  const repoRoot = path.resolve(cwd, '..', '..');

  const port = Number(args.port ?? 3182);
  if (!Number.isInteger(port) || port < 1024) throw new ToolError(`--port musi być liczbą ≥1024, dostałem: ${args.port}`);
  const marketId = String(args.market ?? env.NEXT_PUBLIC_PAYLOAD_MARKET_ID ?? '').trim();
  const backendUrl = String(args['backend-url'] ?? env.MEDUSA_BACKEND_URL ?? 'http://localhost:9000');
  const publishableKey = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_PUBLISHABLE_API_KEY;
  const pdpSamples = Number(args['pdp-samples'] ?? 8);
  const skipBuild = args['skip-build'] === true;
  const skipRender = args['skip-render'] === true;
  const outPath = path.resolve(
    cwd,
    String(args.out ?? '../../_bmad-output/releases/v1.14.0/implementation-artifacts/evidence/5-4-prod-build-smoke.json')
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
  const evidence = {
    tool: 'prod-build-smoke',
    story: '5-4-prod-build-smoke-budzet-perf',
    release: 'v1.14.0',
    acceptance_criteria: ['AC1', 'AC2', 'AC3', 'AC4', 'AC5'],
    generated_at: new Date().toISOString(),
    market_id: marketId,
    base_url: baseUrl,
    backend_url: backendUrl,
    locales: LOCALES,
    route_classes: ROUTE_CLASSES,
    thresholds_ad14: AD14
  };
  const failures = [];

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
      finish(evidence, failures, outPath, 1, `next build padł (exit ${build.exit_code}):\n${build.tail}`);
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
    const perfRoutes = [];
    for (const locale of LOCALES) {
      perfRoutes.push({ locale, routeClass: 'catalog', url: `/${locale}/categories` });
      for (const handle of pdpHandles) {
        perfRoutes.push({ locale, routeClass: 'pdp', url: `/${locale}/products/${handle}` });
      }
    }
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

    // NFR-10: kardynalność klucza cache rośnie ×4 przez locale (ADR-152). Bez
    // rewertu Epic 1 nie da się zmierzyć literalnego „przed", więc mierzymy
    // PROXY tej samej osi: podzbiór /pl (kształt sprzed locale-keyed cache,
    // jeden klucz) vs pełne 4 locale (kształt po ADR-152, ×4 klucze).
    const plOnly = pass2.filter((s) => s.locale === 'pl');
    const cardinality = {
      method:
        'PROXY osi ADR-152, nie A/B na rewercie: podzbiór /pl (1 klucz na encję, kształt „przed") ' +
        'vs pełne 4 locale (×4 klucze, kształt „po"). Literalny pomiar „przed" wymagałby rewertu ' +
        'Epic 1 i jest poza zakresem tej story — rozjazd odnotowany jako finding do decyzji.',
      before_proxy_pl_only: {
        hit_rate: computeCacheHitRate(plOnly, coldByUrl),
        p95_ms: percentile(plOnly.map((s) => s.ms))
      },
      after_all_locales: { hit_rate: hitRate, p95_ms: p95 },
      key_cardinality_factor: LOCALES.length
    };

    evidence.perf_budget = {
      method:
        '2 przebiegi po katalogu + PDP na prod-buildzie local (AD-14); przebieg 1 ZIMNY — ' +
        'pomiar wykonany PRZED macierzą HTTP i renderem, żeby nie rozgrzać cache\'u przed pomiarem',
      cache_measured:
        'DATA CACHE (unstable_cache, ADR-152) — nie full route cache; sygnał hit-rate opisany ' +
        'w hit_rate.signal_breakdown',
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

  finish(evidence, failures, outPath, failures.length === 0 ? 0 : 1, null);
}

function finish(evidence, failures, outPath, exitCode, extraMessage) {
  evidence.failures = failures;
  evidence.pass = failures.length === 0;
  evidence.exit_code = exitCode;
  evidence.exit_code_semantics = {
    0: 'PASS — wszystkie AC spełnione w tym przebiegu',
    1: 'FAIL — realne niespełnienie AC',
    2: 'NEEDS-LIVE-RUN — środowisko niedostępne (NIE jest to zieleń)',
    3: 'TOOL-ERROR — bug narzędzia albo błąd konfiguracji wywołania'
  };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
  log(`evidence: ${outPath}`);
  if (extraMessage) console.error(extraMessage);
  if (failures.length > 0) {
    console.error(`FAIL: ${failures.length} niespełnionych warunków:`);
    for (const f of failures) console.error(`  [${f.ac}] ${f.rule}: ${f.detail}`);
  } else {
    log('PASS: AC1–AC5 spełnione w tym przebiegu.');
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
