/**
 * hg13-oracle.mjs — niezależne źródło prawdy fingerprintów locale dla HG-13.
 *
 * ══ Dlaczego oracle NIE może pochodzić z mierzonego storefrontu ══
 * Lekcja tej fali (Dev Notes 5.5, pkt 2): „źródło metryki != źródło prawdy".
 * Gdyby oczekiwany tekst dla `/de` brać z pierwszej odpowiedzi `/de`, test
 * porównywałby storefront sam ze sobą — przeciek cache'u polegający na tym, że
 * WSZYSTKIE odpowiedzi `/de` są po polsku, dałby wtedy zielone „100% zgodne".
 *
 * Dlatego fingerprinty pochodzą z plików gp-ops, z których market został
 * zaseedowany, i są zamrożone (z SHA-256 źródeł) PRZED pomiarami:
 *   • PL  — `config/gp-dev/markets/bonbeauty/products.yaml` (`categories[].name`,
 *           `products[].name`) — źródłowa treść rynku,
 *   • UA/DE — `i18n/categories.yaml` / `i18n/products.yaml`
 *           (`fields.name|title.{uk-UA,de-DE}`) — warstwa tłumaczeń.
 *
 * ══ Dlaczego sama rozłączność par to za mało — zmierzone, nie przewidziane ══
 * Fingerprint jest szukany jako podciąg, więc każde trafienie musi dać się
 * przypisać DOKŁADNIE do jednego zasobu i jednego języka. Pierwsza wersja tego
 * modułu sprawdzała unikalność wyłącznie wobec innych NAZW i przepuściła marker
 * „Uroda". Żywy przebieg na prod-buildzie dał wtedy **64/180 fałszywych
 * przecieków**, bo niemiecki OPIS tej samej kategorii brzmi
 * „Uroda ist die Kategorie für…" i używa polskiej nazwy własnej wprost.
 *
 * Stąd `markerIsAttributable`: korpus niesie etykietę `(zasób, locale)`,
 * a marker odpada przy obu rodzajach kolizji:
 *   • WEWNĄTRZ locale, inny zasób — „Twarz" ⊂ „Twarz – pielęgnacja i terapie";
 *   • MIĘDZY locale — polski tekst obecny w treści de/ua.
 * Kolizja z własnym opisem w tym samym locale jest dozwolona: tytuł produktu
 * niemal zawsze występuje w jego opisie, a atrybucja jest wtedy poprawna.
 *
 * AC2 wymaga wprost: „nazwa wspólna dla locale nie może być jedynym markerem" —
 * kandydat, którego fingerprinty PL/UA/DE nie są parami rozłączne, jest odrzucany.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

/** Locale HG-13. Dokładnie te trzy — AC2. */
export const HG13_LOCALES = ['pl', 'ua', 'de'];

/** Mapowanie locale runtime → klucz pola w gp-ops (BCP 47). */
export const LOCALE_FIELD = Object.freeze({ pl: 'pl-PL', ua: 'uk-UA', de: 'de-DE' });

/** Klasy zasobów wymagane przez AC2. */
export const HG13_CLASSES = ['catalog', 'category', 'pdp'];

export function sha256File(absPath) {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

/**
 * Normalizacja HTML przed szukaniem fingerprintu.
 *
 * SSR zwraca UTF-8, ale apostrofy i ampersandy bywają encodowane (`&#x27;`,
 * `&amp;`), a whitespace łamany dowolnie. Bez normalizacji „Wellness & SPA"
 * nie zostałoby znalezione w `Wellness &amp; SPA` i cała komórka wyglądałaby
 * na brak własnego locale — czyli FAIL z powodu buga narzędzia, nie produktu.
 */
export function normalizeText(input) {
  return String(input)
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#38;/gi, '&')
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Czy `needle` jest bezpiecznym, unikalnym markerem w korpusie `corpus`?
 * Bezpieczny = nie jest podciągiem żadnego INNEGO stringa z korpusu i żaden
 * inny string z korpusu nie jest jego podciągiem.
 */
export function isUnambiguousMarker(needle, corpus) {
  const n = normalizeText(needle);
  if (n.length < 4) return false; // za krótkie markery trafiają przypadkiem
  for (const other of corpus) {
    const o = normalizeText(other);
    if (o === n) continue;
    if (o.includes(n) || n.includes(o)) return false;
  }
  return true;
}

/**
 * Rozłączność par fingerprintów jednego zasobu. Zwraca listę naruszeń —
 * pusta lista jest warunkiem koniecznym przyjęcia kandydata (AC2).
 */
export function pairwiseDisjointViolations(fingerprints) {
  const violations = [];
  const entries = Object.entries(fingerprints);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [la, va] = entries[i];
      const [lb, vb] = entries[j];
      const a = normalizeText(va);
      const b = normalizeText(vb);
      if (!a || !b) {
        violations.push({ pair: [la, lb], rule: 'EMPTY_FINGERPRINT' });
      } else if (a === b) {
        violations.push({ pair: [la, lb], rule: 'IDENTICAL_ACROSS_LOCALES', value: a });
      } else if (a.includes(b) || b.includes(a)) {
        violations.push({ pair: [la, lb], rule: 'SUBSTRING_OVERLAP', values: [a, b] });
      }
    }
  }
  return violations;
}

