/**
 * prod-stack-lifecycle.mjs — współdzielony lifecycle prod-buildu storefrontu.
 *
 * ══ Dlaczego ten plik istnieje ══
 * Story 5.4 zbudowała w `prod-build-smoke.mjs` higienę środowiska + start
 * `next start` + asercję bindu. Story 5.5 (HG-13, cache-leak E2E) potrzebuje
 * DOKŁADNIE tego samego pre-flightu — AC1 wymaga, żeby był częścią pomiaru.
 *
 * Skopiowanie go dałoby TRZECI harness z własną, dryfującą kopią asercji bindu.
 * Zamiast tego lifecycle mieszka tutaj, a oba skrypty go IMPORTUJĄ. Jedna
 * poprawka w asercji bindu naprawia oba pomiary, nie jeden z nich.
 *
 * Zawartość jest przeniesiona 1:1 z `prod-build-smoke.mjs` (v1.14.0 story 5.4);
 * `prod-build-smoke.mjs` re-eksportuje te symbole, żeby jego zastane testy
 * jednostkowe dalej importowały je stamtąd bez zmiany.
 *
 * Sekrety: funkcje tego modułu zapisują WYŁĄCZNIE nazwy zmiennych i ich
 * obecność (`present` / `EMPTY` / `absent`), nigdy wartości (NFR4).
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

/** Błąd wywołania/narzędzia — exit 3. Nie jest to brak środowiska. */
export class ToolError extends Error {}
/** Środowisko nie pozwoliło wykonać pomiaru — exit 2. NIE jest to zieleń ani FAIL AC. */
export class NeedsLiveRun extends Error {}

function resolveNextCli() {
  try {
    return require.resolve('next/dist/bin/next');
  } catch (cause) {
    throw new NeedsLiveRun(
      'brak zależności Next.js w storefront/node_modules — prod-build jest niewykonalny',
      { cause }
    );
  }
}

/**
 * PID-y nasłuchujące na porcie, wyciągnięte z `ss -lptn`. Asercja bindu stoi na
 * tym, że listener jest NASZYM procesem — „port odpowiada" to za mało, bo
 * dokładnie tak wygląda zombie next-server z innego builda (Sprint-3: 452 false-FAIL).
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
 * Redakcja cudzego stdout przed zapisem do evidence (NFR4). Redagujemy zawsze,
 * a nie „gdy zauważymy" — wystarczy jeden fetch z tokenem w query stringu.
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

/** Minimalny parser `.env.local` — Next auto-loaduje go w runtime, my nie. */
export function readEnvLocal(cwd) {
  const envPath = path.resolve(cwd, '.env.local');
  const result = {};
  if (!fs.existsSync(envPath)) return result;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match) result[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return result;
}

/**
 * Pre-flight krok 1: ubicie procesów `next-server`/`next start` nasłuchujących
 * na NASZYM porcie. Bez tego smoke potrafi odpytywać stary proces z innego
 * builda, a wynik — zielony czy czerwony — jest nieinterpretowalny.
 *
 * Ubijamy WYŁĄCZNIE procesy Next: nie chcemy zabić cudzego stacku dlatego, że
 * akurat trafił na ten sam port. Obcy listener zostaje i przewraca asercję bindu.
 */
export function killStaleListeners(port) {
  const ss = spawnSync('ss', ['-lptn'], { encoding: 'utf8' });
  const owners = parsePortOwners(ss.stdout ?? '', port);
  const killed = [];
  const spared = [];
  for (const pid of owners) {
    let cmdline = '';
    try {
      cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ');
    } catch {
      continue;
    }
    if (/next-server|next start|next\/dist/.test(cmdline)) {
      try {
        process.kill(pid, 'SIGKILL');
        killed.push({ pid, cmdline: cmdline.slice(0, 120) });
      } catch { /* zniknął sam */ }
    } else {
      spared.push({ pid, cmdline: cmdline.slice(0, 120) });
    }
  }
  return { owners_before: owners, killed, spared_foreign: spared };
}

/**
 * Potwierdzenie, że po ubiciu na porcie NIE MA już starego listenera.
 * Samo „wywołaliśmy kill" nie jest dowodem — AC1 wymaga potwierdzenia stanu.
 */
