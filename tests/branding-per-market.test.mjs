import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const REQUIRED_BRAND_VARS = [
  '--brand-25', '--brand-50', '--brand-100', '--brand-200', '--brand-300',
  '--brand-400', '--brand-500', '--brand-600', '--brand-700', '--brand-800',
  '--brand-900'
];

const RGB_TUPLE_RE = /(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)),\s*(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)),\s*(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?))/;

// ---------- Theme CSS validation ----------

describe('theme CSS: bonbeauty', () => {
  const themePath = 'public/themes/bonbeauty.css';
  const css = read(themePath);

  test('theme file exists and is non-empty', () => {
    assert.ok(css.length > 0);
  });

  for (const varName of REQUIRED_BRAND_VARS) {
    test(`defines ${varName} as RGB tuple`, () => {
      const re = new RegExp(`${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${RGB_TUPLE_RE.source}`);
      assert.match(css, re, `Missing or malformed ${varName} in ${themePath}`);
    });
  }

  test('uses :root selector', () => {
    assert.match(css, /:root\s*\{/);
  });
});

// ---------- Layout: theme stylesheet loading ----------

describe('layout.tsx: theme loading', () => {
  const layout = read('src/app/layout.tsx');

  test('validates theme against allowlist before constructing stylesheet path', () => {
    assert.match(layout, /VALID_THEMES/);
    assert.match(layout, /VALID_THEMES\.includes\(marketConfig\.theme\)/);
  });

  test('resolves theme stylesheet from marketConfig.theme', () => {
    assert.match(layout, /`\/themes\/\$\{marketConfig\.theme\}\.css`/);
  });

  test('conditionally renders <link> for theme stylesheet', () => {
    assert.match(layout, /themeStylesheet && \(/);
    assert.match(layout, /rel="stylesheet"/);
    assert.match(layout, /href=\{themeStylesheet\}/);
  });
});

// ---------- Header: config-driven branding ----------

describe('Header: config-driven branding', () => {
  const header = read('src/components/organisms/Header/Header.tsx');

  test('logo sourced from marketConfig (getMarketLogoUrl)', () => {
    assert.match(header, /getMarketLogoUrl\(marketConfig\)/);
  });

  test('market name sourced from marketConfig', () => {
    assert.match(header, /marketConfig\?\.name/);
  });

  test('logo rendered conditionally (not hardcoded)', () => {
    assert.match(header, /marketLogoUrl &&/);
    assert.doesNotMatch(header, /['"]\/Logo\.svg['"]/);
  });

  test('has data-testid for logo link', () => {
    assert.match(header, /data-testid="header-logo-link"/);
  });
});

// ---------- Footer: config-driven branding ----------

describe('Footer: config-driven branding', () => {
  const footer = read('src/components/organisms/Footer/Footer.tsx');

  test('uses resolveFooterConnectLinks for social links', () => {
    assert.match(footer, /resolveFooterConnectLinks/);
  });

  test('uses resolveFooterNavLinks for navigation', () => {
    assert.match(footer, /resolveFooterNavLinks/);
  });

  test('uses resolveFooterCopyright for copyright', () => {
    assert.match(footer, /resolveFooterCopyright/);
  });

  test('has data-testid for footer', () => {
    assert.match(footer, /data-testid="footer"/);
  });
});

// ---------- Hero: config-driven content ----------

describe('Hero: config-driven content', () => {
  const hero = read('src/components/sections/Hero/Hero.tsx');

  test('renders heading, paragraph, image, and buttons from props', () => {
    assert.match(hero, /heading/);
    assert.match(hero, /paragraph/);
    assert.match(hero, /image/);
    assert.match(hero, /buttons/);
  });

  test('uses next/image for hero image', () => {
    assert.match(hero, /import Image from ['"]next\/image['"]/);
    assert.match(hero, /<Image/);
  });
});

// ---------- BonBeauty fixture: branding completeness ----------

describe('BonBeauty fixture: branding fields', () => {
  const fixturePath = path.join(root, '..', '..', 'specs', 'contracts', 'config', 'fixtures', 'markets', 'bonbeauty', 'market.bonbeauty.yaml');
  const yaml = fs.readFileSync(fixturePath, 'utf8');

  test('has theme field', () => {
    assert.match(yaml, /^theme:\s*\S+/m);
  });

  test('has homepage.sections.hero with heading, image, buttons', () => {
    assert.match(yaml, /hero:/);
    assert.match(yaml, /heading:/);
    assert.match(yaml, /image:/);
    assert.match(yaml, /buttons:/);
  });

  test('has market name for footer copyright fallback', () => {
    assert.match(yaml, /^market_id:\s*\S+/m);
  });

  test('theme value matches an existing CSS file in public/themes/', () => {
    const themeMatch = yaml.match(/^theme:\s*(\S+)/m);
    assert.ok(themeMatch, 'theme field not found');
    const themeName = themeMatch[1];
    const cssPath = path.join(root, 'public', 'themes', `${themeName}.css`);
    assert.ok(fs.existsSync(cssPath), `Theme CSS file missing: ${cssPath}`);
  });
});