function readYaml(absPath) {
  return yaml.load(fs.readFileSync(absPath, 'utf8'));
}

/**
 * Wczytuje surowe dane gp-ops i buduje kandydatów: kategorie i produkty
 * z kompletem PL/UA/DE.
 */
/** Rekurencyjnie zbiera wszystkie stringi z zagniezdzonej struktury. */
function collectStrings(node, sink) {
  if (typeof node === 'string') { if (node.trim()) sink.push(node); return; }
  if (Array.isArray(node)) { for (const item of node) collectStrings(item, sink); return; }
  if (node && typeof node === 'object') { for (const value of Object.values(node)) collectStrings(value, sink); }
}

/**
 * Rozbija pola i18n na stringi PRZYPISANE DO LOCALE.
 *
 * To jest sedno poprawki po pierwszym zywym przebiegu. Wczesniej korpus
 * zawieral wylacznie NAZWY, wiec marker „Uroda" (PL) przeszedl kontrole —
 * a niemiecki OPIS tej samej kategorii brzmi „Uroda ist die Kategorie für…"
 * i uzywa polskiej nazwy wlasnej wprost. Kazde zadanie /de znajdowalo wtedy
 * „obcy fingerprint PL" i wygladalo jak przeciek, ktorym nie bylo.
 */
function localeStringsFromFields(fields) {
  const out = { 'pl-PL': [], 'en-US': [], 'uk-UA': [], 'de-DE': [] };
  for (const value of Object.values(fields ?? {})) {
    if (!value || typeof value !== 'object') continue;
    for (const [bcp, text] of Object.entries(value)) {
      if (out[bcp] && typeof text === 'string' && text.trim()) out[bcp].push(text);
    }
  }
  return out;
}

export function loadGpOpsCorpus(repoRoot, { market = 'bonbeauty', environment = 'gp-dev' } = {}) {
  const sourcePaths = {
    source_catalog: path.join(
      repoRoot, 'gp-ops', 'markets', market, 'config', environment, 'markets', market, 'products.yaml'
    ),
    i18n_categories: path.join(repoRoot, 'gp-ops', 'markets', market, 'i18n', 'categories.yaml'),
    i18n_products: path.join(repoRoot, 'gp-ops', 'markets', market, 'i18n', 'products.yaml')
  };
  for (const [role, p] of Object.entries(sourcePaths)) {
    if (!fs.existsSync(p)) throw new Error(`brak źródła oracle (${role}): ${p}`);
  }

  const sourceCatalog = readYaml(sourcePaths.source_catalog) ?? {};
  const i18nCategories = readYaml(sourcePaths.i18n_categories) ?? {};
  const i18nProducts = readYaml(sourcePaths.i18n_products) ?? {};

  const catI18n = new Map();
  for (const entry of i18nCategories.entries ?? []) {
    if (entry?.handle) catI18n.set(entry.handle, entry.fields ?? {});
  }
  const prodI18n = new Map();
  for (const entry of i18nProducts.entries ?? []) {
    if (entry?.handle) prodI18n.set(entry.handle, entry.fields ?? {});
  }

  // `byLocale[locale]` = wszystkie stringi, ktore moga wyrenderowac sie na
  // stronie TEGO locale. PL-owe zrodlo (nazwa, opis, SEO z products.yaml)
  // trafia do `plSource` — te pola renderuja sie takze na stronach de/ua
  // wszedzie tam, gdzie brakuje tlumaczenia, wiec dla de/ua sa „legalnym
  // polskim tekstem", a nie przeciekiem cache'u.
  // Kazdy string niesie ETYKIETE: z ktorego zasobu i z ktorego locale pochodzi.
  // Bez tej etykiety nie da sie odroznic dwoch roznych kolizji, ktore wymagaja
  // przeciwnych decyzji:
  //   * marker w OPISIE TEGO SAMEGO zasobu w TYM SAMYM locale -> poprawna
  //     atrybucja, marker zostaje (tytul produktu zwykle wystepuje w jego opisie),
  //   * marker w czymkolwiek innym -> trafienie zostaloby przypisane zlemu
  //     zasobowi albo zlemu jezykowi, wiec marker odpada.
  const labeled = [];
  const push = (handle, locale, texts) => {
    for (const text of texts) labeled.push({ handle, locale, text });
  };

  const categories = [];
  for (const c of sourceCatalog.categories ?? []) {
    const handle = c?.handle ?? c?.slug;
    if (!handle || !c?.name) continue;
    const fields = catI18n.get(handle) ?? {};
    const name = fields.name ?? {};
    const sourceStrings = [];
    collectStrings(c, sourceStrings);
    // Zrodlo gp-ops jest PL-owe: nieprzetlumaczone pola (opis, `seo.*`)
    // renderuja sie na KAZDYM locale, wiec dla de/ua sa legalnym polskim
    // tekstem, a nie przeciekiem.
    push(handle, 'pl', sourceStrings);
    const perLocale = localeStringsFromFields(fields);
    push(handle, 'pl', perLocale['pl-PL']);
    push(handle, 'ua', perLocale['uk-UA']);
    push(handle, 'de', perLocale['de-DE']);
    categories.push({
      handle,
      active: c.active !== false,
      fingerprints: { pl: c.name, ua: name['uk-UA'] ?? null, de: name['de-DE'] ?? null }
    });
  }

  const products = [];
  for (const p of sourceCatalog.products ?? []) {
    const handle = p?.slug ?? p?.handle;
    if (!handle || !p?.name) continue;
    const fields = prodI18n.get(handle) ?? {};
    const title = fields.title ?? {};
    const sourceStrings = [];
    collectStrings(p, sourceStrings);
    push(handle, 'pl', sourceStrings);
    const perLocale = localeStringsFromFields(fields);
    push(handle, 'pl', perLocale['pl-PL']);
    push(handle, 'ua', perLocale['uk-UA']);
    push(handle, 'de', perLocale['de-DE']);
    products.push({
      handle,
      active: String(p.status ?? 'published') !== 'draft',
      fingerprints: { pl: p.name, ua: title['uk-UA'] ?? null, de: title['de-DE'] ?? null }
    });
  }

  return { sourcePaths, categories, products, labeled };
}

