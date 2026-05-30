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
  const source = read('src/lib/portal.server.ts');

  assert.match(source, /@sentry\/nextjs/);
  assert.match(source, /logMarketConfigError/);
  assert.match(source, /captureException/);
  assert.match(source, /captureMessage/);
});

test('root layout shows fallback banner and uses head tag', () => {
  const source = read('src/app/layout.tsx');

  assert.match(source, /Korzystasz z fallback MarketConfig/);
  assert.match(source, /<head>/);
  assert.doesNotMatch(source, /next\/head['"]/);
  assert.match(source, /<html[\s\S]*suppressHydrationWarning/);
  assert.match(source, /<body[\s\S]*suppressHydrationWarning/);
});

test('header uses next/image for logo', () => {
  const source = read('src/components/organisms/Header/Header.tsx');

  assert.match(source, /<Image/);
  assert.doesNotMatch(source, /<img/);
});

test('category cards fall back to placeholder image for unknown category handles', () => {
  const source = read('src/components/organisms/CategoryCard/CategoryCard.tsx');

  assert.match(source, /CATEGORY_IMAGE_HANDLES/);
  assert.match(source, /\? `\/images\/categories\/\$\{category\.handle\}\.png`/);
  assert.match(source, /: '\/images\/placeholder\.svg'/);
});
