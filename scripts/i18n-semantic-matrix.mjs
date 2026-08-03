#!/usr/bin/env node
/**
 * QD-I18N-07 — orkiestrator semantycznej macierzy i18n.
 *
 * Odpowiada za wszystko, co MUSI byc prawda ZANIM cokolwiek zostanie zmierzone:
 *   1. stack zyje (storefront prod build + backend),
 *   2. pomiar jest SWIEZY (ISR uniewazniony przez /api/revalidate-all),
 *   3. lista locale pochodzi z runtime market config (ADR-154), nie z testu,
 *   4. fixture istnieja albo sa jawnie NIEDOSTEPNE (nigdy "prawdopodobne"),
 * a nastepnie uruchamia spec Playwrighta i agreguje evidence.
 *
 * Kontrakt wyjscia (zgodny z rodzina Gate A):
 *   0 = PASS, 1 = FAIL, 2 = NEEDS-LIVE-RUN, 3 = TOOL-ERROR.
 *
 * Kluczowa zasada: skip, timeout, brak fixture'a i pusty denominator NIGDY nie
 * daja PASS. Evidence jest zapisywane na KAZDEJ sciezce wyjscia, a marker
 * `state: RUNNING` powstaje PRZED pomiarem, zeby crash nie zostawil po sobie
 * zielonego artefaktu z poprzedniego przebiegu.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STOREFRONT_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(STOREFRONT_ROOT, '..', '..');

const TOOL = 'i18n-semantic-matrix';
const TOOL_REVISION = '1';
const SPEC_ID = 'QD-I18N-07';

class NeedsLiveRun extends Error {}
class ToolError extends Error {}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    port: 3112,
    market: process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID ?? 'bonbeauty',
    release: 'v1.14.0',
    backendUrl: process.env.MEDUSA_BACKEND_URL ?? 'http://localhost:9002',
    out: null,
    cellsOut: null,
    skipRevalidate: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined) throw new ToolError(`Brak wartosci dla ${a}`);
      i += 1;
      return v;
    };
    if (a === '--port') args.port = Number(next());
    else if (a === '--market') args.market = next();
    else if (a === '--release') args.release = next();
    else if (a === '--backend-url') args.backendUrl = next();
    else if (a === '--out') args.out = next();
    else if (a === '--cells-out') args.cellsOut = next();
    else if (a === '--skip-revalidate') args.skipRevalidate = true;
    else throw new ToolError(`Nieznany argument: ${a}`);
  }
  if (!Number.isInteger(args.port) || args.port < 1024) {
    throw new ToolError(`--port musi byc liczba >= 1024, dostano ${args.port}`);
  }
  if (!/^v\d+\.\d+\.\d+$/.test(args.release)) {
    throw new ToolError(`--release musi pasowac do vX.Y.Z, dostano ${args.release}`);
  }
  args.out ??= path.join(
    REPO_ROOT,
    '_bmad-output/releases',
    args.release,
    'implementation-artifacts/evidence',
    'qd-07-i18n-semantic-matrix.json'
  );
  // UWAGA: NIE uzywac `test-results/` — Playwright czysci swoj outputDir przy
  // starcie, wiec plan zniknalby, zanim spec zdazylby go odczytac.
  args.cellsOut ??= path.join(STOREFRONT_ROOT, '.qd07', 'i18n-semantic-matrix-cells.json');
  return args;
}

// ── env / helpers ────────────────────────────────────────────────────────────

function readEnvLocal() {
  const p = path.join(STOREFRONT_ROOT, '.env.local');
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function probe(url, opts = {}) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(opts.timeout ?? 15_000), ...opts });
    return { ok: true, status: r.status, res: r };
  } catch (e) {
    return { ok: false, status: null, error: String(e?.message ?? e) };
  }
}

function gitSha(dir) {
  try {
    const head = fs.readFileSync(path.join(dir, '.git'), 'utf8').trim();
    const gitDir = head.startsWith('gitdir:')
      ? path.resolve(dir, head.slice(7).trim())
      : path.join(dir, '.git');
    const ref = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (ref.startsWith('ref: ')) {
      const refPath = path.join(gitDir, ref.slice(5));
      if (fs.existsSync(refPath)) return fs.readFileSync(refPath, 'utf8').trim();
      const packed = path.join(gitDir, 'packed-refs');
      if (fs.existsSync(packed)) {
        const m = new RegExp(`^([0-9a-f]{40}) ${ref.slice(5)}$`, 'm').exec(
          fs.readFileSync(packed, 'utf8')
        );
        if (m) return m[1];
      }
      return null;
    }
    return ref;
  } catch {
    return null;
  }
}

// ── evidence ─────────────────────────────────────────────────────────────────

function writeEvidence(outPath, evidence) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

// ── preflight ────────────────────────────────────────────────────────────────

/**
 * Lista locale pochodzi z runtime market config, a nie z listy w tescie.
 * Zrodlo jest zapisywane w evidence, zeby dalo sie zweryfikowac, SKAD wzieta.
 */
