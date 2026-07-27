#!/usr/bin/env node
/**
 * smoke-pdp-locales.mjs — v1.14.0 Story 1.3 (AC5, ship-bar HG-6).
 *
 * Smoke skryptowy PDP × locale: iteruje WSZYSTKIE handle katalogu i sprawdza
 * `/pl /ua /de /en × handle` na prod-buildzie storefrontu (`next build` +
 * `next start`; dev-server 200 ≠ prod — lekcja Sprint-1).
 *
 * Werdykty per handle × locale:
 *  - `200_ok_pl_content`  — /pl: 200 i renderowany <title> zawiera tytuł
 *                           produktu z backendu /pl (żywy dowód, że tor renderu
 *                           przenosi treść — ścieżka dowodowa AC1 na /pl,
 *                           review 1-3-F2),
 *  - `pl_content_mismatch`— FAIL: /pl 200, ale render nie zawiera tytułu
 *                           z backendu — tor renderu nie przenosi treści,
 *  - `200_ok_localized`   — 200, treść w żądanym locale (≠ wariant /pl przy
 *                           istniejącym tłumaczeniu),
 *  - `200_ok_no_translation` — 200, NIEZALEŻNE źródło (--translated-handles)
 *                           mówi, że tłumaczenia nie ma ⇒ identyczność z /pl
 *                           jest oczekiwana,
 *  - `200_ok_no_translation_unverified` — 200, tłumaczenia nie widać, ale
 *                           jedynym źródłem tej wiedzy jest ta sama odpowiedź
 *                           `/store/products`, którą smoke weryfikuje ⇒
 *                           NEEDS-REVIEW (soft), NIE cichy PASS (fail-open
 *                           klasy 1-3-F5: awaria overlay'a backendu dawałaby
 *                           inaczej zieleń),
 *  - `pl_fallback_title`  — FAIL: tłumaczenie istnieje, body (h1 produktu)
 *                           jest zlokalizowane, ale HEAD (<title> + meta
 *                           description) identyczny z /pl — klasa przecieku
 *                           PL-only `metadata.gp.seo.*` (cykl 2,
 *                           1-3-c2-pl-fallback-live),
 *  - `pl_fallback_body`   — FAIL: tłumaczenie istnieje, a treść body jest
 *                           identyczna z /pl LUB sygnału h1 nie da się
 *                           odczytać (fail-closed) — pełna klasa błędu
 *                           v1.13.0,
 *  - `404_gate_description` — produkt jest w backendzie, opis w tym locale
 *                           ma `content_bar[<gate_slug>].bar === false` ⇒
 *                           odfiltrowany przez kryterium `description`
 *                           checkQualityGate (Story 1.4 / AD-4 — materiał dla
 *                           Epic 4, raportuj, NIE kompensuj),
 *  - `404_gate_description_legacy` — produkt jest w backendzie, ale NIE ma
 *                           używalnego `content_bar` (okno EE-1 deploy→re-sync)
 *                           i wordcount < MIN_DESCRIPTION_WORDS ⇒ gate poszedł
 *                           ścieżką legacy. JAWNIE inny werdykt niż wyżej:
 *                           „brak backfillu" nie może udawać „brak treści",
 *  - `404_gate_image`     — produkt jest w backendzie, opis przechodzi próg,
 *                           brak `thumbnail` ⇒ kryterium `image` gate'a,
 *  - `404_gate_other`     — produkt jest w backendzie, opis i thumbnail OK ⇒
 *                           odfiltrowany przez pozostałe kryterium (`price` —
 *                           smoke nie ma kontekstu regionu, żeby je policzyć);
 *                           JAWNIE nie-„not_found" (review 1-3-F4),
 *  - `404_not_found`      — 404 i produktu NIE ma w katalogu backendu,
 *  - `http_<status>`      — inny status,
 *  - `fetch_error`        — błąd sieci po stronie storefrontu.
 *
 * FAIL-CLOSED (wzorzec _grow/tools/validate_live_render_smoke.py): brak
 * backendu / brak storefrontu / 0 handli w katalogu / brak `count` w
 * odpowiedzi katalogu ⇒ NEEDS-LIVE-RUN, exit 2 — nigdy „green". Liczba
 * sprawdzonych produktów jest w evidence JAWNIE, żeby „113/113" nie mogło
 * być prawdą przy 3 sprawdzonych.
 *
 * Exit: 0 = zero FAILi (soft NEEDS-REVIEW nie blokuje, ale jest jawny w
 * evidence i na stderr); 1 = są FAILe (pl_fallback_* / pl_content_mismatch /
 * 404 / błędy); 2 = NEEDS-LIVE-RUN (stack niedostępny / katalog pusty);
 * 3 = TOOL-ERROR (bug skryptu / błąd zapisu — NIE problem środowiska,
 * review 1-3-F10).
 *
 * Sygnał gate'u jest lustrem checkQualityGate
 * (src/lib/helpers/normalize-listed-products.ts + src/lib/content-gate.ts):
 * od Story 1.4 (AD-4) decyduje `metadata.gp.content_bar[<slug>].bar` liczony
 * w SYNC-TIME. Slug per locale wynika z REALNEJ fazy marketu (review 1-4-F5):
 * smoke czyta `content_gate.phase_2_locales` z runtime `market.yaml` (lustro
 * `narrowPhase2Locales`) — FAZA 1 ⇒ `pl`, FAZA 2 dla locale ⇒ ten locale.
 * MIN_DESCRIPTION_WORDS pozostaje wyłącznie dla ścieżki legacy EE-1.
 * Zgodność obu stałych pilnuje test parity
 * `src/lib/helpers/__tests__/smoke-threshold-parity.test.ts` (review 1-3-F6,
 * przepięty w 1.4) — rozjazd failuje test, zamiast po cichu kłamać o
 * przyczynach 404 w release'ie, w którym smoke ma dowodzić HG-6.
 *
 * Umiejscowienie: GP/storefront/scripts/ (obok check-i18n-key-parity.ts), bo
 * smoke wymaga wiedzy o kontrakcie storefrontu (routing locale, meta tagi)
 * i działa na jego stacku; `_grow/tools` pozostaje dla dev-process gates
 * (ewentualny evidence-consumer czyta JSON wyprodukowany tutaj).
 *
 * Użycie:
 *   node scripts/smoke-pdp-locales.mjs \
 *     [--base-url http://localhost:3002] \
 *     [--backend-url http://localhost:9000] \
 *     [--out smoke-evidence/pdp-locales.json] \
 *     [--translated-handles path.json]  # NIEZALEŻNE źródło prawdy o
 *                                       # istnieniu tłumaczeń: JSON
 *                                       # { "ua": [handle...], "de": [...] }
 *                                       # (np. z evidence story 4.4); bez
 *                                       # niego brak-tłumaczenia jest
 *                                       # NEEDS-REVIEW, nie PASS
 *     [--limit-handles N]               # TYLKO do debugowania; wynik z
 *                                       # limitem jest zawsze partial=true
 *     [--market bonbeauty]              # market dla odczytu content_gate;
 *                                       # default NEXT_PUBLIC_PAYLOAD_MARKET_ID
 *     [--config-root path]              # root runtime configu; default
 *                                       # GP_CONFIG_ROOT albo ../config, ../../config
 *     [--expect-phase-2 "ua,de"|none]   # twardy fail (TOOL-ERROR), gdy config
 *                                       # marketu ma inną listę phase_2_locales
 *                                       # niż deklaruje runbook (review 1-4-F5)
 */
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

