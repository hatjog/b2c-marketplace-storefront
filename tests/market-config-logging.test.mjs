import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  return fs.readFileSync(absolutePath, 'utf8');
};

test('portal logs market config failures to Sentry', () => {
  const source = read('src/lib/portal.ts');

  assert.match(source, /@sentry\/nextjs/);
  assert.match(source, /logMarketConfigError/);
  assert.match(source, /captureException/);
  assert.match(source, /captureMessage/);
});

test('root layout shows fallback banner and uses head tag', () => {
  const source = read('src/app/layout.tsx');

  assert.match(source, /Korzystasz z fallback MarketConfig/);
  assert.match(source, /<head>/);
  assert.doesNotMatch(source, /next\/head/);
});

test('header uses next/image for logo', () => {
  const source = read('src/components/organisms/Header/Header.tsx');

  assert.match(source, /<Image/);
  assert.doesNotMatch(source, /<img/);
});
