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

  // DW-15-326: the banner copy moved to messages/*.json in the i18n sweep
  // d16b69c4a; the layout renders it via tCommon('market_config_fallback').
  assert.match(source, /showFallbackBanner && \([\s\S]*?tCommon\('market_config_fallback'\)/);
  const plMessages = JSON.parse(read('messages/pl.json'));
  assert.match(plMessages.common.market_config_fallback, /Korzystasz z fallback MarketConfig/);
  assert.match(source, /<head>/);
  assert.doesNotMatch(source, /next\/head['"]/);
  assert.match(source, /<html[\s\S]*suppressHydrationWarning/);
  assert.match(source, /<body[\s\S]*suppressHydrationWarning/);
});

test('header uses LogoLockup for brand logo', () => {
  const source = read('src/components/organisms/Header/Header.tsx');

  assert.match(source, /LogoLockup/);
  // DW-15-326: brand lockup since 36578710d — no market-configured logo source.
  assert.doesNotMatch(source, /logoSrc=/);
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