const LOCALES = ['pl', 'ua', 'de', 'en'];
const BCP47_BY_SLUG = { pl: 'pl-PL', ua: 'uk-UA', de: 'de-DE', en: 'en-US' };
// Lustro checkQualityGate — parity z normalize-listed-products.ts / content-gate.ts
// egzekwuje smoke-threshold-parity.test.ts (review 1-3-F6, przepięte w 1.4).
//
// Story 1.4 (AD-4): kryterium `description` gate'u czyta
// `metadata.gp.content_bar[<slug>].bar`, a NIE wordcount pobranego opisu.
// W FAZIE 1 slug = 'pl' niezależnie od locale requestu; w FAZIE 2 dla locale
// z `content_gate.phase_2_locales` slug = ten locale. Review 1-4-F5: faza NIE
// jest zaszyta na sztywno — smoke czyta `content_gate` z runtime configu
// marketu (lustro `narrowPhase2Locales` z content-gate.ts), inaczej po flipie
// klasyfikowałby 404 po złym slugu i wpisywał do evidence fazę, której nie ma.
const CONTENT_BAR_GATE_SLUG_PHASE_1 = 'pl';
// Zachowany zastany próg — używany WYŁĄCZNIE na ścieżce legacy EE-1 (encja bez
// `content_bar`, okno deploy→re-sync). Nie jest już torem głównym.
const MIN_DESCRIPTION_WORDS = 80;