/**
 * Czy marker `needle` dla zasobu `handle` w locale `locale` jest jednoznaczny?
 *
 * Marker jest szukany jako podciag w HTML, wiec kazde trafienie musi dac sie
 * przypisac DOKLADNIE do tego zasobu i tego jezyka. Odrzucamy marker, ktory
 * koliduje z jakimkolwiek stringiem poza wlasnym (zasob, locale):
 *
 *   * kolizja WEWNATRZ locale, inny zasob — „Twarz" jest podciagiem
 *     „Twarz – pielegnacja i terapie"; trafienie na /de zostaloby policzone
 *     jako przeciek zasobu „twarz", ktorym nie jest;
 *   * kolizja MIEDZY locale — PL-owe „Uroda" wystepuje wprost w niemieckim
 *     OPISIE tej samej kategorii („Uroda ist die Kategorie für…"), a PL-owy
 *     `seo.meta_title` renderuje sie na kazdym locale. Zmierzone w pierwszym
 *     zywym przebiegu: 64/180 falszywych trafien.
 *
 * Kolizja z wlasnym opisem w tym samym locale jest DOZWOLONA — tytul produktu
 * niemal zawsze wystepuje w jego wlasnym opisie, a atrybucja jest wtedy poprawna.
 */
export function markerIsAttributable(needle, handle, locale, labeled) {
  const n = normalizeText(needle);
  if (n.length < 4) return false; // za krotkie markery trafiaja przypadkiem
  for (const item of labeled) {
    if (item.handle === handle && item.locale === locale) continue;
    const other = normalizeText(item.text);
    if (other === n) return false;
    if (other.includes(n) || n.includes(other)) return false;
  }
  return true;
}

/**
 * Wybiera kandydata z kompletnym, rozłącznym i jednoznacznym zestawem
 * fingerprintów. `availableHandles` (gdy podane) zawęża do zasobów, które
 * REALNIE istnieją w backendzie — oracle wskazujący na nieistniejący zasób
 * dałby 404 i „brak dowodu", a nie przeciek.
 */
