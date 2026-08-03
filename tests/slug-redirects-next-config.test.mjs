import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { loadSlugRedirectsForNext } = await import('../scripts/slug-redirects.ts');

function makeTempConfigRoot(yamlContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gp-storefront-redirects-'));
  const marketDir = path.join(dir, 'markets', 'bonbeauty');
  fs.mkdirSync(marketDir, { recursive: true });
  if (yamlContent !== null) {
    fs.writeFileSync(path.join(marketDir, 'slug-redirects.yaml'), yamlContent, 'utf-8');
  }
  return dir;
}

test('loadSlugRedirectsForNext returns [] when file does not exist', () => {
  const configRoot = makeTempConfigRoot(null);
  const result = loadSlugRedirectsForNext('bonbeauty', configRoot);
  assert.deepStrictEqual(result, []);
});

test('loadSlugRedirectsForNext maps YAML entries to Next.js redirects', () => {
  const configRoot = makeTempConfigRoot(`
redirects:
  - from: "stary-slug"
    to: "nowy-slug"
    permanent: true
  - from: "drugi-slug"
    to: "drugi-nowy-slug"
    permanent: false
`);

  const result = loadSlugRedirectsForNext('bonbeauty', configRoot);

  assert.deepStrictEqual(result, [
    {
      source: '/:locale/products/stary-slug',
      destination: '/:locale/products/nowy-slug',
      permanent: true,
    },
    {
      source: '/:locale/products/drugi-slug',
      destination: '/:locale/products/drugi-nowy-slug',
      permanent: false,
    },
  ]);
});

test('loadSlugRedirectsForNext deduplicates duplicate from slugs', () => {
  const configRoot = makeTempConfigRoot(`
redirects:
  - from: "powielony-slug"
    to: "wersja-a"
    permanent: true
  - from: "powielony-slug"
    to: "wersja-b"
    permanent: true
`);

  const result = loadSlugRedirectsForNext('bonbeauty', configRoot);

  assert.deepStrictEqual(result, [
    {
      source: '/:locale/products/powielony-slug',
      destination: '/:locale/products/wersja-b',
      permanent: true,
    },
  ]);
});

test('next.config.ts wires slug redirects helper into async redirects()', () => {
  const nextConfigPath = path.join(process.cwd(), 'next.config.ts');
  const source = fs.readFileSync(nextConfigPath, 'utf8');

  assert.match(source, /loadSlugRedirectsForNext/);
  assert.match(source, /async\s+redirects\s*\(\)\s*\{/);
  assert.match(source, /\.\.\.loadSlugRedirectsForNext\s*\(/);
});