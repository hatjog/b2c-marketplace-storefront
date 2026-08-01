/**
 * Guard for the two-lane `test:node` split.
 *
 * `tests/` runs under the default Node resolution; `tests/react-server/` runs
 * with `--conditions=react-server`, which is required by anything whose import
 * chain reaches `server-only` (that package throws unless the `react-server`
 * condition selects its empty build).
 *
 * The condition CANNOT be applied globally: it also swaps React for its RSC
 * build, which has no `createContext`, so `homepage-renderer.test.mjs` dies at
 * import and takes its 17 tests with it. Measured on the v1.14.0 baseline:
 * one lane = 418 tests / 12 fail, global react-server = 401 tests / 7 fail —
 * fewer failures bought by silently running 17 fewer tests.
 *
 * This guard exists because the split is a naming convention, and a naming
 * convention that nothing checks is how a test file ends up in neither lane.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import test from 'node:test';

const testsDir = dirname(fileURLToPath(import.meta.url));

const isTestFile = (name) => name.endsWith('.test.mjs');

test('every .test.mjs file sits in exactly one test:node lane', () => {
  const defaultLane = readdirSync(testsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isTestFile(entry.name))
    .map((entry) => entry.name);

  const rscLane = readdirSync(join(testsDir, 'react-server'), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && isTestFile(entry.name))
    .map((entry) => entry.name);

  assert.ok(defaultLane.length > 0, 'default lane must not be empty');
  assert.ok(rscLane.length > 0, 'react-server lane must not be empty');

  const overlap = defaultLane.filter((name) => rscLane.includes(name));
  assert.deepEqual(overlap, [], `test files present in BOTH lanes: ${overlap}`);
});

test('no .test.mjs file hides in an unrun subdirectory of tests/', () => {
  // Both lane globs are single-level (`tests/*` and `tests/react-server/*`).
  // A test file nested any deeper is collected by neither and would vanish
  // from the count without ever reporting a failure.
  const strayDirs = readdirSync(testsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'react-server')
    .flatMap((entry) => {
      const nested = readdirSync(join(testsDir, entry.name), {
        withFileTypes: true,
      })
        .filter((child) => child.isFile() && isTestFile(child.name))
        .map((child) => `${entry.name}/${child.name}`);
      return nested;
    });

  assert.deepEqual(
    strayDirs,
    [],
    `test files in unrun subdirectories: ${strayDirs.join(', ')}`
  );
});
