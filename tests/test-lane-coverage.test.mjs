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
import { dirname, join, relative, sep } from 'node:path';
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
  // from the count without ever reporting a failure. This walks the whole
  // tree — a single-level check would itself miss `tests/a/b/x.test.mjs` and
  // `tests/react-server/sub/x.test.mjs`.
  const collected = readdirSync(testsDir, {
    withFileTypes: true,
    recursive: true,
  });

  const stray = collected
    .filter((entry) => entry.isFile() && isTestFile(entry.name))
    .map((entry) => {
      // `parentPath` is the directory the entry was found in.
      const parent = entry.parentPath ?? entry.path ?? testsDir;
      const rel = relative(testsDir, join(parent, entry.name));
      return rel.split(sep).join('/');
    })
    // Exactly two locations are collected by a lane glob: `<file>` and
    // `react-server/<file>`. Anything with more separators is in neither.
    .filter((rel) => {
      const depth = rel.split('/').length;
      if (depth === 1) return false;
      if (depth === 2 && rel.startsWith('react-server/')) return false;
      return true;
    });

  assert.deepEqual(
    stray,
    [],
    `test files in unrun subdirectories: ${stray.join(', ')}`
  );
});
