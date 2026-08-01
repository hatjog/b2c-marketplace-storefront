/**
 * QD-I18N-07 — semantyczna macierz i18n na prod buildzie.
 *
 * Ten spec celowo NIE uzywa `test.skip()`. Zastany `i18n-locale-coverage.spec.ts`
 * skipuje sie, gdy stack nie odpowiada — przez co martwy stack jest w raporcie
 * nieodrozninalny od zieleni. Tutaj kazda komorka konczy sie jawnym statusem
 * PASS / FAIL / UNEXECUTED, a UNEXECUTED blokuje PASS calosci.
 *
 * Jednostka pokrycia: route x state x locale x fixture_id.
 * Kazda wykonana komorka MUSI wykonac co najmniej jedna asercje pozytywna
 * (oczekiwana wartosc locale obecna) i jedna negatywna (bazowy PL nieobecny).
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

type Fixture = { id: string; available: boolean; value: string | null; reason?: string; source?: string };

type ContractCell = {
  family: string;
  route: string;
  state: string;
  fixture_id: string;
  probe_keys: string[];
  expect_redirect_keeps_locale?: boolean;
  redirect_only?: boolean;
  closes_family?: boolean;
  expect_http?: number;
};

type Plan = {
  base_url: string;
  locales: string[];
  default_locale: string;
  fixtures: Record<string, Fixture>;
  contract: {
    contract_version: number;
    proper_noun_allowlist: { version: number; terms: string[] };
    cells: ContractCell[];
  };
};

type Violation = {
  kind:
    | 'MISSING_LOCALIZED_VALUE'
    | 'BASELINE_PL_LEAK'
    | 'CROSS_LOCALE_LEAK'
    | 'HTTP_UNEXPECTED'
    | 'HTTP_SERVER_ERROR'
    | 'ERROR_BOUNDARY_RENDERED'
    | 'LOCALE_LOST_ON_REDIRECT';
  probe_key?: string;
  selector: string;
  expected?: string;
  actual_excerpt?: string;
};

type CellResult = {
  cell_id: string;
  family: string;
  route: string;
  route_template: string;
  state: string;
  locale: string;
  fixture_id: string;
  status: 'PASS' | 'FAIL' | 'UNEXECUTED';
  positive_assertions: number;
  negative_assertions: number;
  http_status: number | null;
  closes_family: boolean;
  reason?: string;
  violations: Violation[];
};

const PLAN_PATH = process.env.QD07_PLAN;
const CELLS_OUT = process.env.QD07_CELLS_OUT;

if (!PLAN_PATH || !CELLS_OUT) {
  throw new Error(
    'QD07_PLAN i QD07_CELLS_OUT musza byc ustawione. Ten spec uruchamia sie WYLACZNIE przez ' +
      'scripts/i18n-semantic-matrix.mjs, ktory wykonuje preflight (swiezosc ISR, fixture, locale).'
  );
}

const plan: Plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const MESSAGES_DIR = path.resolve(__dirname, '..', 'messages');

function loadMessages(locale: string): Record<string, unknown> {
  const p = path.join(MESSAGES_DIR, `${locale}.json`);
  if (!fs.existsSync(p)) throw new Error(`Brak ${p} dla locale z market config: ${locale}`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const messages: Record<string, Record<string, unknown>> = {};
for (const l of plan.locales) messages[l] = loadMessages(l);

function messageAt(locale: string, key: string): string | null {
  const v = key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
    return undefined;
  }, messages[locale]);
  return typeof v === 'string' ? v : null;
}

/** Interpolowane placeholdery ({locale}, {name}) uniemozliwiaja dokladne porownanie. */
function isComparable(value: string | null): value is string {
  return typeof value === 'string' && value.length >= 3 && !value.includes('{');
}

const ALLOWLIST = plan.contract.proper_noun_allowlist.terms;

function resolveRoute(template: string, locale: string, fixtures: Record<string, Fixture>): string | null {
  let out = template.replace('{locale}', locale);
  const tokens = out.match(/\{([a-z_]+)\}/g) ?? [];
  const map: Record<string, string> = {
    '{product}': 'FX-PRODUCT-1',
    '{category}': 'FX-CATEGORY-1',
    '{seller}': 'FX-SELLER-1',
    '{blogpost}': 'FX-BLOGPOST-1',
    '{cmspage}': 'FX-CMSPAGE-1',
    '{invalid_voucher}': 'FX-VOUCHER-INVALID',
    '{valid_voucher}': 'FX-VOUCHER-VALID',
    '{valid_recovery_token}': 'FX-RECOVERY-TOKEN-VALID',
    '{valid_consent_token}': 'FX-CONSENT-TOKEN-VALID',
    '{order}': 'FX-ORDER-1',
    '{notfound_slug}': 'FX-NOTFOUND-SLUG'
  };
  for (const tok of tokens) {
    const fid = map[tok];
    const f = fid ? fixtures[fid] : undefined;
    if (!f || !f.available || !f.value) return null;
    out = out.replace(tok, f.value);
  }
  return out;
}

