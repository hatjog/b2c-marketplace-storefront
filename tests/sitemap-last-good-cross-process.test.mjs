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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tsx = join(root, 'node_modules/.bin/tsx');
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
  mkdirSync(scriptDir, { recursive: true });
  const scriptPath = join(scriptDir, `child-${counter++}.mts`);
  writeFileSync(scriptPath, code, 'utf8');
  const result = spawnSync(tsx, [scriptPath], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GP_SITEMAP_LAST_GOOD_DIR: dir, NEXT_PUBLIC_MARKET_ID: 'bonbeauty' }
  });
  assert.equal(result.status, 0, `proces potomny padł:\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

test('ostatni dobry wynik przeżywa restart procesu (dwa osobne procesy)', { skip: !existsSync(tsx) && 'brak node_modules/.bin/tsx' }, () => {
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

test('zimny start (brak nośnika) daje brak wyniku, nie pustą listę', { skip: !existsSync(tsx) && 'brak node_modules/.bin/tsx' }, () => {
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
