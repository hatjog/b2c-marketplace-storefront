/**
 * Nośnik "ostatniego dobrego wyniku" dla sitemapy — Story 2.2 v1.15.0 (AD-19, AC2).
 *
 * Dlaczego plik na dysku, a nie zmienna modułowa / cache Next:
 *   - zmienna modułowa ginie przy restarcie kontenera i przy każdym nowym
 *     buildzie; `revalidate = 3600` sprawia, że PIERWSZA regeneracja po
 *     restarcie trafia w zimny stan — czyli dokładnie wtedy, gdy backend
 *     najczęściej jeszcze wstaje,
 *   - cache Next (`unstable_cache`) jest unieważniany przy deployu i nie daje
 *     nam wieku danych, którego wymaga AD-19.
 * Plik JSON w katalogu wskazanym przez `GP_SITEMAP_LAST_GOOD_DIR` (domyślnie
 * `<cwd>/.sitemap-last-good`) przeżywa restart procesu. Katalog jest stanem
 * runtime, NIE artefaktem repo — jest w `.gitignore` świadomie (werdykt w
 * Dev Notes story 2.2).
 *
 * ZIMNY START (brak jakiegokolwiek wcześniejszego wyniku) jest rozstrzygnięty
 * jawnie: `readLastGood()` zwraca `null`, a `buildSitemap()` RZUCA. Fail-closed
 * dla artefaktu indeksacyjnego znaczy "nie publikuj nowej wersji", nigdy
 * "opublikuj wersję pustą".
 *
 * `node:fs` jest importowany dynamicznie wewnątrz funkcji, żeby moduł nie
 * wciągnął fs do bundla klienckiego (znana klasa defektu w tym repo).
 */

export type SitemapSourceId = 'categories' | 'sellers' | 'blog_posts';

export interface LastGoodSnapshot<T = unknown> {
  /** ISO-8601 czasu UDANEGO odczytu (nie czasu zapisu pliku). */
  fetchedAt: string;
  items: T[];
}

const DEFAULT_DIR_NAME = '.sitemap-last-good';

/**
 * Górna granica „zbędnego" odświeżenia znacznika czasu przy niezmienionej
 * treści. 300 s przy progu alertu 24 h (`SITEMAP_STALE_ALERT_THRESHOLD_SECONDS`)
 * to 0,35 % progu — nie przesuwa żadnej decyzji operatora.
 */
export const WRITE_THROTTLE_SECONDS = 300;

/** Katalog nośnika. Jawny env ma pierwszeństwo (testy, wolumen w deployu). */
export function resolveLastGoodDir(): string {
  const configured = (process.env.GP_SITEMAP_LAST_GOOD_DIR ?? '').trim();
  return configured || `${process.cwd()}/${DEFAULT_DIR_NAME}`;
}

/**
 * Deployment jest per-rynek, ale nazwa pliku i tak niesie rynek — inaczej
 * współdzielony wolumen wymieszałby zbiory URL-i dwóch rynków.
 */
export function resolveMarketKey(): string {
  const raw =
    process.env.NEXT_PUBLIC_MARKET_ID ??
    process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID ??
    'default';
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'default';
}

function snapshotPath(source: SitemapSourceId): string {
  return `${resolveLastGoodDir()}/${resolveMarketKey()}.${source}.json`;
}

/**
 * Zapis ostatniego dobrego wyniku. Wołany WYŁĄCZNIE dla świeżego sukcesu —
 * wynik zdegradowany nie może nadpisać dobrego, bo po godzinie "stale" stałby
 * się "ostatnim dobrym" i wiek danych przestałby cokolwiek znaczyć.
 *
 * Błąd zapisu nie wywraca generacji (sitemapa jest wtedy nadal świeża), ale
 * jest logowany — cicha porażka nośnika jest tym samym defektem, co cichy
 * `catch { return [] }`.
 */
export async function writeLastGood<T>(
  source: SitemapSourceId,
  items: T[],
  fetchedAt: Date = new Date()
): Promise<boolean> {
  const fs = await import('node:fs/promises');
  const path = snapshotPath(source);
  const payload: LastGoodSnapshot<T> = {
    fetchedAt: fetchedAt.toISOString(),
    items
  };

  // Throttling (review 2.2 [LOW]): `/sitemap.xml` renderuje się dynamicznie,
  // więc bez tego KAŻDE żądanie crawlera robiłoby 3 pełne serializacje +
  // `writeFile` + `rename` na współdzielonym wolumenie. Zapis pomijamy tylko
  // wtedy, gdy treść snapshotu jest IDENTYCZNA, a istniejący wpis jest młodszy
  // niż `WRITE_THROTTLE_SECONDS` — czyli gdy zapis nie wniósłby żadnej
  // informacji. Zmiana treści zapisuje się ZAWSZE i natychmiast; wiek danych
  // nigdy nie zostaje zaniżony, bo pomijamy jedynie odświeżenie `fetchedAt`
  // o mniej niż próg (nośnik może więc raportować wiek starszy o ≤ próg, nigdy
  // młodszy — błąd w stronę bezpieczną dla AD-19).
  const existing = await readLastGood<T>(source);
  if (
    existing &&
    snapshotAgeSeconds(existing, fetchedAt) < WRITE_THROTTLE_SECONDS &&
    JSON.stringify(existing.items) === JSON.stringify(items)
  ) {
    return true;
  }

  try {
    await fs.mkdir(resolveLastGoodDir(), { recursive: true });
    await fs.writeFile(`${path}.tmp`, JSON.stringify(payload), 'utf8');
    await fs.rename(`${path}.tmp`, path);
    return true;
  } catch (error) {
    console.warn(
      `[sitemap][last-good] zapis nośnika dla źródła "${source}" nie powiódł się: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return false;
  }
}

/**
 * Odczyt ostatniego dobrego wyniku. `null` = zimny start albo uszkodzony
 * nośnik — obie sytuacje są dla `buildSitemap()` stanem `failed`.
 */
export async function readLastGood<T>(
  source: SitemapSourceId
): Promise<LastGoodSnapshot<T> | null> {
  const fs = await import('node:fs/promises');
  try {
    const raw = await fs.readFile(snapshotPath(source), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as LastGoodSnapshot).fetchedAt !== 'string' ||
      !Array.isArray((parsed as LastGoodSnapshot).items)
    ) {
      console.warn(
        `[sitemap][last-good] nośnik źródła "${source}" ma nieoczekiwany kształt — traktuję jak brak`
      );
      return null;
    }
    return parsed as LastGoodSnapshot<T>;
  } catch {
    return null;
  }
}

/** Wiek snapshotu w sekundach względem `now`. */
export function snapshotAgeSeconds(
  snapshot: LastGoodSnapshot<unknown>,
  now: Date = new Date()
): number {
  const fetched = Date.parse(snapshot.fetchedAt);
  if (Number.isNaN(fetched)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((now.getTime() - fetched) / 1000));
}
