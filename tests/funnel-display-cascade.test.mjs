import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe } from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractCssCustomProperty(css, property) {
  const match = css.match(new RegExp(`${escapeRegExp(property)}\\s*:\\s*([^;]+);`));
  assert.ok(match, `Missing ${property}`);
  return match[1].trim();
}

function resolveCssVars(value, vars) {
  return value.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_, name, fallback = '') => {
    return vars[name] ?? fallback.trim();
  });
}

describe('Funnel Display cascade contract', () => {
  const layout = read('src/app/layout.tsx');
  const globals = read('src/app/globals.css');
  const typography = read('src/styles/tokens/typography.css');

  test('loads Funnel Display once through next/font/local and exposes --font-funnel-sans', () => {
    assert.match(layout, /import localFont from 'next\/font\/local'/);
    assert.match(layout, /const funnelDisplay = localFont\(\{/);
    assert.match(layout, /src:\s*'\.\/fonts\/FunnelDisplay-VariableFont_wght\.ttf'/);
    assert.match(layout, /variable:\s*'--font-funnel-sans'/);
    assert.match(layout, /display:\s*'swap'/);
    assert.match(layout, /<html[^>]*\sclassName=\{funnelDisplay\.variable\}/);
  });

  test('body resolves through --font-funnel-sans to Funnel Display', () => {
    const fontFamilySans = extractCssCustomProperty(typography, '--font-family-sans');
    const bodyFontFamily = globals.match(/body\s*\{[^}]*font-family:\s*([^;]+);/s);

    assert.ok(bodyFontFamily, 'Missing body font-family declaration');
    assert.equal(bodyFontFamily[1].trim(), 'var(--font-family-sans)');

    const resolvedToken = resolveCssVars(fontFamilySans, {
      '--font-funnel-sans': "'Funnel Display'"
    });
    const resolvedBody = resolveCssVars(bodyFontFamily[1].trim(), {
      '--font-family-sans': resolvedToken
    });

    assert.match(fontFamilySans, /var\(--font-funnel-sans,\s*system-ui\)/);
    assert.match(resolvedBody, /^'Funnel Display',\s*'Funnel Display'/);
  });

  test('typography token file no longer carries stale source-path references', () => {
    assert.doesNotMatch(typography, /_bmad-output\/specs\/proposed/);
    assert.doesNotMatch(typography, /colors_and_type\.css/);
    assert.doesNotMatch(typography, /project\/public\/themes\/bonbeauty\.css/);
    assert.doesNotMatch(typography, /Font @font-face/);
  });
});