export function assertNoStaleListener(port, { timeoutMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let owners = [];
  for (;;) {
    const ss = spawnSync('ss', ['-lptn'], { encoding: 'utf8' });
    owners = parsePortOwners(ss.stdout ?? '', port);
    if (owners.length === 0 || Date.now() >= deadline) break;
    spawnSync('sleep', ['0.25']);
  }
  return { port, listeners_after_kill: owners, clean: owners.length === 0 };
}

/** Pre-flight krok 2/3: stale fetch-cache i współdzielony `.next`. */
export function purgeBuildArtifacts(cwd, { fullRebuild, distDir = '.next' }) {
  const nextDir = path.join(cwd, distDir);
  const fetchCache = path.join(nextDir, 'cache', 'fetch-cache');
  const actions = [];
  if (fullRebuild) {
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
      actions.push(`rm -rf ${distDir} (współdzielony .next kontaminuje middleware)`);
    } else {
      actions.push(`${distDir} nie istniał (nic do usunięcia)`);
    }
  } else if (fs.existsSync(fetchCache)) {
    fs.rmSync(fetchCache, { recursive: true, force: true });
    actions.push(`rm -rf ${distDir}/cache/fetch-cache (stale fetch-cache)`);
  } else {
    actions.push(`${distDir}/cache/fetch-cache nie istniał`);
  }
  return actions;
}

