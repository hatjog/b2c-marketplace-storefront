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
  kind: 'MISSING_LOCALIZED_VALUE' | 'BASELINE_PL_LEAK' | 'HTTP_UNEXPECTED' | 'LOCALE_LOST_ON_REDIRECT';
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

          if (
            locale !== plan.default_locale &&
            isComparable(baseline) &&
            baseline !== expected &&
            !ALLOWLIST.includes(baseline)
          ) {
            base.negative_assertions += 1;
            if (visible.includes(baseline)) {
              const at = visible.indexOf(baseline);
              base.violations.push({
                kind: 'BASELINE_PL_LEAK',
                probe_key: key,
                selector: 'body[visible-text]',
                expected: `brak "${baseline}" (${plan.default_locale}) na /${locale}`,
                actual_excerpt: visible.slice(Math.max(0, at - 60), at + baseline.length + 60)
              });
            }
          }
        }

        // Komorka bez obu rodzajow asercji nie jest dowodem (AC1).
        if (base.positive_assertions === 0 || base.negative_assertions === 0) {
          if (locale === plan.default_locale) {
            base.status = base.violations.length === 0 ? 'PASS' : 'FAIL';
          } else {
            base.status = 'UNEXECUTED';
            base.reason =
              `Brak kompletu asercji (pozytywne=${base.positive_assertions}, ` +
              `negatywne=${base.negative_assertions}) - komorka nie jest dowodem wg AC1.`;
          }
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
    fs.mkdirSync(path.dirname(CELLS_OUT!), { recursive: true });
    fs.writeFileSync(CELLS_OUT!, `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  });
});