/**
 * Lustro `readContentBarFlag` ze storefrontu: `undefined` dla każdego kształtu,
 * który nie jest booleanem `bar` pod wybranym slugiem (brak mapy, null,
 * nie-obiekt, brak wpisu, `bar` nie-boolean) ⇒ ścieżka legacy.
 */
function readContentBarFlag(contentBar, slug) {
  if (!contentBar || typeof contentBar !== 'object' || Array.isArray(contentBar)) return undefined;
  const measurement = contentBar[slug];
  if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)) return undefined;
  return typeof measurement.bar === 'boolean' ? measurement.bar : undefined;
}
const FETCH_CONCURRENCY = 8;
const PAGE_SIZE = 100;

class ToolError extends Error {}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    if (key.startsWith('--')) {
      args[key.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

/** Minimalny parser .env.local — Next auto-loaduje go w runtime, my nie. */
function readEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const result = {};
  if (!fs.existsSync(envPath)) return result;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match) result[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return result;
}

function needsLiveRun(reason) {
  console.error(`NEEDS-LIVE-RUN: ${reason}`);
  console.error(
    'Smoke jest fail-closed: brak stacku / pusty katalog NIE jest zielony. ' +
      'Uruchom backend (docker compose) i prod-build storefrontu (pnpm build && pnpm start -p 3002).'
  );
  process.exit(2);
}

/**
 * Lustro `narrowPhase2Locales` z `content-gate.ts` (review 1-4-F5; granica
 * ESM/.mjs jak przy `readContentBarFlag`). Zwraca Set slugów w FAZIE 2 dla
 * marketu, czytany z runtime `market.yaml` (ta sama ścieżka rozwiązywania co
 * `runtime-market-config.ts`). Każde odchylenie od schematu ⇒ warn + FAZA 1
 * (pusty zbiór) — identycznie ze storefrontem, dowód i produkcja nie mogą
 * degradować w różne strony.
 */
function readPhase2Locales(env, args) {
  const warnPhase1 = (problem) => {
    console.warn(`UWAGA: content_gate ${problem} — smoke przyjmuje FAZĘ 1 dla wszystkich locale.`);
    return new Set();
  };

  const marketId = (args.market ?? env.NEXT_PUBLIC_PAYLOAD_MARKET_ID ?? '').trim();
  if (!marketId) {
    return warnPhase1('nieodczytany: brak --market i NEXT_PUBLIC_PAYLOAD_MARKET_ID');
  }

  const instanceId = (env.GP_INSTANCE_ID ?? 'gp-dev').trim();
  const configRoots = args['config-root']
    ? [path.resolve(args['config-root'])]
    : env.GP_CONFIG_ROOT
      ? [path.resolve(env.GP_CONFIG_ROOT)]
      : [path.resolve(process.cwd(), '../config'), path.resolve(process.cwd(), '../../config')];
  const marketYamlPath = configRoots
    .map((root) => path.join(root, instanceId, 'markets', marketId, 'market.yaml'))
    .find((candidate) => fs.existsSync(candidate));
  if (!marketYamlPath) {
    return warnPhase1(`nieodczytany: brak market.yaml dla '${marketId}' w [${configRoots.join(', ')}]`);
  }

  let config;
  try {
    config = yaml.load(fs.readFileSync(marketYamlPath, 'utf8'));
  } catch (error) {
    return warnPhase1(`nieparsowalny (${marketYamlPath}): ${error.message}`);
  }

  const block = config?.content_gate;
  if (block === null || block === undefined) {
    return new Set(); // legalny stan domyślny — FAZA 1 bez warna
  }
  if (typeof block !== 'object' || Array.isArray(block)) {
    return warnPhase1('nie jest obiektem');
  }
  const unknownKeys = Object.keys(block).filter((key) => key !== 'phase_2_locales');
  if (unknownKeys.length > 0) {
    return warnPhase1(`zawiera nieznane klucze [${unknownKeys.join(', ')}]`);
  }
  const rawPhase2 = block.phase_2_locales;
  if (rawPhase2 === null || rawPhase2 === undefined) {
    return new Set();
  }
  if (!Array.isArray(rawPhase2)) {
    return warnPhase1('phase_2_locales nie jest tablicą');
  }
  const phase2 = new Set();
  for (const entry of rawPhase2) {
    if (typeof entry !== 'string' || !LOCALES.includes(entry)) {
      return warnPhase1(`phase_2_locales zawiera "${String(entry)}" spoza [${LOCALES.join(', ')}]`);
    }
    phase2.add(entry);
  }
  return phase2;
}

/**
 * Cykl 3: klasyfikator body/head dla renderu 200 na locale ≠ pl, gdy
 * tłumaczenie istnieje (translationExists). Wydzielony do czystej funkcji
 * (bez sieci/fs), żeby dało się go pokryć testem jednostkowym — regresja
 * translation-invariant (nazwa własna identyczna PL/target) inaczej wymaga
 * live stacku, żeby ją zobaczyć.
 *
 * PRZED testem fallbacku na /pl sprawdzamy ground truth DOCELOWEGO locale
 * wprost — `backend_title` tego locale. Gdy h1 renderu zgadza się z tym
 * tytułem, treść JEST zlokalizowana, nawet jeśli przypadkiem identyczna z PL
 * (np. „Hammam" bez tłumaczenia w PL/DE/EN) — porównanie h1↔h1(/pl) dawało
 * wtedy fałszywy pl_fallback_body. `translationInvariant=true` znaczy „tytuł
 * PL i docelowego locale są tożsame w źródle", NIE „brak sygnału" — nadal
 * 200_ok_localized.
 *
 * Realny fallback NIE jest osłabiony: gdy h1 == PL i h1 != target,
 * `bodyMatchesTargetGroundTruth` jest false, więc klasyfikacja leci normalnie
 * w dół do pl_fallback_body.
 */
export function classifyLocalizedRender({ render, plRender, backendEntry, backendPl }) {
  const targetGroundTruthTitle = backendEntry?.title ?? null;
  const bodyMatchesTargetGroundTruth =
    targetGroundTruthTitle != null && render.h1 === targetGroundTruthTitle;
  const translationInvariant =
    bodyMatchesTargetGroundTruth && backendPl?.title === targetGroundTruthTitle;
  // Cykl 2 (1-3-c2-pl-fallback-live): osobne werdykty na kanał HEAD
  // (<title> + meta description) i BODY (h1 produktu). OBA są FAIL —
  // rozdzielenie służy diagnozie (przeciek seo.* vs fallback treści), NIE
  // osłabia kryterium HG-6. Brak sygnału h1 po którejkolwiek stronie =
  // fail-closed (body nieudowodnione ⇒ pl_fallback_body).
  const headIdenticalToPl =
    plRender?.status === 200 &&
    render.title === plRender.title &&
    render.description === plRender.description;
  const bodyLocalized =
    plRender?.status === 200 &&
    render.h1 != null &&
    plRender.h1 != null &&
    render.h1 !== plRender.h1;

  let verdict;
  if (bodyMatchesTargetGroundTruth) {
    verdict = '200_ok_localized';
  } else if (!headIdenticalToPl && bodyLocalized) {
    verdict = '200_ok_localized';
  } else if (bodyLocalized) {
    verdict = 'pl_fallback_title';
  } else {
    verdict = 'pl_fallback_body';
  }
  return { verdict, translationInvariant };
}

function wordCount(text) {
  return String(text ?? '')
    .split(/\s+/)
    .filter(Boolean).length;
}

function extractRendered(html) {
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null;
  const description =
    /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1] ??
    /<meta\s+content="([^"]*)"\s+name="description"/i.exec(html)?.[1] ??
    null;
  // Cykl 2 (1-3-c2-pl-fallback-live): sygnał BODY niezależny od <head> —
  // tytuł produktu w treści strony (h1 data-testid="product-title"). Bez
  // niego werdykt nie odróżnia „head PL, body zlokalizowane" (przeciek
  // seo.meta_title) od pełnego fallbacku treści.
  const h1 =
    /<h1[^>]*data-testid="product-title"[^>]*>([^<]*)</i.exec(html)?.[1]?.trim() ?? null;
  return { title, description, h1 };
}

