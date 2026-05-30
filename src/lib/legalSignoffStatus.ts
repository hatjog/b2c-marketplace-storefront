// Story 9.2 review-fix H1 (2026-05-28):
// Server-side reader dla `_bmad-output/releases/v1.10.0/implementation-artifacts/legal-signoff-ledger.yaml`.
// Footer/SiteFooter wywołują `loadLegalSignoffStatusMap(marketId, locale)` w server component i
// przekazują wynik do `resolveFooterNavLinks` — badge pokazywany TYLKO dla entries, których ledger
// rzeczywiście stwierdza `status: accepted-in-house` per (market, locale, doc_type).

import fs from 'node:fs/promises';
import path from 'node:path';

import yaml from 'js-yaml';

export type LegalSignoffDocType = 'regulamin' | 'polityka_prywatnosci' | 'zasady_voucher' | 'pomoc';

export type LegalSignoffStatus =
  | 'DRAFT'
  | 'accepted-in-house'
  | 'published'
  | 'WAIVED-demo'
  | 'WAIVED-interim';

export type LegalSignoffLocale = 'pl-PL' | 'en-US' | 'uk-UA' | 'de-DE';

export type LegalSignoffStatusMap = Partial<Record<LegalSignoffDocType, LegalSignoffStatus>>;

type LedgerEntry = {
  doc_type?: unknown;
  locale?: unknown;
  market?: unknown;
  status?: unknown;
};

const LEDGER_RELATIVE_PATH =
  '_bmad-output/releases/v1.10.0/implementation-artifacts/legal-signoff-ledger.yaml';

const DOC_TYPES: ReadonlySet<LegalSignoffDocType> = new Set([
  'regulamin',
  'polityka_prywatnosci',
  'zasady_voucher',
  'pomoc'
]);

const STATUSES: ReadonlySet<LegalSignoffStatus> = new Set([
  'DRAFT',
  'accepted-in-house',
  'published',
  'WAIVED-demo',
  'WAIVED-interim'
]);

// Storefront-runtime locale (pl/en/ua/de) → ledger locale (BCP-47-ish).
const RUNTIME_TO_LEDGER_LOCALE: Record<string, LegalSignoffLocale> = {
  pl: 'pl-PL',
  en: 'en-US',
  ua: 'uk-UA',
  de: 'de-DE'
};

function ledgerCandidateRoots(): string[] {
  const env = process.env.LEGAL_SIGNOFF_LEDGER_ROOT;
  if (env && env.trim()) {
    return [path.resolve(env)];
  }
  const cwd = process.cwd();
  return Array.from(
    new Set([path.resolve(cwd, '..', '..'), path.resolve(cwd, '..', '..', '..'), path.resolve(cwd)])
  );
}

let cached: { mtimeMs: number; entries: LedgerEntry[]; sourcePath: string } | null = null;

async function readLedger(): Promise<{ entries: LedgerEntry[]; sourcePath: string } | null> {
  for (const root of ledgerCandidateRoots()) {
    const candidate = path.join(root, LEDGER_RELATIVE_PATH);
    let stat;
    try {
      stat = await fs.stat(candidate);
    } catch {
      continue;
    }
    if (cached && cached.sourcePath === candidate && cached.mtimeMs === stat.mtimeMs) {
      return { entries: cached.entries, sourcePath: cached.sourcePath };
    }
    const content = await fs.readFile(candidate, 'utf-8');
    const parsed = yaml.load(content);
    if (!Array.isArray(parsed)) {
      return null;
    }
    cached = { mtimeMs: stat.mtimeMs, entries: parsed as LedgerEntry[], sourcePath: candidate };
    return { entries: cached.entries, sourcePath: candidate };
  }
  return null;
}

export function runtimeLocaleToLedgerLocale(locale: string): LegalSignoffLocale | null {
  return RUNTIME_TO_LEDGER_LOCALE[locale] ?? null;
}

/**
 * Returns a per-docType status map for (marketId, runtime locale) from the
 * sign-off ledger. Returns `{}` when ledger missing or no entries match — caller
 * must treat `undefined` per docType as "no in-house sign-off; do not show badge".
 *
 * Fail-soft on read errors: storefront footer must never crash on missing ledger;
 * fallback = empty map (badge hidden). Throws only on YAML parse error so that
 * tests + CI catch malformed ledger.
 */
export async function loadLegalSignoffStatusMap(
  marketId: string,
  runtimeLocale: string
): Promise<LegalSignoffStatusMap> {
  if (!/^[a-z][a-z0-9_-]*$/.test(marketId)) {
    return {};
  }
  const ledgerLocale = runtimeLocaleToLedgerLocale(runtimeLocale);
  if (!ledgerLocale) {
    return {};
  }
  const ledger = await readLedger();
  if (!ledger) {
    return {};
  }
  const map: LegalSignoffStatusMap = {};
  for (const entry of ledger.entries) {
    if (entry.market !== marketId || entry.locale !== ledgerLocale) {
      continue;
    }
    const docType = entry.doc_type;
    const status = entry.status;
    if (
      typeof docType !== 'string' ||
      !DOC_TYPES.has(docType as LegalSignoffDocType) ||
      typeof status !== 'string' ||
      !STATUSES.has(status as LegalSignoffStatus)
    ) {
      continue;
    }
    map[docType as LegalSignoffDocType] = status as LegalSignoffStatus;
  }
  return map;
}

/** Test-only helper to drop the ledger cache between unit tests. */
export function _resetLegalSignoffLedgerCacheForTests() {
  cached = null;
}
