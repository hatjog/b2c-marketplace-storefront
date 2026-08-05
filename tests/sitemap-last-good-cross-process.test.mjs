/**
 * Story 2.2 v1.15.0 — AC2: nośnik ostatniego dobrego wyniku PRZEŻYWA RESTART
 * PROCESU.
 *
 * Test uruchamia DWA osobne procesy node/tsx:
 *   proces 1 — zapisuje ostatni dobry wynik tą samą funkcją, którą woła
 *              świeży odczyt w `buildSitemap()` (`writeLastGood`),
 *   proces 2 — startuje od zera (żadnej pamięci modułowej po procesie 1)
 *              i odczytuje snapshot ze znacznikiem świeżości.
 *
 * Zmienna modułowa albo cache Next tego testu NIE przechodzą — o to chodzi.
 * Ograniczenie zapisane wprost: to jest dowód TRWAŁOŚCI NOŚNIKA między
 * procesami, nie dowód pełnej degradacji na prod-buildzie (patrz Dev Notes
 * story 2.2, T7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Runner `tsx` rozwiązywany, nie ZAKŁADANY — review 2.2 [MEDIUM].
 *
 * Poprzednia wersja liczyła wyłącznie na `<root>/node_modules/.bin/tsx` i przy
 * jego braku robiła `{ skip: ... }`. W tym repo zależności są hoistowane do
 * roota workspace, więc `GP/storefront/node_modules/.bin` NIE ISTNIEJE —
 * a `node --test` liczy `skip` jako sukces. Efekt: jedyna automatyczna bramka
 * trwałości nośnika (AC2) znikała bez żadnego sygnału, a suite kończyła się
 * zielono. Skip w bramce dowodowej jest równoważny jej braku.
 *
 * Dlatego: rozwiązujemy binarkę przez `require.resolve('tsx/package.json')`
 * (odporne na hoistowanie i na strategię pnpm), z fallbackiem do ścieżek `.bin`
 * w storefroncie i w rootach workspace. Gdy naprawdę nie da się jej znaleźć —
 * test FAILUJE z instrukcją, nie pomija.
 */
function resolveTsxRunner() {
  const require = createRequire(join(root, 'package.json'));
  const attempted = [];

  try {
    const pkgPath = require.resolve('tsx/package.json');
    const cli = join(dirname(pkgPath), 'dist/cli.mjs');
    attempted.push(cli);
    if (existsSync(cli)) return { cmd: process.execPath, prefix: [cli], attempted };
  } catch (error) {
    attempted.push(`require.resolve('tsx/package.json'): ${error.message}`);
  }

  for (const candidate of [
    join(root, 'node_modules/.bin/tsx'),
    join(root, '../../node_modules/.bin/tsx'),
    join(root, '../../../node_modules/.bin/tsx')
  ]) {
    attempted.push(candidate);
    if (existsSync(candidate)) return { cmd: candidate, prefix: [], attempted };
  }

  return { cmd: null, prefix: [], attempted };
}

const runner = resolveTsxRunner();
const storeModule = join(root, 'src/lib/seo/sitemap-last-good.ts');
const scriptDir = join(root, 'tests/.tmp-cross-process');
let counter = 0;

// tsx kompiluje moduł `.ts` do CJS, więc nazwane eksporty trzeba wyjąć z
// namespace'u dynamicznego importu (statyczny `import { x } from '...ts'`
// wywraca się na `does not provide an export named`).
const importStore = `const __store = await import(${JSON.stringify(storeModule)});
       const { writeLastGood, readLastGood, snapshotAgeSeconds } = __store.default ?? __store;`;

function runInFreshProcess(code, dir) {
  // Skrypt idzie do pliku, nie do `tsx -e`: `-e` kompiluje do CJS i wywraca
  // się na top-level await. Plik musi leżeć W PROJEKCIE — poza nim loader tsx
  // nie transformuje importowanego modułu `.ts`.
  assert.ok(
    runner.cmd,
    'nie udało się rozwiązać runnera `tsx` — bramka trwałości nośnika (AC2) nie ' +
      'ma czym się wykonać, więc FAILUJE zamiast pomijać (skip = brak bramki). ' +
      `Sprawdzone ścieżki:\n${runner.attempted.join('\n')}\n` +
      'Napraw przez `pnpm install` w roocie workspace albo dodaj `tsx` do devDependencies storefrontu.'
  );
  mkdirSync(scriptDir, { recursive: true });
  const scriptPath = join(scriptDir, `child-${counter++}.mts`);
  writeFileSync(scriptPath, code, 'utf8');
  const result = spawnSync(runner.cmd, [...runner.prefix, scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GP_SITEMAP_LAST_GOOD_DIR: dir, NEXT_PUBLIC_MARKET_ID: 'bonbeauty' }
  });
  assert.equal(result.status, 0, `proces potomny padł:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

test('ostatni dobry wynik przeżywa restart procesu (dwa osobne procesy)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sitemap-crossproc-'));
  try {
    // Proces 1: udana generacja zapisuje ostatni dobry wynik.
    const written = runInFreshProcess(
      `${importStore}
       const ok = await writeLastGood('sellers', [{ handle: 'city-beauty' }], new Date(Date.now() - 3600_000));
       console.log(JSON.stringify({ ok, pid: process.pid }));`,
      dir
    );
    const first = JSON.parse(written);
    assert.equal(first.ok, true);

    // Proces 2: całkowicie nowy proces — żadnej pamięci modułowej po pierwszym.
    const read = runInFreshProcess(
      `${importStore}
       const snap = await readLastGood('sellers');
       console.log(JSON.stringify({ pid: process.pid, snap, age: snap ? snapshotAgeSeconds(snap) : null }));`,
      dir
    );
    const second = JSON.parse(read);

    assert.notEqual(second.pid, first.pid, 'to musi być inny proces, inaczej dowód jest pusty');
    assert.ok(second.snap, 'ostatni dobry wynik nie przeżył restartu procesu');
    assert.deepEqual(second.snap.items, [{ handle: 'city-beauty' }]);
    assert.ok(second.age >= 3500, `wiek danych nie jest widoczny/poprawny: ${second.age}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(scriptDir, { recursive: true, force: true });
  }
});

test('zimny start (brak nośnika) daje brak wyniku, nie pustą listę', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sitemap-cold-'));
  try {
    const out = runInFreshProcess(
      `${importStore}
       console.log(JSON.stringify({ snap: await readLastGood('sellers') }));`,
      dir
    );
    assert.equal(JSON.parse(out).snap, null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(scriptDir, { recursive: true, force: true });
  }
});
