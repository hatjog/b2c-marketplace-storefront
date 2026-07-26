#!/usr/bin/env node
/**
 * smoke-pdp-locales.mjs — v1.14.0 Story 1.3 (AC5, ship-bar HG-6).
 *
 * Smoke skryptowy PDP × locale: iteruje WSZYSTKIE handle katalogu i sprawdza
 * `/pl /ua /de /en × handle` na prod-buildzie storefrontu (`next build` +
 * `next start`; dev-server 200 ≠ prod — lekcja Sprint-1).
 *
 * Werdykty per handle × locale:
 *  - `200_ok_localized`   — 200, treść w żądanym locale (≠ wariant /pl przy
 *                           istniejącym tłumaczeniu w backendzie),
 *  - `200_ok_no_translation` — 200, backend nie ma zmaterializowanego
 *                           tłumaczenia ⇒ identyczność z /pl jest oczekiwana,
 *  - `pl_fallback`        — FAIL: tłumaczenie istnieje w backendzie, a render
 *                           jest identyczny z /pl (klasa błędu v1.13.0),
 *  - `404_quality_gate`   — produkt istnieje w backendzie, ale opis w tym
 *                           locale ma < 80 słów ⇒ odfiltrowany przez
 *                           checkQualityGate (SPRZĘŻENIE 1.4 / E-3 — raportuj,
 *                           NIE kompensuj w 1.3),
 *  - `404_not_found`      — 404 bez śladu quality-gate,
 *  - `http_<status>`      — inny status,
 *  - `fetch_error`        — błąd sieci po stronie storefrontu.
 *
 * FAIL-CLOSED (wzorzec _grow/tools/validate_live_render_smoke.py): brak
 * backendu / brak storefrontu / 0 handli w katalogu ⇒ NEEDS-LIVE-RUN, exit 2 —
 * nigdy „green". Liczba sprawdzonych produktów jest w evidence JAWNIE, żeby
 * „113/113" nie mogło być prawdą przy 3 sprawdzonych.
 *
 * Exit: 0 = wszystkie handle × locale zielone; 1 = są FAILe (pl_fallback /
 * 404 / błędy); 2 = NEEDS-LIVE-RUN (stack niedostępny / katalog pusty).
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
 *     [--limit-handles N]           # TYLKO do debugowania; wynik z limitem
 *                                   # jest zawsze oznaczany partial=true
 */
import fs from 'node:fs';
import path from 'node:path';

const LOCALES = ['pl', 'ua', 'de', 'en'];
const BCP47_BY_SLUG = { pl: 'pl-PL', ua: 'uk-UA', de: 'de-DE', en: 'en-US' };
const MIN_DESCRIPTION_WORDS = 80; // lustro checkQualityGate (normalize-listed-products.ts)
const FETCH_CONCURRENCY = 8;
const PAGE_SIZE = 100;

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
  return { title, description };
}

async function fetchJson(url, headers) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`${url} → HTTP ${response.status}`);
  }
  return response.json();
}

/** Katalog per locale: handle → { title, description } (overlay backendu). */
async function fetchCatalog(backendUrl, publishableKey, localeSlug) {
  const products = new Map();
  let offset = 0;
  for (;;) {
    const url =
      `${backendUrl}/store/products?limit=${PAGE_SIZE}&offset=${offset}` +
      `&fields=handle,title,description`;
    const payload = await fetchJson(url, {
      'x-publishable-api-key': publishableKey,
      'x-medusa-locale': BCP47_BY_SLUG[localeSlug]
    });
    for (const product of payload.products ?? []) {
      products.set(product.handle, {
        title: product.title ?? null,
        description: product.description ?? null
      });
    }
    offset += PAGE_SIZE;
    if ((payload.products ?? []).length < PAGE_SIZE || offset >= (payload.count ?? 0)) break;
  }
  return products;
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

  if (!publishableKey) {
    needsLiveRun('brak NEXT_PUBLIC_PUBLISHABLE_API_KEY (env / .env.local)');
  }

  // --- Katalog z backendu (per locale overlay) — fail-closed na braku stacku.
  const catalogByLocale = {};
  try {
    for (const locale of LOCALES) {
      catalogByLocale[locale] = await fetchCatalog(backendUrl, publishableKey, locale);
    }
  } catch (error) {
    needsLiveRun(`backend niedostępny (${backendUrl}): ${error.message}`);
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
        ...(response.status === 200 ? extractRendered(html) : { title: null, description: null })
      });
    } catch (error) {
      rendered.set(`${handle}|${locale}`, {
        status: null,
        title: null,
        description: null,
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
      const translationExists =
        locale !== 'pl' &&
        backendEntry != null &&
        backendPl != null &&
        (backendEntry.title !== backendPl.title ||
          backendEntry.description !== backendPl.description);
      const descriptionWords = wordCount(backendEntry?.description);

      let verdict;
      if (render.status === 200) {
        if (locale === 'pl') {
          verdict = '200_ok_localized';
        } else if (!translationExists) {
          verdict = '200_ok_no_translation';
        } else {
          const identicalToPl =
            plRender?.status === 200 &&
            render.title === plRender.title &&
            render.description === plRender.description;
          verdict = identicalToPl ? 'pl_fallback' : '200_ok_localized';
        }
      } else if (render.status === 404) {
        verdict =
          backendEntry != null && descriptionWords < MIN_DESCRIPTION_WORDS
            ? '404_quality_gate'
            : '404_not_found';
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
        backend_title: backendEntry?.title ?? null,
        backend_description_words: descriptionWords,
        translation_exists: locale === 'pl' ? null : translationExists,
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
      r.verdict === 'pl_fallback' ||
      r.verdict.startsWith('404') ||
      r.verdict.startsWith('http_') ||
      r.verdict === 'fetch_error'
  );

  const evidence = {
    story: '1-3-pdp-reland-lokalizowanego-fetchu',
    acceptance_criterion: 'AC5 (ship-bar HG-6)',
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    backend_url: backendUrl,
    locales: LOCALES,
    total_handles_in_catalog: totalHandles,
    checked_products: handles.length,
    checked_combinations: results.length,
    partial: limitHandles != null,
    pass: failVerdicts.length === 0 && limitHandles == null,
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
  console.log('PASS: wszystkie handle × locale zielone.');
}

main().catch((error) => {
  needsLiveRun(`nieoczekiwany błąd smoke: ${error?.stack ?? error}`);
});