async function resolveLocales(baseUrl, marketId, env) {
  const payloadUrl = env.PAYLOAD_API_URL ?? process.env.PAYLOAD_API_URL;
  if (payloadUrl) {
    const r = await probe(
      `${payloadUrl}/api/market-configs?where[market_id][equals]=${encodeURIComponent(marketId)}&depth=0&limit=1`
    );
    if (r.ok && r.status === 200) {
      const body = await r.res.json().catch(() => null);
      const doc = body?.docs?.[0];
      const loc = doc?.locales;
      if (loc && Array.isArray(loc.supported) && loc.supported.length > 0) {
        return {
          locales: loc.supported,
          default_locale: loc.default ?? loc.supported[0],
          source: `payload:${payloadUrl}/api/market-configs[market_id=${marketId}].locales.supported`
        };
      }
    }
  }
  const gpOps = path.join(REPO_ROOT, 'gp-ops/markets', marketId, 'config/gp-dev/markets', marketId, 'market.yaml');
  if (fs.existsSync(gpOps)) {
    // Parser YAML, nie regex: `locales:` sasiaduje z `supported_locales:` oraz
    // `fallback_chain:`, ktore niosa te same kody. Skanowanie tekstem sklejalo
    // te listy i produkowalo zdublowane locale (i zdublowane komorki macierzy).
    const yamlMod = await import('yaml');
    const parse = yamlMod.parse ?? yamlMod.default?.parse;
    if (typeof parse !== 'function') throw new ToolError('Pakiet "yaml" nie udostepnia parse()');
    const doc = parse(fs.readFileSync(gpOps, 'utf8'));
    const supported = doc?.locales?.supported;
    if (Array.isArray(supported) && supported.length > 0) {
      const uniq = [...new Set(supported.map(String))];
      if (uniq.length !== supported.length) {
        throw new ToolError(`market.locales.supported zawiera duplikaty: ${JSON.stringify(supported)}`);
      }
      return {
        locales: uniq,
        default_locale: doc?.locales?.default ?? uniq[0],
        source: `gp-ops:${path.relative(REPO_ROOT, gpOps)}#locales.supported`
      };
    }
  }
  throw new NeedsLiveRun(
    `Nie udalo sie odczytac market.locales dla '${marketId}' ani z Payloada, ani z gp-ops. ` +
      'Lista locale NIE MOZE byc zaszyta w tescie (ADR-154) - bez zrodla nie ma pomiaru.'
  );
}

/**
 * Bramka swiezosci. Bez niej listingi serwuja nieswiezy cache ISR, a strona
 * wyglada na dzialajaca zwracajac 200 dla stanu sprzed godziny.
 */
