import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pageSource = readFileSync('src/app/[locale]/(main)/sellers/[handle]/page.tsx', 'utf8');
const heroSource = readFileSync(
  'src/components/organisms/seller/SellerHero/SellerHero.tsx',
  'utf8'
);
const headerSource = readFileSync(
  'src/components/sections/SellerPageHeader/SellerPageHeader.tsx',
  'utf8'
);
const proofSource = readFileSync('src/components/atoms/SellerProof/SellerProof.tsx', 'utf8');
const tabsSource = readFileSync('src/components/organisms/SellerTabs/SellerTabs.tsx', 'utf8');

test('seller-detail hero follows contract A without unconditional verified badge', () => {
  assert.match(heroSource, /data-testid="seller-hero-breadcrumbs"/);
  assert.match(heroSource, /data-testid="seller-hero-gold-scrim"/);
  assert.match(heroSource, /data-testid="seller-hero-monogram"/);
  assert.match(heroSource, /text-\[40px\]/);
  assert.match(heroSource, /leading-\[46px\]/);
  assert.match(heroSource, /verified \? \(/);
  assert.match(headerSource, /verified=\{seller\.verified === true\}/);
});

test('seller-detail proof and related sellers expose four-up contract surfaces', () => {
  assert.match(pageSource, /responseTimeValue: '~4h'/);
  assert.match(proofSource, /lg:grid-cols-4/);
  assert.match(pageSource, /data-testid="seller-detail-others-strip"/);
  assert.match(pageSource, /lg:grid-cols-4/);
});

test('seller tabs render real data surfaces and no team-grid placeholder', () => {
  assert.match(tabsSource, /seller\.gallery\?\.filter\(item => item\?\.url\)\.slice\(0, 6\)/);
  assert.match(tabsSource, /data-testid="seller-gallery-6"/);
  assert.match(tabsSource, /data-testid="seller-hours-table"/);
  assert.match(tabsSource, /data-testid=\{item\.isToday \? 'seller-hours-today' : undefined\}/);
  assert.match(tabsSource, /const policy = seller\.policy\?\.trim\(\)/);
  assert.doesNotMatch(tabsSource, /team-grid|team_members|placeholder team/i);
});

test('seller-detail renders sticky bar with real contact channels only', () => {
  assert.match(pageSource, /data-testid="seller-sticky-bar"/);
  assert.match(pageSource, /seller\.phone \? \(/);
  assert.match(pageSource, /seller\.email \? \(/);
});