const results: CellResult[] = [];

test.describe('QD-I18N-07 @i18n-semantic-matrix — route x state x locale x fixture_id', () => {
  for (const cell of plan.contract.cells) {
    for (const locale of plan.locales) {
      const fixture = plan.fixtures[cell.fixture_id];
      const cellId = `${cell.family}|${cell.route}|${cell.state}|${locale}|${cell.fixture_id}`;

      test(`${cell.state} ${locale} ${cell.route}`, async ({ page }) => {
        const base: CellResult = {
          cell_id: cellId,
          family: cell.family,
          route: cell.route.replace('{locale}', locale),
          route_template: cell.route,
          state: cell.state,
          locale,
          fixture_id: cell.fixture_id,
          status: 'UNEXECUTED',
          positive_assertions: 0,
          negative_assertions: 0,
          http_status: null,
          closes_family: cell.closes_family === true,
          violations: []
        };

        // Brak fixture'a => komorka NIEWYKONANA. Nigdy PASS, nigdy skip.
        if (!fixture || !fixture.available) {
          base.reason = `Fixture ${cell.fixture_id} niedostepny: ${fixture?.reason ?? 'nie rozstrzygniety'}`;
          results.push(base);
          return;
        }
        const resolved = resolveRoute(cell.route, locale, plan.fixtures);
        if (resolved === null) {
          base.reason = 'Nie da sie rozwiazac trasy - brakuje wartosci fixture.';
          results.push(base);
          return;
        }
        base.route = resolved;

        let response;
        try {
          response = await page.goto(`${plan.base_url}${resolved}`, {
            waitUntil: 'domcontentloaded',
            timeout: 45_000
          });
        } catch (e) {
          // Timeout to FAIL, nie skip i nie retry-do-zieleni.
          base.status = 'FAIL';
          base.reason = `Nawigacja nieudana/timeout: ${String((e as Error).message).slice(0, 200)}`;
          results.push(base);
          return;
        }
        base.http_status = response?.status() ?? null;

        // Blad 5xx jest klasyfikowany OSOBNO. Gdyby wpadl do worka
        // MISSING_LOCALIZED_VALUE, strona bledu 500 wygladalaby w raporcie
        // identycznie jak brakujace tlumaczenie - i przejsciowy flake backendu
        // zostalby zaraportowany jako defekt i18n.
        if (base.http_status !== null && base.http_status >= 500) {
          base.violations.push({
            kind: 'HTTP_SERVER_ERROR',
            selector: ':root',
            expected: 'HTTP < 500',
            actual_excerpt: `HTTP ${base.http_status} — komorka NIE niesie sygnalu i18n`
          });
          base.status = 'FAIL';
          base.reason = `HTTP ${base.http_status} — awaria serwera, nie defekt tlumaczen.`;
          results.push(base);
          return;
        }

        if (cell.expect_http !== undefined && base.http_status !== cell.expect_http) {
          base.violations.push({
            kind: 'HTTP_UNEXPECTED',
            selector: ':root',
            expected: `HTTP ${cell.expect_http}`,
            actual_excerpt: `HTTP ${base.http_status}`
          });
        }

        // Redirect musi zachowac locale (np. /de/user -> /de/login).
        if (cell.expect_redirect_keeps_locale) {
          const finalUrl = new URL(page.url());
          const seg = finalUrl.pathname.split('/')[1];
          base.negative_assertions += 1;
          if (seg !== locale) {
            base.violations.push({
              kind: 'LOCALE_LOST_ON_REDIRECT',
              selector: 'location.pathname',
              expected: `/${locale}/...`,
              actual_excerpt: finalUrl.pathname
            });
          }
          if (cell.redirect_only) {
            base.positive_assertions += 1;
            base.status = base.violations.length === 0 ? 'PASS' : 'FAIL';
            results.push(base);
            return;
          }
        }

        // Widoczny tekst: bez <script>/<style> i bez markerow sr-only,
        // ktore sa celowymi sondami smoke, a nie kopia produktowa.
        const visible = await page.evaluate(() => {
          const clone = document.body.cloneNode(true) as HTMLElement;
          clone
            .querySelectorAll('script,style,noscript,[data-legal-fail-closed-render],[aria-hidden="true"]')
            .forEach((n) => n.remove());
          return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
        });

        // HTTP 200 NIE oznacza zielonej komorki. Next potrafi oddac status 200 i
        // wyrenderowac kliencki error boundary ("500 · Cos poszlo nie tak").
        // Taka strona nie niesie ZADNEGO sygnalu o kompletnosci tlumaczen -
        // gdyby wpadla do MISSING_LOCALIZED_VALUE, przejsciowa awaria danych
        // zostalaby zaraportowana jako defekt i18n.
        //
        // Wykrywanie idzie po TRESCI, nie po testidzie: boundary bywa renderowany
        // przez rozne pliki error.tsx z roznymi testidami, a wspolny jest komunikat.
        const boundaryMarkers = [
          ...new Set(
            plan.locales
              .map((l) => messageAt(l, 'wave5_errors.runtime.server-error.eyebrow'))
              .filter((v): v is string => typeof v === 'string' && v.length > 0)
          )
        ];
        const hitMarker = boundaryMarkers.find((mk) => visible.includes(mk));
        const hasBoundaryTestId =
          (await page
            .locator('[data-testid="runtime-error-boundary"],[data-testid="categories-error-state"]')
            .count()) > 0;
        if (hitMarker !== undefined || hasBoundaryTestId) {
          base.violations.push({
            kind: 'ERROR_BOUNDARY_RENDERED',
            selector: hitMarker !== undefined ? 'wave5_errors.runtime.server-error.eyebrow' : '[data-testid=error-boundary]',
            expected: 'strona tresci',
            actual_excerpt: `HTTP ${base.http_status} + error boundary — komorka NIE niesie sygnalu i18n`
          });
          base.status = 'FAIL';
          base.reason =
            `Wyrenderowany error boundary przy HTTP ${base.http_status} (soft-500). ` +
            'Awaria renderu/danych, nie defekt tlumaczen.';
          results.push(base);
          return;
        }

        for (const key of cell.probe_keys) {
          const expected = messageAt(locale, key);
          const baseline = messageAt(plan.default_locale, key);

          if (isComparable(expected)) {
            base.positive_assertions += 1;
            if (!visible.includes(expected)) {
              base.violations.push({
                kind: 'MISSING_LOCALIZED_VALUE',
                probe_key: key,
                selector: 'body[visible-text]',
                expected,
                actual_excerpt: visible.slice(0, 240)
              });
            }
          }

          // Asercja negatywna jest uogolniona na KAZDE inne locale, nie tylko na
          // bazowe PL. Na locale domyslnym "brak PL" bylby warunkiem pustym z
          // definicji — komorki /pl mialyby zero asercji negatywnych i nie
          // spelnialyby AC1. Tak sformulowany warunek jest nietrywialny dla
          // wszystkich locale i lapie wyciek cache'u w OBIE strony.
          for (const other of plan.locales) {
            if (other === locale) continue;
            const otherValue = messageAt(other, key);
            if (!isComparable(otherValue)) continue;
            if (otherValue === expected) continue;
            if (ALLOWLIST.includes(otherValue)) continue;

            base.negative_assertions += 1;
            if (visible.includes(otherValue)) {
              const at = visible.indexOf(otherValue);
              base.violations.push({
                kind: other === plan.default_locale ? 'BASELINE_PL_LEAK' : 'CROSS_LOCALE_LEAK',
                probe_key: key,
                selector: 'body[visible-text]',
                expected: `brak "${otherValue}" (${other}) na /${locale}`,
                actual_excerpt: visible.slice(Math.max(0, at - 60), at + otherValue.length + 60)
              });
            }
          }
        }

        // Komorka bez OBU rodzajow asercji nie jest dowodem (AC1) - niezaleznie
        // od locale. Zielona komorka, ktora niczego nie sprawdzila, jest gorsza
        // niz brak komorki, bo powieksza mianownik pokrycia.
        if (base.positive_assertions === 0 || base.negative_assertions === 0) {
          base.status = 'UNEXECUTED';
          base.reason =
            `Brak kompletu asercji (pozytywne=${base.positive_assertions}, ` +
            `negatywne=${base.negative_assertions}) - komorka nie jest dowodem wg AC1.`;
          results.push(base);
          return;
        }

        base.status = base.violations.length === 0 ? 'PASS' : 'FAIL';
        results.push(base);
        expect(
          base.violations,
          `${cellId}\n${JSON.stringify(base.violations, null, 2)}`
        ).toEqual([]);
      });
    }
  }

  test.afterAll(() => {
    // Playwright uruchamia retry w NOWYM workerze, wiec zwykly zapis nadpisalby
    // caly plik wynikiem jednej ponowionej komorki. Scalamy z tym, co juz jest.
    //
    // Wiazacy jest PIERWSZY pomiar komorki. Retry moze zebrac trace, ale nie
    // moze podniesc FAIL/UNEXECUTED do PASS - inaczej flake kupowalby zielen.
    fs.mkdirSync(path.dirname(CELLS_OUT!), { recursive: true });
    let merged: CellResult[] = [];
    if (fs.existsSync(CELLS_OUT!)) {
      try {
        merged = JSON.parse(fs.readFileSync(CELLS_OUT!, 'utf8')) as CellResult[];
      } catch {
        merged = [];
      }
    }
    const seen = new Set(merged.map((c) => c.cell_id));
    for (const r of results) {
      if (!seen.has(r.cell_id)) {
        merged.push(r);
        seen.add(r.cell_id);
      }
    }
    fs.writeFileSync(CELLS_OUT!, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  });
});
