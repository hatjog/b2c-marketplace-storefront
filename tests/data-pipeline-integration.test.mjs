import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

// Dynamic imports for runtime-testable functions
const { getFallbackMarketConfig, getMarketLogoUrl } = await import('../src/lib/portal.ts');

const FIXTURE_ROOT = path.join(root, '..', '..', 'specs', 'contracts', 'config', 'fixtures', 'markets');
const SCHEMA_ROOT = path.join(root, '..', '..', 'specs', 'contracts', 'config', 'schemas');

const VALID_FILTER_TYPES = ['category_group', 'tag_group', 'price_range', 'duration', 'seller_rating', 'location'];
const VALID_BLOCK_TYPES = ['hero', 'products_carousel', 'categories_grid', 'banner', 'style_section', 'blog_section'];

// ---------- YAML fixture → config shape ----------

describe('BonBeauty fixture: storefront_filters pipeline', () => {
  const yaml = read(path.join(FIXTURE_ROOT, 'bonbeauty', 'market.bonbeauty.yaml'));

  test('storefront_filters section exists', () => {
    assert.match(yaml, /storefront_filters:/);
  });

  test('every filter has type and label_key fields', () => {
    // Extract filter blocks (type: ... followed by label_key: ...)
    const filterBlocks = yaml.match(/- type: \S+\n\s+label_key: "[^"]+"/g);
    assert.ok(filterBlocks, 'No filter blocks found');
    assert.ok(filterBlocks.length >= 4, `Expected at least 4 filters, got ${filterBlocks.length}`);
  });

  for (const filterType of VALID_FILTER_TYPES) {
    test(`defines filter type: ${filterType}`, () => {
      assert.match(yaml, new RegExp(`type: ${filterType}`),
        `Missing filter type "${filterType}" in BonBeauty fixture`);
    });
  }

  test('label_key values follow filters.* pattern', () => {
    const labelKeys = [...yaml.matchAll(/label_key:\s*"([^"]+)"/g)].map(m => m[1]);
    assert.ok(labelKeys.length > 0);
    for (const key of labelKeys) {
      assert.match(key, /^filters\./, `label_key "${key}" does not start with "filters."`);
    }
  });

  test('tag_group filter has tag_group scope field', () => {
    const tagSection = yaml.match(/type: tag_group[\s\S]*?(?=\n\s+-|\n\S|\n$)/);
    assert.ok(tagSection, 'tag_group filter section not found');
    assert.match(tagSection[0], /tag_group:\s*\S+/);
  });

  test('location filter has display field', () => {
    const locSection = yaml.match(/type: location[\s\S]*?(?=\n\s+-|\n\S|\n$)/);
    assert.ok(locSection, 'location filter section not found');
    assert.match(locSection[0], /display:\s*city/);
  });
});

describe('BonBeauty fixture: homepage sections pipeline', () => {
  const yaml = read(path.join(FIXTURE_ROOT, 'bonbeauty', 'market.bonbeauty.yaml'));

  test('homepage section exists with version', () => {
    assert.match(yaml, /homepage:/);
    assert.match(yaml, /version:\s*"1"/);
  });

  for (const blockType of VALID_BLOCK_TYPES) {
    test(`defines block type: ${blockType}`, () => {
      assert.match(yaml, new RegExp(`${blockType}:`),
        `Missing block type "${blockType}" in BonBeauty fixture`);
    });
  }

  test('hero section has required fields (heading, image, buttons)', () => {
    assert.match(yaml, /hero:[\s\S]*heading:/);
    assert.match(yaml, /hero:[\s\S]*image:/);
    assert.match(yaml, /hero:[\s\S]*buttons:/);
  });

  test('all sections have enabled field', () => {
    const enabledCount = [...yaml.matchAll(/enabled:\s*(true|false)/g)].length;
    assert.ok(enabledCount >= VALID_BLOCK_TYPES.length,
      `Expected at least ${VALID_BLOCK_TYPES.length} enabled flags, got ${enabledCount}`);
  });
});

// ---------- i18n ← filter label_key alignment ----------

describe('i18n: filter label_key translations exist', () => {
  const plMessages = JSON.parse(read('messages/pl.json'));
  const enMessages = JSON.parse(read('messages/en.json'));
  const yaml = read(path.join(FIXTURE_ROOT, 'bonbeauty', 'market.bonbeauty.yaml'));

  const labelKeys = [...yaml.matchAll(/label_key:\s*"([^"]+)"/g)].map(m => m[1]);

  for (const fullKey of labelKeys) {
    // label_key format: "filters.category" → namespace "filters", key "category"
    const [namespace, key] = fullKey.split('.');

    test(`PL translation exists for ${fullKey}`, () => {
      assert.ok(plMessages[namespace], `Namespace "${namespace}" missing in pl.json`);
      assert.ok(plMessages[namespace][key], `Key "${key}" missing in pl.json[${namespace}]`);
    });

    test(`EN translation exists for ${fullKey}`, () => {
      assert.ok(enMessages[namespace], `Namespace "${namespace}" missing in en.json`);
      assert.ok(enMessages[namespace][key], `Key "${key}" missing in en.json[${namespace}]`);
    });
  }
});

