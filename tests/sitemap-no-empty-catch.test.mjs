/**
 * Bramka anty-nawrotowa — Story 2.2 v1.15.0 (T8).
 *
 * Trzy `catch { return [] }` w `lib/seo/sitemap.ts` były JEDNĄ decyzją
 * („transient outage nie może zepsuć buildu"), nie trzema instancjami. Bez tej
 * bramki czwarte źródło danych dodane za pół roku dostanie ten sam `catch`
 * i sitemapa znów zamieni awarię backendu w sygnał deindeksacji.
 *
 * Bramka odpala się w `pnpm --filter storefront test:node` (część `pnpm test`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SITEMAP_MODULES = [
  join(root, 'src/lib/seo/sitemap.ts'),
  join(root, 'src/lib/seo/sitemap-last-good.ts'),
  join(root, 'src/app/sitemap.ts')
];

/** `catch { return [] }` / `catch (e) { return []; }` / `.catch(() => [])`. */
const EMPTY_CATCH_PATTERNS = [
  /catch\s*(\([^)]*\))?\s*\{\s*return\s*\[\s*\]\s*;?\s*\}/,
  /\.catch\s*\(\s*\(\s*[^)]*\)\s*=>\s*\[\s*\]\s*\)/
];

/**
 * Komentarze wycinamy PRZED skanem — inaczej bramka czerwieni się na własnym
 * opisie w nagłówku pliku (a regex ślepy na komentarze to znana klasa defektu
 * walidatorów w tym repo).
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('lib/seo/sitemap.ts nie przywraca fallbacku „porażka ⇒ pusta kolekcja"', () => {
  for (const file of SITEMAP_MODULES) {
    const source = stripComments(readFileSync(file, 'utf8'));
    for (const pattern of EMPTY_CATCH_PATTERNS) {
      assert.equal(
        pattern.test(source),
        false,
        `${file}: wykryto fallback zwracający pustą kolekcję po porażce odczytu. ` +
          'Pusty <urlset> to dla crawlera oświadczenie „tych stron już nie ma" (AD-19). ' +
          'Zwróć stan (`failed`/`stale`) albo rzuć.'
      );
    }
  }
});

test('bramka faktycznie mierzy — wykrywa wstrzyknięty wzorzec (test-the-test)', () => {
  const injected = 'async function x(){ try { return await y(); } catch { return []; } }';
  assert.ok(
    EMPTY_CATCH_PATTERNS.some(p => p.test(injected)),
    'wzorce bramki nie wykrywają nawet jawnego `catch { return []; }` — bramka byłaby martwa'
  );
  const injectedInline = 'const items = await y().catch(() => []);';
  assert.ok(EMPTY_CATCH_PATTERNS.some(p => p.test(injectedInline)));
});

test('kontrakt trójstanowy jest obecny w module sitemapy', () => {
  const source = readFileSync(join(root, 'src/lib/seo/sitemap.ts'), 'utf8');
  for (const token of ["'fresh'", "'stale'", "'failed'", 'SitemapSourceFailureError']) {
    assert.ok(source.includes(token), `brak elementu kontraktu stanu odczytu: ${token}`);
  }
});