export function runBuild(cwd, env) {
  const started = Date.now();
  const nextCli = resolveNextCli();
  const result = spawnSync(process.execPath, [nextCli, 'build'], {
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
    tail: failed
      ? redactBuildLog((stderr || stdout).split('\n').slice(-25).join('\n'))
      : '(pominięty — build zakończony sukcesem; ogon logu zapisujemy tylko przy FAIL, NFR4)'
  };
}

/**
 * Start z artefaktu prod-build + ASERCJA BINDU. Trzy niezależne dowody, że
 * pytamy TEN proces z TEGO builda:
 *   (a) marker gotowości w stdout naszego dziecka,
 *   (b) PID nasłuchujący na porcie należy do drzewa procesów naszego dziecka,
 *   (c) `/_next/static/<BUILD_ID>/_ssgManifest.js` z naszego `.next` daje 200,
 *       a zmyślony BUILD_ID daje NIE-200 (kontrola negatywna — serwer, który na
 *       wszystko odpowiada 200, przepuściłby sam pozytywny strzał).
 * Brak którejkolwiek ⇒ NeedsLiveRun, nigdy PASS.
 */
/**
 * Asercja, że serwer NADAL RENDERUJE — nie że „port jest zajęty".
 *
 * ══ Dlaczego to nie jest kolejny health check ══
 * `startAndAssertBind` sprawdza bind + tożsamość builda, ale robi to
 *   (a) RAZ, przed pomiarem, i
 *   (b) na `/_next/static/<BUILD_ID>/_ssgManifest.js` — czyli na PLIKU Z DYSKU.
 * Serwer, któremu zakleszczył się pipeline SSR, dalej odda ten plik: statyki
 * serwuje warstwa, która nie potrzebuje renderu. Dokładnie tak wygląda objaw
 * zgłoszony przez PO: proces żyje, port zbindowany, `curl` na stronę wisi.
 * Bramka oparta na bindzie świeci wtedy zielenią na martwym serwisie — to ta
 * sama klasa co „mechanizm istnieje, ale nie mierzy tego, co ma mierzyć".
 *
 * Dlatego ta funkcja:
 *   • odpytuje TRASY SSR (`/pl`, …), nigdy statyków;
 *   • wymaga 200 ORAZ ciała, które wygląda jak wyrenderowany dokument — puste
 *     200 z catch-all nie jest dowodem renderu;
 *   • ma twardy budżet czasu: brak odpowiedzi w budżecie to FAIL, nie „wolno";
 *   • jest fail-closed — timeout, ECONNREFUSED i socket hang up kończą się
 *     NeedsLiveRun/FAIL, nigdy cichym PASS.
 * Kontrolnie odpytuje też statyk, żeby EVIDENCE zapisało sygnaturę
 * „statyk 200 / SSR martwy" zamiast gubić ją w jednym zbiorczym błędzie.
 */
export async function assertServerStillServing(
  port,
  { paths = ['/pl'], budgetMs = 30_000, buildId = null, phase = 'post-load' } = {}
) {
  const probes = [];
  for (const p of paths) {
    const url = `http://127.0.0.1:${port}${p}`;
    const t0 = Date.now();
    let status = null;
    let bytes = 0;
    let error = null;
    let looksRendered = false;
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(budgetMs) });
      status = res.status;
      const body = await res.text();
      bytes = body.length;
      looksRendered = /<html[\s>]/i.test(body) || /<!doctype html/i.test(body);
    } catch (e) {
      // AbortSignal.timeout → TimeoutError. Rozróżniamy je od odmowy połączenia,
      // bo to DWA różne tryby awarii: zakleszczony render vs martwy listener.
      error = e?.name === 'TimeoutError'
        ? `brak odpowiedzi w ${budgetMs} ms (zakleszczenie renderu — port żyje, render nie)`
        : String(e?.message ?? e);
    }
    probes.push({ url, status, bytes, looks_rendered: looksRendered, duration_ms: Date.now() - t0, error });
  }

  // Kontrola: statyk z dysku. Jeśli on odpowiada, a SSR nie — to jest DOKŁADNIE
  // ta sygnatura, którą bramka na bindzie przepuszcza.
  let staticProbe = null;
  if (buildId) {
    const url = `http://127.0.0.1:${port}/_next/static/${buildId}/_ssgManifest.js`;
    try {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(budgetMs) });
      await res.text();
      staticProbe = { url, status: res.status };
    } catch (e) {
      staticProbe = { url, status: null, error: String(e?.message ?? e) };
    }
  }

  const dead = probes.filter((p) => p.status !== 200 || !p.looks_rendered);
  const assertion = {
    phase,
    port,
    budget_ms: budgetMs,
    probes,
    static_control: staticProbe,
    contract:
      'trasa SSR musi zwrócić 200 z wyrenderowanym dokumentem; statyk odpowiadający ' +
      'przy martwym SSR to sygnatura „proces żyje, port zbindowany, zero odpowiedzi"',
    ok: dead.length === 0
  };

  if (dead.length > 0) {
    const detail = dead
      .map((p) => `${p.url} → ${p.error ? p.error : `HTTP ${p.status}, ${p.bytes} B, rendered=${p.looks_rendered}`}`)
      .join('; ');
    const staticNote =
      staticProbe && staticProbe.status === 200
        ? ` STATYK ODPOWIADA (${staticProbe.url} → 200), więc asercja bindu przepuściłaby ten stan jako zielony.`
        : '';
    throw new NeedsLiveRun(
      `serwer na :${port} przestał renderować (${phase}): ${detail}.${staticNote} ` +
        '„Port zbindowany" nie jest dowodem, że serwis odpowiada.'
    );
  }

  return assertion;
}

export async function startAndAssertBind(cwd, env, port, { distDir = '.next' } = {}) {
  const nextCli = resolveNextCli();
  const buildIdPath = path.join(cwd, distDir, 'BUILD_ID');
  if (!fs.existsSync(buildIdPath)) {
    throw new NeedsLiveRun(`brak ${distDir}/BUILD_ID — nie ma artefaktu prod-build do wystartowania`);
  }
  const buildId = fs.readFileSync(buildIdPath, 'utf8').trim();

  const child = spawn(process.execPath, [nextCli, 'start', '-p', String(port)], {
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
    getServerLogTail: () => redactBuildLog(serverLog.slice(-4000)),
    assertion: {
      port,
      build_id: buildId,
      child_pid: child.pid,
      process_tree: [...tree],
      listening_pids: owners,
      listening_pids_owned_by_run: ownedByUs,
      build_id_manifest_status: ours.status,
      bogus_build_id_manifest_status: bogus.status,
      build_id_negative_control: 'zmyślony BUILD_ID musi dać nie-200 — inaczej catch-all udaje nasz build',
      ready_marker: /Ready in|- Local:|started server on/i.exec(serverLog)?.[0] ?? null
    }
  };
}