export function pickCandidates(items, labeled, availableHandles, rejected) {
  const accepted = [];
  for (const item of items) {
    if (!item.active) { rejected.push({ handle: item.handle, rule: 'INACTIVE' }); continue; }
    if (availableHandles && !availableHandles.has(item.handle)) {
      rejected.push({ handle: item.handle, rule: 'NOT_IN_BACKEND_CATALOG' });
      continue;
    }
    const missing = HG13_LOCALES.filter((l) => !item.fingerprints[l]);
    if (missing.length > 0) {
      rejected.push({ handle: item.handle, rule: 'MISSING_LOCALE_FINGERPRINT', locales: missing });
      continue;
    }
    const violations = pairwiseDisjointViolations(item.fingerprints);
    if (violations.length > 0) {
      rejected.push({ handle: item.handle, rule: 'NOT_PAIRWISE_DISJOINT', violations });
      continue;
    }
    // Marker locale L jest sprawdzany wzgledem korpusu tego, co moze
    // wyrenderowac sie na stronie INNEGO locale — a nie wzgledem jednej,
    // wspolnej listy nazw. Pierwszy zywy przebieg pokazal, dlaczego to nie
    // jest niuans: PL-owa nazwa „Uroda" siedzi w niemieckim OPISIE tej samej
    // kategorii, a PL-owy `seo.meta_title` renderuje sie na kazdym locale.
    const ambiguous = HG13_LOCALES.filter(
      (l) => !markerIsAttributable(item.fingerprints[l], item.handle, l, labeled)
    );
    if (ambiguous.length > 0) {
      rejected.push({ handle: item.handle, rule: 'AMBIGUOUS_MARKER_IN_CORPUS', locales: ambiguous });
      continue;
    }
    accepted.push(item);
  }
  return accepted;
}

/**
 * Buduje zamrożony oracle HG-13.
 *
 * `availableCategoryHandles` / `availableProductHandles` pochodzą z backendu
 * (uncached, PRZED pomiarami) i służą wyłącznie do sprawdzenia ISTNIENIA
 * zasobu. Treść fingerprintów NIGDY z nich nie pochodzi.
 */
export function buildOracle(repoRoot, {
  market = 'bonbeauty',
  environment = 'gp-dev',
  availableCategoryHandles = null,
  availableProductHandles = null
} = {}) {
  const { sourcePaths, categories, products, labeled } =
    loadGpOpsCorpus(repoRoot, { market, environment });

  const rejected = { category: [], pdp: [] };
  const categoryCandidates = pickCandidates(categories, labeled, availableCategoryHandles, rejected.category);
  const productCandidates = pickCandidates(products, labeled, availableProductHandles, rejected.pdp);
  const category = categoryCandidates[0] ?? null;
  const product = productCandidates[0] ?? null;

  if (!category) {
    throw new Error(
      'oracle: brak kategorii z kompletnym, rozłącznym i jednoznacznym zestawem PL/UA/DE — ' +
      `odrzucono ${rejected.category.length} kandydatów (${JSON.stringify(rejected.category.slice(0, 3))})`
    );
  }
  if (!product) {
    throw new Error(
      'oracle: brak produktu z kompletnym, rozłącznym i jednoznacznym zestawem PL/UA/DE — ' +
      `odrzucono ${rejected.pdp.length} kandydatów (${JSON.stringify(rejected.pdp.slice(0, 3))})`
    );
  }

  // Klasa `catalog` to listing `/{locale}/categories`. Markerem jest zlokalizowana
  // nazwa TEJ SAMEJ kategorii, co klasa `category` — AC2 wymaga „tych samych
  // identyfikatorów zasobów" w trzech klasach, więc zasób jest jeden, a różni się
  // powierzchnia, na której go szukamy.
  const resources = [
    {
      class: 'catalog',
      resource_id: category.handle,
      url_template: '/{locale}/categories',
      fingerprints: { ...category.fingerprints }
    },
    {
      class: 'category',
      resource_id: category.handle,
      url_template: `/{locale}/categories/${category.handle}`,
      fingerprints: { ...category.fingerprints }
    },
    {
      class: 'pdp',
      resource_id: product.handle,
      url_template: `/{locale}/products/${product.handle}`,
      fingerprints: { ...product.fingerprints }
    }
  ];

  const sources = Object.entries(sourcePaths).map(([role, absPath]) => ({
    role,
    path: path.relative(repoRoot, absPath),
    sha256: sha256File(absPath)
  }));

  const disjointness = resources.map((r) => ({
    class: r.class,
    resource_id: r.resource_id,
    violations: pairwiseDisjointViolations(r.fingerprints)
  }));

  return {
    schema: 'gp.v1140.hg13-oracle.v1',
    generated_at: new Date().toISOString(),
    market,
    environment,
    locales: HG13_LOCALES,
    classes: HG13_CLASSES,
    locale_field_map: LOCALE_FIELD,
    independence:
      'fingerprinty pochodzą WYŁĄCZNIE z plików gp-ops (SHA-256 niżej), zamrożone PRZED pomiarami; ' +
      'ani jeden znak nie pochodzi z mierzonej odpowiedzi storefrontu (AC2)',
    sources,
    resources,
    disjointness,
    rejected_candidates: rejected
  };
}