async function assertFreshness(baseUrl, env, skip) {
  if (skip) {
    return { revalidate_invoked: false, revalidate_status: null, fresh: false, note: '--skip-revalidate: pomiar NIE jest udowodniony jako swiezy' };
  }
  const secret = env.REVALIDATE_SECRET ?? process.env.REVALIDATE_SECRET;
  if (!secret) {
    throw new NeedsLiveRun(
      'REVALIDATE_SECRET nieustawiony - nie da sie uniewaznic cache ISR, wiec kazdy zielony wynik ' +
        'moglby opisywac stan sprzed godziny. To NIE jest zielen, to brak pomiaru.'
    );
  }
  const r = await probe(`${baseUrl}/api/revalidate-all`, {
    method: 'POST',
    headers: { 'x-revalidate-secret': secret },
    timeout: 30_000
  });
  if (!r.ok || r.status !== 200) {
    throw new NeedsLiveRun(
      `POST /api/revalidate-all zwrocilo ${r.status ?? r.error} zamiast 200 - swiezosc pomiaru nieudowodniona.`
    );
  }
  return { revalidate_invoked: true, revalidate_status: 200, fresh: true, note: 'revalidatePath("/", "layout") potwierdzone 200 przed pomiarem' };
}

/**
 * Fixture CMS musi byc DETERMINISTYCZNY i ZWERYFIKOWANY renderem.
 *
 * Payload potrafi zwrocic dokument `published`, ktorego storefront nie serwuje
 * (404 na wszystkich locale). Wybranie takiego wpisu zamienia macierz i18n w
 * pomiar zepsutego routingu: komorki czerwienia sie rownomiernie na kazdym
 * locale i wygladaja jak defekt tlumaczen, ktorym nie sa.
 *
 * Dlatego: kandydaci sortowani po slugu (powtarzalnosc), pierwszy OSIAGALNY na
 * locale domyslnym wygrywa, a kazdy nieosiagalny trafia do `notes` jako osobny
 * finding - zamiast zostac po cichu ominietym.
 */
async function resolveCmsFixture(o) {
  const { id, pageType, urlFor, payloadUrl, baseUrl, marketId, available, unavailable, notes } = o;
  const r = await probe(`${payloadUrl}/api/pages?where[page_type][equals]=${pageType}&depth=0&limit=100`);
  if (!r.ok || r.status !== 200) {
    unavailable(id, `payload /api/pages[page_type=${pageType}] -> ${r.status ?? r.error}`);
    return;
  }
  const body = await r.res.json().catch(() => null);
  const candidates = (body?.docs ?? [])
    .filter((d) => d?.slug && d?._status === 'published')
    .filter((d) => !/^(bonevent|mercur)-/.test(String(d.slug)))
    .map((d) => String(d.slug))
    .sort();

  if (candidates.length === 0) {
    unavailable(id, `brak opublikowanego dokumentu page_type=${pageType} dla rynku ${marketId}`);
    return;
  }

  const unreachable = [];
  for (const slug of candidates) {
    const p = await probe(`${baseUrl}${urlFor(slug)}`, { timeout: 45_000 });
    if (p.ok && p.status === 200) {
      available(id, slug, `${payloadUrl}/api/pages[page_type=${pageType}] -> zweryfikowany 200 na ${urlFor(slug)}`);
      if (unreachable.length > 0) {
        notes.push({
          kind: 'CMS_PUBLISHED_BUT_UNROUTABLE',
          page_type: pageType,
          slugs: unreachable,
          detail:
            'Dokumenty sa `published` w Payload, ale storefront zwraca dla nich non-200 na locale ' +
            'domyslnym. To defekt routingu tresci, NIE defekt i18n - odnotowany osobno, zeby nie ' +
            'zanieczyszczal macierzy jezykowej.'
        });
      }
      return;
    }
    unreachable.push({ slug, status: p.status ?? p.error });
  }
  unavailable(
    id,
    `zaden z ${candidates.length} opublikowanych dokumentow page_type=${pageType} nie jest osiagalny: ` +
      JSON.stringify(unreachable)
  );
}

/**
 * Fixture sa ROZSTRZYGANE z zywego backendu. Brak fixture'a nie jest cicho
 * pomijany - staje sie jawnym `unavailable`, ktory zamienia komorki w UNEXECUTED.
 */
