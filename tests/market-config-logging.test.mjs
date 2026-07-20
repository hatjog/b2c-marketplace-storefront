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

test('header uses LogoLockup for brand logo', () => {
  const source = read('src/components/organisms/Header/Header.tsx');

  assert.match(source, /LogoLockup/);
  assert.match(source, /logoSrc=\{marketLogoUrl\}/);
  assert.doesNotMatch(source, /\{marketName\}/);
});

test('category cards fall back to placeholder image for unknown category handles', () => {
  // Fallback logic lives in the ONE `category-images` reader (AD-10) so every
  // category tile resolves a guaranteed-valid <Image> src.
  const helper = read('src/lib/category-images.ts');

  assert.match(helper, /CATEGORY_IMAGE_HANDLES/);
  assert.match(helper, /`\/images\/categories\/\$\{handle\}\.png`/);
  assert.match(helper, /CATEGORY_IMAGE_PLACEHOLDER = '\/images\/placeholder\.svg'/);

  const card = read('src/components/organisms/CategoryCard/CategoryCard.tsx');
  assert.match(card, /resolveCategoryImage\(category\.handle, category\.metadata\)/);
});
