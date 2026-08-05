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

/**
 * Asercje POZYTYWNE na ścieżce sitemapy — review 2.2 [MEDIUM].
 *
 * Skan `EMPTY_CATCH_PATTERNS` obejmował tylko moduły sitemapy, a defekt realnie
 * żył WARSTWĘ NIŻEJ: `src/lib/data/seller.ts` (`getSellers().catch(() => [])`)
 * i `src/lib/blog.ts` (`fetchMarketScopedPages` → `[]` przy `failClosed: false`).
 * Obie ścieżki tolerancyjne ZOSTAJĄ, bo dla UI są legalne — nielegalny jest ich
 * wybór w sitemapie. Regresja, którą stara bramka przepuszczała na zielono:
 * ktoś zamienia `getSellersOrThrow()` na `getSellers()` (o literę krócej),
 * sitemapa znów zamienia awarię w pustą rodzinę, `readSource()` zapisuje pusty
 * snapshot jako „ostatni dobry wynik", a wszystkie testy są zielone.
 * Dlatego mierzymy tu dokładnie tę decyzję, która się cofa.
 */
test('sitemapa woła RZUCAJĄCE warianty fetcherów, nie tolerancyjne', () => {
  const source = stripComments(readFileSync(join(root, 'src/lib/seo/sitemap.ts'), 'utf8'));

  assert.match(
    source,
    /getSellersOrThrow\s*\(/,
    'sitemap.ts nie woła `getSellersOrThrow()` — wariant tolerancyjny `getSellers()` ' +
      'połyka błąd i zwraca [], czyli zamienia awarię w sygnał deindeksacji (AD-19).'
  );
  assert.equal(
    /(?<!OrThrow)\bgetSellers\s*\(/.test(source),
    false,
    'sitemap.ts woła `getSellers()` — ten wariant zwraca [] po porażce i jest ' +
      'zabroniony na ścieżce sitemapy (AD-19). Użyj `getSellersOrThrow()`.'
  );
  assert.match(
    source,
    /failClosed:\s*true/,
    'sitemap.ts nie woła `fetchHomepageBlogPageDocs` z `failClosed: true` — bez tego ' +
      'awaria Payloada wraca jako pusta lista wpisów bloga.'
  );
});

test('bramka pozytywna faktycznie mierzy — wykrywa cofnięcie decyzji (test-the-test)', () => {
  const reverted = 'const sellers = await getSellers();';
  assert.ok(
    /(?<!OrThrow)\bgetSellers\s*\(/.test(reverted),
    'wzorzec nie wykrywa powrotu do `getSellers()` — bramka byłaby martwa'
  );
  const kept = 'const sellers = await getSellersOrThrow();';
  assert.equal(
    /(?<!OrThrow)\bgetSellers\s*\(/.test(kept),
    false,
    'wzorzec fałszywie oskarża `getSellersOrThrow()` — bramka blokowałaby poprawny kod'
  );
});

/**
 * Warstwa niżej: tolerancyjne warianty MUSZĄ nadal mieć rzucający odpowiednik.
 * Gdyby ktoś usunął `getSellersOrThrow`, sitemapa nie miałaby czym rozróżnić
 * porażki od pustki i „naprawa" polegałaby na powrocie do `catch { return [] }`.
 */
test('warstwa danych wystawia rzucający wariant obok tolerancyjnego', () => {
  const seller = stripComments(readFileSync(join(root, 'src/lib/data/seller.ts'), 'utf8'));
  assert.match(
    seller,
    /export\s+(const|async\s+function)\s+getSellersOrThrow/,
    'brak `getSellersOrThrow` w src/lib/data/seller.ts — sitemapa nie ma rzucającego wariantu'
  );

  const blog = stripComments(readFileSync(join(root, 'src/lib/blog.ts'), 'utf8'));
  assert.match(
    blog,
    /failClosed/,
    'brak przełącznika `failClosed` w src/lib/blog.ts — porażka Payloada znów udawałaby pustkę'
  );
});

test('kontrakt trójstanowy jest obecny w module sitemapy', () => {
  const source = readFileSync(join(root, 'src/lib/seo/sitemap.ts'), 'utf8');
  for (const token of ["'fresh'", "'stale'", "'failed'", 'SitemapSourceFailureError']) {
    assert.ok(source.includes(token), `brak elementu kontraktu stanu odczytu: ${token}`);
  }
});