// ---------- normalizeFilters validation ----------

describe('normalizeFilters: validates filter config', () => {
  const source = read('src/components/sections/ProductListing/ProductListing.tsx');

  test('validates type is string', () => {
    assert.match(source, /typeof f\.type === 'string'/);
  });

  test('validates label_key is string', () => {
    assert.match(source, /typeof f\.label_key === 'string'/);
  });
});

// ---------- DynamicFilterSidebar: type → component mapping ----------

describe('DynamicFilterSidebar: filter type → component mapping', () => {
  const source = read('src/components/cells/DynamicFilterSidebar/DynamicFilterSidebar.tsx');

  for (const filterType of VALID_FILTER_TYPES) {
    test(`handles filter type: ${filterType}`, () => {
      assert.match(source, new RegExp(`case '${filterType}'`),
        `Missing case for filter type "${filterType}" in DynamicFilterSidebar`);
    });
  }

  test('strips "filters." prefix from label_key for i18n', () => {
    assert.match(source, /filter\.label_key\.startsWith\('filters\.'\)/);
    assert.match(source, /filter\.label_key\.slice\('filters\.'.length\)/);
  });

  test('has default case returning null', () => {
    assert.match(source, /default:\s*\n\s*return null/);
  });

  test('returns null for empty filters', () => {
    assert.match(source, /filters\.length === 0/);
  });
});

// ---------- HomepageRenderer: blockType → component mapping ----------

describe('HomepageRenderer: block type → component mapping', () => {
  const source = read('src/components/blocks/HomepageRenderer.tsx');

  for (const blockType of VALID_BLOCK_TYPES) {
    test(`handles block type: ${blockType}`, () => {
      assert.match(source, new RegExp(`case '${blockType}'`),
        `Missing case for block type "${blockType}" in HomepageRenderer`);
    });
  }

  test('filters by enabled === true', () => {
    assert.match(source, /section\.enabled\s*===\s*true/);
  });

  test('logs error for unknown blockType', () => {
    assert.match(source, /console\.error/);
  });
});

// ---------- getFallbackMarketConfig: runtime ----------

describe('getFallbackMarketConfig: fallback path', () => {
  test('returns config with market_id', () => {
    const config = getFallbackMarketConfig('bonbeauty');
    assert.equal(config.market_id, 'bonbeauty');
  });

  test('returns null for optional fields', () => {
    const config = getFallbackMarketConfig('bonbeauty');
    assert.equal(config.logo, null);
    assert.equal(config.theme, null);
    assert.equal(config.footer, null);
    assert.equal(config.storefront_filters, null);
    assert.equal(config.homepage_sections, null);
  });

  test('generates seo_defaults title pattern from market name', () => {
    const config = getFallbackMarketConfig('bonbeauty');
    assert.match(config.seo_defaults.title_pattern, /bonbeauty/);
  });
});

// ---------- getMarketLogoUrl: runtime ----------

describe('getMarketLogoUrl: logo resolution', () => {
  test('null config → null', () => {
    assert.equal(getMarketLogoUrl(null), null);
  });

  test('string logo → string', () => {
    assert.equal(getMarketLogoUrl({ logo: 'https://cdn.example.com/logo.png' }), 'https://cdn.example.com/logo.png');
  });

  test('object logo → url', () => {
    assert.equal(getMarketLogoUrl({ logo: { url: 'https://cdn.example.com/logo.png' } }), 'https://cdn.example.com/logo.png');
  });

  test('object logo with null url → null', () => {
    assert.equal(getMarketLogoUrl({ logo: { url: null } }), null);
  });

  test('no logo → null', () => {
    assert.equal(getMarketLogoUrl({ name: 'Test' }), null);
  });
});

// ---------- JSON Schema: filter types alignment ----------

describe('JSON Schema: filter type enum matches codebase', () => {
  const schemaPath = path.join(SCHEMA_ROOT, 'storefront-filters.v1.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  test('schema defines type enum', () => {
    // Find the type enum in the schema (may be nested)
    const schemaStr = JSON.stringify(schema);
    for (const filterType of VALID_FILTER_TYPES) {
      assert.ok(schemaStr.includes(`"${filterType}"`),
        `Filter type "${filterType}" missing from JSON schema`);
    }
  });
});