/**
 * NIEZALEŻNE źródło prawdy o istnieniu tłumaczeń (review 1-3-F5):
 * plik JSON `{ "<locale>": ["handle", …] }` — np. wygenerowany z evidence
 * story 4.4 albo bezpośrednio z tabel Translation Module. Zwraca mapę
 * locale → Set(handle) albo null (źródło nieprzekazane).
 */
function readTranslatedHandles(filePath) {
  if (!filePath) return null;
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new ToolError(`--translated-handles: plik nie istnieje: ${resolved}`);
  }
  const parsed = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const byLocale = {};
  for (const [locale, handles] of Object.entries(parsed)) {
    if (!Array.isArray(handles)) {
      throw new ToolError(`--translated-handles: klucz "${locale}" nie jest tablicą handle'i`);
    }
    byLocale[locale] = new Set(handles);
  }
  return byLocale;
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} → HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Katalog per locale: handle → { title, seo_meta_title, description, thumbnail }.
 *
 * UWAGA (market-scope): pobranie `metadata` aktywuje backendowy in-place filtr
 * market-scope (backend PR#131) — produkty spoza marketu wypadają z `products`,
 * ale `count` pozostaje nieprzeskopowany. Dlatego pętla paginacji NIE może
 * kończyć na `products.length < PAGE_SIZE` (strona po filtrze bywa krótsza,
 * mimo że są kolejne) — jedynym wiarygodnym warunkiem końca jest
 * `offset >= count`. Rozmiar zwróconej mapy = katalog IN-MARKET; surowy
 * `count` raportujemy w evidence osobno.
 */
async function fetchCatalog(backendUrl, publishableKey, localeSlug) {
  const products = new Map();
  let rawCount = null;
  let offset = 0;
  for (;;) {
    const url =
      `${backendUrl}/store/products?limit=${PAGE_SIZE}&offset=${offset}` +
      `&fields=handle,title,description,thumbnail,%2Bmetadata`;
    const payload = await fetchJson(url, {
      'x-publishable-api-key': publishableKey,
      'x-medusa-locale': BCP47_BY_SLUG[localeSlug]
    });
    // Review 1-3-F9: bez `count` nie umiemy odróżnić „ostatnia strona" od
    // „kontrakt się zmienił" — cicha truncacja wyglądałaby jak komplet
    // (partial=false), czyli dokładnie klasa „113/113 przy 3 sprawdzonych".
    if (typeof payload.count !== 'number') {
      throw new Error(
        `backend nie zwrócił liczbowego \`count\` w /store/products (offset=${offset}) — ` +
          'kontrakt paginacji nieznany, katalog mógłby być cicho ucięty'
      );
    }
    // Pierwsza strona niesie nieprzeskopowany count całego katalogu; kolejne
    // strony potrafią raportować już wartość po filtrze — bierzemy pierwszą.
    if (rawCount === null) rawCount = payload.count;
    for (const product of payload.products ?? []) {
      products.set(product.handle, {
        title: product.title ?? null,
        // PDP renderuje <title> z metadata.gp.seo.meta_title ?? title
        // (generateProductMetadata) — dowód treści na /pl musi honorować oba.
        seo_meta_title: product.metadata?.gp?.seo?.meta_title ?? null,
        description: product.description ?? null,
        thumbnail: product.thumbnail ?? null,
        // Story 1.4 (AD-4): sygnał gate'u liczony w sync-time. Bez niego smoke
        // nie umie odróżnić „gate odrzucił po barze" od „encja czeka na backfill".
        content_bar: product.metadata?.gp?.content_bar ?? null
      });
    }
    offset += PAGE_SIZE;
    if (offset >= payload.count) break;
  }
  return { products, rawCount };
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const envLocal = readEnvLocal();
  const env = { ...envLocal, ...process.env }; // process.env ma priorytet

  const baseUrl = args['base-url'] ?? 'http://localhost:3002';
  const backendUrl =
    args['backend-url'] ??
    env.MEDUSA_BACKEND_URL ??
    env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    'http://localhost:9000';
  const publishableKey =
    args['publishable-key'] ??
    env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
    env.NEXT_PUBLIC_PUBLISHABLE_API_KEY ??
    env.NEXT_PUBLIC_PUBLISHABLE_KEY;
  const outPath = args.out ?? 'smoke-evidence/pdp-locales.json';
  const limitHandles = args['limit-handles'] ? Number(args['limit-handles']) : null;
  const translatedHandles = readTranslatedHandles(args['translated-handles']);

  // Review 1-4-F5: realna faza gate'u z runtime configu marketu, nie literał.
  const phase2Locales = readPhase2Locales(env, args);
  const gateSlugFor = (locale) =>
    phase2Locales.has(locale) ? locale : CONTENT_BAR_GATE_SLUG_PHASE_1;
  const gatePhaseLabel =
    phase2Locales.size === 0
      ? 'FAZA 1 (content_bar.pl dla każdego locale)'
      : `FAZA 2 dla [${[...phase2Locales].join(', ')}] (content_bar[locale]); FAZA 1 dla pozostałych`;
  // Twardy fail dla runbooków: podana oczekiwana faza MUSI zgadzać się z configiem.
  if (args['expect-phase-2'] !== undefined) {
    const expected = args['expect-phase-2'] === 'none'
      ? []
      : args['expect-phase-2'].split(',').map((s) => s.trim()).filter(Boolean);
    const actual = [...phase2Locales].sort();
    if (JSON.stringify(expected.sort()) !== JSON.stringify(actual)) {
      throw new ToolError(
        `--expect-phase-2 [${expected.join(', ')}] ≠ config phase_2_locales [${actual.join(', ')}] — ` +
          'dowód HG-6 dla fazy, której market nie ma, jest bezwartościowy (review 1-4-F5).'
      );
    }
  }
  console.log(`Faza gate'u: ${gatePhaseLabel}`);

  if (!publishableKey) {
    needsLiveRun('brak NEXT_PUBLIC_PUBLISHABLE_API_KEY (env / .env.local)');
  }

  // --- Katalog z backendu (per locale overlay) — fail-closed na braku stacku.
  const catalogByLocale = {};
  let backendRawCount = null;
  try {
    for (const locale of LOCALES) {
      const { products, rawCount } = await fetchCatalog(backendUrl, publishableKey, locale);
      catalogByLocale[locale] = products;
      if (locale === 'pl') backendRawCount = rawCount;
    }
  } catch (error) {
    needsLiveRun(`backend niedostępny/kontrakt zmieniony (${backendUrl}): ${error.message}`);
  }

  let handles = [...catalogByLocale.pl.keys()].sort();
  const totalHandles = handles.length;
  if (totalHandles === 0) {
    needsLiveRun(`katalog pusty (0 handli z ${backendUrl}) — nie ma czego smoke'ować`);
  }
  if (limitHandles != null) {
    handles = handles.slice(0, limitHandles);
    console.warn(
      `UWAGA: --limit-handles ${limitHandles} — wynik CZĘŚCIOWY (${handles.length}/${totalHandles}), nie dowodzi HG-6.`
    );
  }

  // --- Storefront żyje? (fail-closed zanim zaczniemy liczyć werdykty)
  try {
    const probe = await fetch(`${baseUrl}/pl`, { redirect: 'follow' });
    if (probe.status >= 500) throw new Error(`HTTP ${probe.status}`);
  } catch (error) {
    needsLiveRun(`storefront niedostępny (${baseUrl}): ${error.message}`);
  }

  // --- Render /pl jako baza porównania + werdykty per handle × locale.
  const jobs = [];
  for (const handle of handles) {
    for (const locale of LOCALES) {
      jobs.push({ handle, locale });
    }
  }

  const rendered = new Map(); // `${handle}|${locale}` → { status, title, description }
  await mapWithConcurrency(jobs, FETCH_CONCURRENCY, async ({ handle, locale }) => {
    try {
      const response = await fetch(`${baseUrl}/${locale}/products/${handle}`, {
        redirect: 'manual'
      });
      const html = response.status === 200 ? await response.text() : '';
      rendered.set(`${handle}|${locale}`, {
        status: response.status,
        ...(response.status === 200
          ? extractRendered(html)
          : { title: null, description: null, h1: null })
      });
    } catch (error) {
      rendered.set(`${handle}|${locale}`, {
        status: null,
        title: null,
        description: null,
        h1: null,
        error: String(error.message ?? error)
      });
    }
  });

  const results = [];
  for (const handle of handles) {
    const plRender = rendered.get(`${handle}|pl`);
    for (const locale of LOCALES) {
      const render = rendered.get(`${handle}|${locale}`);
      const backendEntry = catalogByLocale[locale].get(handle) ?? null;
      const backendPl = catalogByLocale.pl.get(handle) ?? null;
      // Kanał zależny (ta sama odpowiedź /store/products) — używany TYLKO gdy
      // nie ma niezależnego źródła, i wtedy wynik jest NEEDS-REVIEW (1-3-F5).
      const backendDiffSuggestsTranslation =
        locale !== 'pl' &&
        backendEntry != null &&
        backendPl != null &&
        (backendEntry.title !== backendPl.title ||
          backendEntry.description !== backendPl.description);
      const independentSource = translatedHandles?.[locale] ?? null;
      const translationExists = independentSource
        ? independentSource.has(handle)
        : backendDiffSuggestsTranslation;
      const descriptionWords = wordCount(backendEntry?.description);
      // Mapa barów jest wspólna dla encji (overlay locale zmienia opis, nie
      // mapę) — sygnał bierzemy z wpisu katalogu /pl, ale SLUG zależy od fazy
      // danego locale (review 1-4-F5): FAZA 1 ⇒ 'pl', FAZA 2 ⇒ locale.
      const gateSlug = gateSlugFor(locale);
      const contentBar = (backendPl ?? backendEntry)?.content_bar ?? null;
      const contentBarFlag = readContentBarFlag(contentBar, gateSlug);
      const gateSignal = contentBarFlag === undefined ? 'legacy_wordcount' : 'content_bar';

      let verdict;
      let translationInvariant = null;
      if (render.status === 200) {
        if (locale === 'pl') {
          // Ścieżka dowodowa AC1 na /pl (review 1-3-F2): żywe 200 to za mało —
          // render musi zawierać treść produktu z backendu, inaczej „tor
          // renderu działa" jest deklaracją, nie dowodem.
          const expectedPlTitle = backendPl?.seo_meta_title ?? backendPl?.title ?? null;
          const plContentCarried =
            expectedPlTitle != null && render.title != null && render.title.includes(expectedPlTitle);
          verdict = plContentCarried ? '200_ok_pl_content' : 'pl_content_mismatch';
        } else if (!translationExists) {
          verdict = independentSource
            ? '200_ok_no_translation'
            : '200_ok_no_translation_unverified';
        } else {
          const classified = classifyLocalizedRender({ render, plRender, backendEntry, backendPl });
          verdict = classified.verdict;
          translationInvariant = classified.translationInvariant;
        }
      } else if (render.status === 404) {
        // Review 1-3-F4: „gate odfiltrował" ≠ „produktu nie ma". Kryteria
        // checkQualityGate: description / image / price — smoke rozróżnia
        // pierwsze dwa z danych, które ma; price wymaga kontekstu regionu,
        // więc pozostaje jawne `404_gate_other`, nigdy fałszywe not_found.
        if (backendEntry == null) {
          verdict = '404_not_found';
        } else if (contentBarFlag === false) {
          // Gate odrzucił po sygnale sync-time (AD-4) — to jest materiał dla
          // Epic 4 (treść), nie regresja kodu.
          verdict = '404_gate_description';
        } else if (contentBarFlag === undefined && descriptionWords < MIN_DESCRIPTION_WORDS) {
          // EE-1: encja bez `content_bar` — gate poszedł ścieżką legacy.
          // JAWNIE inny werdykt, żeby „brak backfillu" nie udawał „brak treści".
          verdict = '404_gate_description_legacy';
        } else if (!backendEntry.thumbnail) {
          verdict = '404_gate_image';
        } else {
          verdict = '404_gate_other';
        }
      } else if (render.status == null) {
        verdict = 'fetch_error';
      } else {
        verdict = `http_${render.status}`;
      }

      results.push({
        handle,
        locale,
        status: render.status,
        verdict,
        rendered_title: render.title,
        rendered_h1: render.h1,
        backend_title: backendEntry?.title ?? null,
        // Cykl 3: true gdy verdict 200_ok_localized wynika z ground-truth
        // docelowego locale, którego tytuł jest identyczny z PL (nazwa
        // własna) — odróżnia to od realnej różnicy tłumaczenia.
        translation_invariant: translationInvariant,
        backend_description_words: descriptionWords,
        backend_has_thumbnail: backendEntry ? backendEntry.thumbnail != null : null,
        // Story 1.4 (AD-4/AC6): jawny ślad, KTÓRYM torem szedł gate i jaki był
        // sygnał — bez tego „404_gate_description = 0" nie odróżnia „bar zielony"
        // od „encja nigdy nie przeszła przez sync".
        gate_slug: gateSlug,
        gate_signal: gateSignal,
        content_bar_gate_flag: contentBarFlag ?? null,
        content_bar_pl: readContentBarFlag(contentBar, CONTENT_BAR_GATE_SLUG_PHASE_1) ?? null,
        translation_exists: locale === 'pl' ? null : translationExists,
        translation_ground_truth:
          locale === 'pl' ? null : independentSource ? 'independent' : 'backend_diff_dependent',
        ...(render.error ? { error: render.error } : {})
      });
    }
  }

  const summary = {};
  for (const { verdict } of results) {
    summary[verdict] = (summary[verdict] ?? 0) + 1;
  }
  const failVerdicts = results.filter(
    (r) =>
      r.verdict.startsWith('pl_fallback') ||
      r.verdict === 'pl_content_mismatch' ||
      r.verdict.startsWith('404') ||
      r.verdict.startsWith('http_') ||
      r.verdict === 'fetch_error'
  );
  const needsReviewVerdicts = results.filter(
    (r) => r.verdict === '200_ok_no_translation_unverified'
  );

  const evidence = {
    story: args.story ?? '1-3-pdp-reland-lokalizowanego-fetchu',
    acceptance_criterion: args['acceptance-criterion'] ?? 'AC5 (ship-bar HG-6)',
    // Story 1.4 (AD-4): która faza gate'u obowiązuje w tym przebiegu —
    // odczytana z runtime configu marketu, nie zadeklarowana (review 1-4-F5).
    gate_phase: gatePhaseLabel,
    gate_slug_phase_1: CONTENT_BAR_GATE_SLUG_PHASE_1,
    phase_2_locales: [...phase2Locales],
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    backend_url: backendUrl,
    locales: LOCALES,
    total_handles_in_catalog: totalHandles,
    // Surowy `count` backendu jest NIEPRZESKOPOWANY do marketu (in-place filtr
    // market-scope działa na products, nie na count) — rozjazd tych liczb to
    // produkty spoza marketu, nie luka smoke'a.
    backend_reported_count_unscoped: backendRawCount,
    checked_products: handles.length,
    checked_combinations: results.length,
    partial: limitHandles != null,
    pass: failVerdicts.length === 0 && limitHandles == null,
    needs_review: needsReviewVerdicts.length > 0,
    translation_ground_truth: translatedHandles ? 'independent (--translated-handles)' : 'backend_diff_dependent',
    // Uczciwy zakres dowodu (review 1-3-F2): co ten smoke DOWODZI, a czego nie.
    proof_scope: {
      pl_render_content:
        'werdykt 200_ok_pl_content = żywy render /pl zawiera tytuł produktu z backendu — tor renderu przenosi treść',
      pl_fallback_semantics:
        'pl_fallback_title/pl_fallback_body liczone WYŁĄCZNIE na renderach 200 dla /ua /de /en; przy 0 takich renderów wartość 0 znaczy „zero PL-fallbacku na ścieżce renderu, brak próbek 200 poza /pl" — NIE „zweryfikowano brak fallbacku end-to-end". _title = HEAD identyczny z /pl przy zlokalizowanym body (przeciek seo.*); _body = body identyczne z /pl lub sygnał h1 nieodczytywalny (fail-closed). OBA są FAIL.',
      translation_exists:
        'przy backend_diff_dependent dowodzi tylko overlay backendu (ten sam kanał) — stąd NEEDS-REVIEW zamiast PASS bez niezależnego źródła',
      gate_signal:
        'werdykt 404_gate_description = `content_bar[<gate_slug>].bar === false` (sygnał sync-time, AD-4; gate_slug per locale wg fazy z content_gate marketu — review 1-4-F5); 404_gate_description_legacy = encja BEZ wpisu content_bar dla gate_slug (okno EE-1 / luka pokrycia locale) odrzucona zastanym wordcountem — dwie różne przyczyny, nie wolno ich sumować'
    },
    summary,
    results
  };

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);

  console.log(
    `Smoke PDP × locale: ${handles.length}/${totalHandles} produktów × ${LOCALES.length} locale = ${results.length} kombinacji`
  );
  console.log(`Werdykty: ${JSON.stringify(summary)}`);
  console.log(`Evidence: ${outPath}`);

  if (failVerdicts.length > 0) {
    console.error(`FAIL: ${failVerdicts.length} kombinacji nie spełnia HG-6 (szczegóły w evidence).`);
    process.exit(1);
  }
  if (limitHandles != null) {
    console.error('Wynik częściowy (--limit-handles) — nie dowodzi HG-6.');
    process.exit(1);
  }
  if (needsReviewVerdicts.length > 0) {
    console.error(
      `NEEDS-REVIEW: ${needsReviewVerdicts.length} kombinacji 200 bez tłumaczenia wg kanału zależnego ` +
        '(brak --translated-handles) — zielone tylko warunkowo, dostarcz niezależne źródło prawdy (np. evidence 4.4).'
    );
  }
  console.log('PASS: zero FAILi handle × locale.');
}

// Guard: uruchom main() tylko przy bezpośrednim wywołaniu (`node
// smoke-pdp-locales.mjs`), NIE przy imporcie z testu jednostkowego
// klasyfikatora (cykl 3) — inaczej import ciągnąłby za sobą sieć/fs i
// process.exit w każdym teście.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    // Review 1-3-F10: wyjątek spoza jawnych bramek fail-closed to bug NARZĘDZIA,
    // nie problem środowiska — osobny exit code, żeby operator nie dostawał
    // instrukcji „postaw stack" na TypeError w klasyfikatorze.
    console.error(`TOOL-ERROR: nieoczekiwany błąd smoke (bug skryptu, NIE brak stacku):`);
    console.error(error?.stack ?? String(error));
    process.exit(3);
  });
}