async function resolveFixtures(backendUrl, env, payloadUrl, marketId, baseUrl, defaultLocale, notes) {
  const pk = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  const H = pk ? { 'x-publishable-api-key': pk } : {};
  const fixtures = {};

  const unavailable = (id, reason) => {
    fixtures[id] = { id, available: false, value: null, reason };
  };
  const available = (id, value, source) => {
    fixtures[id] = { id, available: true, value, source };
  };

  const prod = await probe(`${backendUrl}/store/products?limit=1`, { headers: H });
  if (prod.ok && prod.status === 200) {
    const b = await prod.res.json().catch(() => null);
    const count = b?.count ?? 0;
    if (count > 0 && b?.products?.[0]?.handle) {
      available('FX-PRODUCT-1', b.products[0].handle, `${backendUrl}/store/products (count=${count})`);
    } else {
      unavailable('FX-PRODUCT-1', `PDP count = ${count} - zerowy katalog NIE jest PASS (AC2)`);
    }
  } else {
    unavailable('FX-PRODUCT-1', `backend /store/products -> ${prod.status ?? prod.error}`);
  }

  const cat = await probe(`${backendUrl}/store/product-categories?limit=1`, { headers: H });
  if (cat.ok && cat.status === 200) {
    const b = await cat.res.json().catch(() => null);
    const h = b?.product_categories?.[0]?.handle;
    if (h) available('FX-CATEGORY-1', h, `${backendUrl}/store/product-categories (count=${b?.count})`);
    else unavailable('FX-CATEGORY-1', 'brak kategorii w backendzie');
  } else unavailable('FX-CATEGORY-1', `backend /store/product-categories -> ${cat.status ?? cat.error}`);

  const sel = await probe(`${backendUrl}/store/seller?limit=1`, { headers: H });
  if (sel.ok && sel.status === 200) {
    const b = await sel.res.json().catch(() => null);
    const h = b?.sellers?.[0]?.handle;
    if (h) available('FX-SELLER-1', h, `${backendUrl}/store/seller (count=${b?.count})`);
    else unavailable('FX-SELLER-1', 'brak sellerow w backendzie');
  } else unavailable('FX-SELLER-1', `backend /store/seller -> ${sel.status ?? sel.error}`);

  if (payloadUrl) {
    await resolveCmsFixture({
      id: 'FX-BLOGPOST-1',
      pageType: 'blog',
      urlFor: (slug) => `/${defaultLocale}/blog/${slug}`,
      payloadUrl,
      baseUrl,
      marketId,
      available,
      unavailable,
      notes
    });
    await resolveCmsFixture({
      id: 'FX-CMSPAGE-1',
      pageType: 'page',
      urlFor: (slug) => `/${defaultLocale}/${slug}`,
      payloadUrl,
      baseUrl,
      marketId,
      available,
      unavailable,
      notes
    });
  } else {
    unavailable('FX-BLOGPOST-1', 'PAYLOAD_API_URL nieustawiony');
    unavailable('FX-CMSPAGE-1', 'PAYLOAD_API_URL nieustawiony');
  }

  available('FX-VOUCHER-INVALID', 'BB-QD07-INVALID-CODE', 'staly kod celowo nieistniejacy');
  available('FX-NONE', null, 'komorka nie wymaga fixture');
  available('FX-NOTFOUND-SLUG', 'qd07-nonexistent-slug-zzz', 'staly slug celowo nieistniejacy');

  // Stany, ktorych ten harness NIE potrafi deterministycznie zaprovisionowac.
  // Sa nazwane wprost - to jest roznica miedzy "nie zmierzone" a "zielone".
  unavailable(
    'FX-CUSTOMER-AUTH',
    'Brak deterministycznego provisioningu zalogowanego klienta. e2e/helpers/seed-helper.ts jest ' +
      'read-only (sonduje backend, nie seeduje), a mennica JWT zyje w osobnym pakiecie GP/e2e/global-setup.ts.'
  );
  unavailable(
    'FX-ORDER-1',
    'Zamowienie wymaga domknietego zakupu multi-step (koszyk + shipping per-seller + Stripe). ' +
      'Nie da sie go wystawic bezpiecznie w tym harnessie.'
  );
  unavailable(
    'FX-VOUCHER-VALID',
    'Wazny publiczny voucher wymaga oplaconego zamowienia; invalid-token NIE zamyka rodziny (AC5).'
  );
  unavailable('FX-RECOVERY-TOKEN-VALID', 'Wazny magic-link wymaga wystawienia przez backend + odbioru maila.');
  unavailable('FX-CONSENT-TOKEN-VALID', 'Wazny token zgody wymaga sciezki checkoutu z realnym zamowieniem.');

  return fixtures;
}

