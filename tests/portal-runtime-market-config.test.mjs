import test from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = global.fetch;

function restoreEnvironment() {
  global.fetch = originalFetch;
}

async function importPortalServerModule(tag) {
  const moduleUrl = new URL('../src/lib/portal.server.ts', import.meta.url);
  return import(`${moduleUrl.href}?${tag}`);
}

test('resolveMarketConfig uses Bonbeauty runtime YAML without calling Payload', async () => {
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network should not be called when runtime market config exists');
  };

  try {
    const module = await importPortalServerModule(`runtime-market-config=${Date.now()}`);
    const { resolveMarketConfig } = module.default ?? module;
    const result = await resolveMarketConfig('bonbeauty');

    assert.equal(fetchCalls, 0);
    assert.equal(result.usedFallback, false);
    assert.equal(result.marketConfig.name, 'BonBeauty');
    assert.equal(result.marketConfig.logo, '/api/runtime-market-assets/bonbeauty/assets/logo.svg');
    assert.equal(Array.isArray(result.marketConfig.homepage_sections), true);
    assert.equal(result.marketConfig.homepage_sections.length, 6);

    const heroSection = result.marketConfig.homepage_sections.find(
      section => section?.blockType === 'hero'
    );
    assert.equal(heroSection?.image, '/api/runtime-market-assets/bonbeauty/assets/hero.jpg');

    const bannerSection = result.marketConfig.homepage_sections.find(
      section => section?.blockType === 'banner'
    );
    assert.equal(bannerSection?.cta_link, '/collections');
    assert.equal(bannerSection?.image, '/api/runtime-market-assets/bonbeauty/assets/banner.jpg');

    const tagGroupFilter = result.marketConfig.storefront_filters?.find(
      filter => filter?.type === 'tag_group'
    );
    assert.equal(tagGroupFilter?.tag_group, 'treatment-type');
  } finally {
    restoreEnvironment();
  }
});

test('resolveMarketConfig uses Mercur runtime YAML assets without calling Payload', async () => {
  let fetchCalls = 0;

  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network should not be called when runtime market config exists');
  };

  try {
    const module = await importPortalServerModule(`runtime-market-config-mercur=${Date.now()}`);
    const { resolveMarketConfig } = module.default ?? module;
    const result = await resolveMarketConfig('mercur');

    assert.equal(fetchCalls, 0);
    assert.equal(result.usedFallback, false);
    assert.equal(result.marketConfig.logo, '/api/runtime-market-assets/mercur/assets/logo.svg');

    const heroSection = result.marketConfig.homepage_sections.find(
      section => section?.blockType === 'hero'
    );
    assert.equal(heroSection?.image, '/api/runtime-market-assets/mercur/assets/hero.jpg');
  } finally {
    restoreEnvironment();
  }
});