// ── run playwright ───────────────────────────────────────────────────────────

function runPlaywright(env) {
  return new Promise((resolve) => {
    const child = spawn(
      'npx',
      ['playwright', 'test', 'i18n-semantic-matrix.spec.ts', '--project=chromium', '--reporter=list'],
      { cwd: STOREFRONT_ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let out = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d.toString();
      process.stderr.write(d);
    });
    child.on('close', (code) => resolve({ code, out }));
    child.on('error', (e) => resolve({ code: -1, out: `${out}\nSPAWN ERROR: ${e.message}` }));
  });
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const env = readEnvLocal();
  const baseUrl = `http://localhost:${args.port}`;
  const payloadUrl = env.PAYLOAD_API_URL ?? process.env.PAYLOAD_API_URL ?? null;

  const evidence = {
    tool: TOOL,
    tool_revision: TOOL_REVISION,
    spec: SPEC_ID,
    release: args.release,
    state: 'RUNNING',
    generated_at: new Date().toISOString(),
    market_id: args.market,
    base_url: baseUrl,
    backend_url: args.backendUrl,
    storefront_commit: gitSha(STOREFRONT_ROOT),
    build_id: null,
    locales: [],
    locales_source: null,
    contract_version: null,
    allowlist_version: null,
    freshness: null,
    fixtures: {},
    cells: [],
    coverage: null,
    findings: [],
    pass: false,
    exit_code: 3,
    exit_code_semantics: { 0: 'PASS', 1: 'FAIL', 2: 'NEEDS-LIVE-RUN', 3: 'TOOL-ERROR' }
  };
  writeEvidence(args.out, evidence);

  const finish = (code, extra = {}) => {
    Object.assign(evidence, extra);
    evidence.state = code === 3 ? 'ABORTED' : 'COMPLETE';
    evidence.pass = code === 0;
    evidence.exit_code = code;
    writeEvidence(args.out, evidence);
    process.stdout.write(`\n[${TOOL}] evidence -> ${args.out}\n[${TOOL}] exit ${code}\n`);
    process.exit(code);
  };

  try {
    const contract = JSON.parse(
      fs.readFileSync(path.join(STOREFRONT_ROOT, 'e2e/fixtures/i18n-semantic-matrix.json'), 'utf8')
    );
    evidence.contract_version = contract.contract_version;
    evidence.allowlist_version = contract.proper_noun_allowlist.version;

    // 1. stack zyje
    const root = await probe(baseUrl, { timeout: 30_000 });
    if (!root.ok) {
      throw new NeedsLiveRun(`Storefront ${baseUrl} nieosiagalny (${root.error}). Brak stacku to NIE jest PASS.`);
    }
    const be = await probe(`${args.backendUrl}/health`, { timeout: 15_000 });
    if (!be.ok || be.status !== 200) {
      throw new NeedsLiveRun(`Backend ${args.backendUrl}/health -> ${be.status ?? be.error}`);
    }
    const bid = path.join(STOREFRONT_ROOT, '.next/BUILD_ID');
    evidence.build_id = fs.existsSync(bid) ? fs.readFileSync(bid, 'utf8').trim() : null;
    if (!evidence.build_id) {
      throw new NeedsLiveRun('Brak .next/BUILD_ID - to nie jest prod build.');
    }

    // 2. swiezosc
    evidence.freshness = await assertFreshness(baseUrl, env, args.skipRevalidate);

    // 3. locale z runtime configu
    const loc = await resolveLocales(baseUrl, args.market, env);
    evidence.locales = loc.locales;
    evidence.locales_source = loc.source;
    evidence.default_locale = loc.default_locale;

    // 4. fixture
    const fixtureNotes = [];
    evidence.fixtures = await resolveFixtures(
      args.backendUrl,
      env,
      payloadUrl,
      args.market,
      baseUrl,
      evidence.default_locale,
      fixtureNotes
    );
    evidence.fixture_notes = fixtureNotes;

    writeEvidence(args.out, evidence);

    // 5. pomiar
    const planPath = path.join(STOREFRONT_ROOT, '.qd07', 'i18n-semantic-matrix-plan.json');
    fs.mkdirSync(path.dirname(planPath), { recursive: true });
    fs.writeFileSync(
      planPath,
      JSON.stringify(
        {
          base_url: baseUrl,
          locales: evidence.locales,
          default_locale: evidence.default_locale,
          fixtures: evidence.fixtures,
          contract
        },
        null,
        2
      ),
      'utf8'
    );
    if (fs.existsSync(args.cellsOut)) fs.rmSync(args.cellsOut);

    const pw = await runPlaywright({
      QD07_PLAN: planPath,
      QD07_CELLS_OUT: args.cellsOut,
      QD07_BASE_URL: baseUrl
    });

    if (!fs.existsSync(args.cellsOut)) {
      throw new NeedsLiveRun(
        `Spec Playwrighta nie wyprodukowal ${args.cellsOut} (exit ${pw.code}). ` +
          'Brak wynikow to brak pomiaru, nie zielen.'
      );
    }
    const cells = JSON.parse(fs.readFileSync(args.cellsOut, 'utf8'));
    evidence.cells = cells;

    // Denominator jest liczony z KONTRAKTU, nie z tego, co udalo sie wykonac.
    // Inaczej przebieg, ktory zgubil polowe komorek, raportowalby 100% pokrycia.
    const denominator = contract.cells.length * evidence.locales.length;
    evidence.coverage_denominator_expected = denominator;
    const ids = new Set(cells.map((c) => c.cell_id));
    if (ids.size !== cells.length) {
      throw new ToolError(`Zdublowane cell_id w wynikach (${cells.length} rekordow, ${ids.size} unikalnych)`);
    }
    if (cells.length !== denominator) {
      throw new NeedsLiveRun(
        `Zmierzono ${cells.length} komorek, kontrakt wymaga ${denominator} ` +
          `(${contract.cells.length} tras x ${evidence.locales.length} locale). Brakujacy pomiar to NIE jest PASS.`
      );
    }

    const expected = cells.length;
    const executed = cells.filter((c) => c.status === 'PASS' || c.status === 'FAIL').length;
    const passed = cells.filter((c) => c.status === 'PASS').length;
    const failed = cells.filter((c) => c.status === 'FAIL').length;
    const unexecuted = cells.filter((c) => c.status === 'UNEXECUTED').length;

    evidence.coverage = {
      denominator_definition: 'route x state x locale x fixture_id',
      expected,
      executed,
      pass: passed,
      fail: failed,
      unexecuted,
      families: [...new Set(cells.map((c) => c.family))].map((f) => {
        const fc = cells.filter((c) => c.family === f);
        return {
          family: f,
          expected: fc.length,
          pass: fc.filter((c) => c.status === 'PASS').length,
          fail: fc.filter((c) => c.status === 'FAIL').length,
          unexecuted: fc.filter((c) => c.status === 'UNEXECUTED').length,
          closed: fc.some((c) => c.closes_family && c.status === 'PASS')
        };
      })
    };

    evidence.findings = cells
      .filter((c) => c.status !== 'PASS')
      .map((c) => ({
        cell_id: c.cell_id,
        status: c.status,
        route: c.route,
        state: c.state,
        locale: c.locale,
        fixture_id: c.fixture_id,
        reason: c.reason ?? null,
        violations: c.violations ?? []
      }));

    if (expected === 0) throw new NeedsLiveRun('Pusty denominator - nie zmierzono zadnej komorki.');
    if (unexecuted > 0 || failed > 0) return finish(1);
    return finish(0);
  } catch (e) {
    if (e instanceof NeedsLiveRun) {
      evidence.findings.push({ status: 'NEEDS-LIVE-RUN', reason: e.message });
      return finish(2);
    }
    evidence.findings.push({ status: 'TOOL-ERROR', reason: String(e?.stack ?? e) });
    return finish(3);
  }
}

main();
