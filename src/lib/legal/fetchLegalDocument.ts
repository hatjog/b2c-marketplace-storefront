// @legal-signal-scope: v180
/**
 * Story v190-wf3-legal-docs-recovery: fetchLegalDocument.
 *
 * Resolves a legal document body + metadata for a (marketId, canonicalSlug,
 * locale) tuple. This is the storefront half of the Epic 7 legal-docs
 * publication chain (F-NEW-A4 / FR4.7 / Story 7-4 LegalDocLayout T3).
 *
 * Resolution order (per F-NEW-A4 fail-closed gate — no silent filesystem
 * fallback if requested document is structurally absent):
 *
 *   1. Read gp-ops/markets/<marketId>/legal/portal/<doc_id>/master[.locale].md
 *      where <doc_id> is derived from canonicalSlug (e.g. "/regulamin" → "regulamin"),
 *      and <locale> uses the F-NEW-S3 storefront-runtime convention
 *      `master.md` (default pl), `master.en.md`, `master.uk.md` (NOT .ua),
 *      `master.de.md`.
 *   2. If a locale-specific file is missing, fall back to `master.md` (PL
 *      canonical) and tag the result with `locale_fallback: true`.
 *   3. If even the canonical file is missing → throw LegalDocumentNotFoundError
 *      (fail-closed — the calling page must render an explicit error / 404
 *      branch, NOT a silent placeholder).
 *
 * Trust signals (per Story 7.9 AC9 / validate_legal_signals_trust_invariants.py):
 *
 *   - Signal 1: lastUpdated (front-matter `last_updated`)
 *   - Signal 2: version (front-matter `current_version`, semver vN.M)
 *   - Signal 3: reviewStatus (front-matter `review_status` — when set to
 *     `published_draft_status`, the page must render a draft watermark)
 *   - Signal 4: fail-closed (this function throws on missing doc — render
 *     surface MUST surface that as an explicit error branch)
 *   - Signal 5: authoringSource + legalReviewRef (front-matter
 *     `authoring_source` + `legal_review_ref` — provenance)
 *
 * No network. Stdlib-only (fs/promises + js-yaml).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import yaml from 'js-yaml';
import { cache } from 'react';

export type LegalDocumentLocale = 'pl' | 'en' | 'ua' | 'de';
export type LegalReviewStatus =
  | 'draft'
  | 'in_house_review'
  | 'published_draft_status'
  | 'legal_review'
  | 'approved'
  | 'published';
export type LegalAuthoringSource = 'in_house' | 'external_counsel';
export type LegalReviewRef =
  | 'in_house_draft'
  | 'in_house_translated'
  | null
  | string; // `kancelaria_review_*` for external_counsel

export interface LegalDocumentFrontMatter {
  doc_id: string;
  canonical_slug: string;
  current_version: string;
  review_status: LegalReviewStatus;
  authoring_source: LegalAuthoringSource;
  legal_review_ref: LegalReviewRef;
  last_updated: string; // ISO date
  locale: LegalDocumentLocale;
}

export interface LegalDocument {
  /** Document id (derived from canonical_slug) */
  docId: string;
  /** Canonical slug (e.g. "/regulamin") */
  canonicalSlug: string;
  /** Semver-shaped version (e.g. "v0.3") */
  version: string;
  /** ISO date when the master content was last updated */
  lastUpdated: string;
  /** Lifecycle state — `published_draft_status` triggers UI draft watermark */
  reviewStatus: LegalReviewStatus;
  /** in_house | external_counsel — Signal 5 provenance */
  authoringSource: LegalAuthoringSource;
  /** in_house_translated | in_house_draft | kancelaria_review_* | null */
  legalReviewRef: LegalReviewRef;
  /** Effective locale (may differ from requested when fallback fired) */
  locale: LegalDocumentLocale;
  /** True when the requested locale was missing and we fell back to PL */
  localeFallback: boolean;
  /** Markdown body (without the YAML front-matter block) */
  body: string;
  /** Resolved absolute path read */
  sourcePath: string;
}

export class LegalDocumentNotFoundError extends Error {
  readonly marketId: string;
  readonly canonicalSlug: string;
  readonly locale: LegalDocumentLocale;
  readonly searchedPaths: string[];

  constructor(
    marketId: string,
    canonicalSlug: string,
    locale: LegalDocumentLocale,
    searchedPaths: string[]
  ) {
    super(
      `Legal document not found (fail-closed): market="${marketId}", slug="${canonicalSlug}", locale="${locale}". Searched: ${searchedPaths.join(', ')}`
    );
    this.name = 'LegalDocumentNotFoundError';
    this.marketId = marketId;
    this.canonicalSlug = canonicalSlug;
    this.locale = locale;
    this.searchedPaths = searchedPaths;
  }
}

/**
 * Map storefront-runtime locale code to legal-file suffix per F-NEW-S3.
 *
 *   pl → master.md (no suffix)
 *   en → master.en.md
 *   ua → master.uk.md   (storefront locale "ua" maps to ISO "uk" in legal source)
 *   de → master.de.md
 */
function legalFileForLocale(locale: LegalDocumentLocale): string {
  switch (locale) {
    case 'pl':
      return 'master.md';
    case 'en':
      return 'master.en.md';
    case 'ua':
      return 'master.uk.md';
    case 'de':
      return 'master.de.md';
  }
}

/**
 * Derive doc_id from canonical slug. "/regulamin" → "regulamin".
 *
 * Rejects path-traversal attempts (any non `[a-z0-9-]` after the leading slash).
 */
function docIdFromSlug(canonicalSlug: string): string {
  if (!canonicalSlug.startsWith('/')) {
    throw new Error(`Invalid canonical_slug (must start with /): ${canonicalSlug}`);
  }
  const tail = canonicalSlug.slice(1);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(tail)) {
    throw new Error(`Invalid canonical_slug shape (path traversal guard): ${canonicalSlug}`);
  }
  return tail;
}

/**
 * Candidate roots where `gp-ops/markets/<market>/legal/portal/<doc>/master*.md`
 * can be found. Order matters: dev runs from `apps/web` or `GP/storefront`
 * shell out to repo root via `..` walk; tests + prod-bundled snapshots
 * can override via `LEGAL_DOCS_ROOT` env.
 *
 * When `LEGAL_DOCS_ROOT` is set, it is the ONLY root (no cwd fallbacks). This
 * makes test isolation deterministic — a test pointing at a temp dir will not
 * accidentally read live legal markdown from the repo tree.
 */
function candidateRoots(): string[] {
  const env = process.env.LEGAL_DOCS_ROOT;
  if (env && env.trim()) {
    return [path.resolve(env)];
  }
  const cwd = process.cwd();
  // GP/storefront → repo root is ../..
  // monorepo apps/web etc — common ancestors
  return Array.from(
    new Set([
      path.resolve(cwd, '..', '..'),
      path.resolve(cwd, '..', '..', '..'),
      path.resolve(cwd)
    ])
  );
}

function legalPathsFor(marketId: string, docId: string, locale: LegalDocumentLocale): string[] {
  const file = legalFileForLocale(locale);
  return candidateRoots().map(root =>
    path.join(root, 'gp-ops', 'markets', marketId, 'legal', 'portal', docId, file)
  );
}

interface ParsedMarkdown {
  frontMatter: LegalDocumentFrontMatter;
  body: string;
}

function parseFrontMatter(content: string, sourcePath: string): ParsedMarkdown {
  if (!content.startsWith('---\n')) {
    throw new Error(`Legal document missing YAML front-matter (--- header) at ${sourcePath}`);
  }
  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    throw new Error(`Legal document front-matter not terminated at ${sourcePath}`);
  }
  const yamlBlock = content.slice(4, endIdx);
  const body = content.slice(endIdx + 5); // length of '\n---\n'
  let parsed: unknown;
  try {
    parsed = yaml.load(yamlBlock);
  } catch (err) {
    throw new Error(`Legal document YAML parse error at ${sourcePath}: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Legal document front-matter must be a YAML mapping at ${sourcePath}`);
  }
  // Validate required keys present
  const required = [
    'doc_id',
    'canonical_slug',
    'current_version',
    'review_status',
    'authoring_source',
    'last_updated',
    'locale'
  ];
  const fm = parsed as Record<string, unknown>;
  for (const key of required) {
    if (fm[key] === undefined || fm[key] === null) {
      throw new Error(`Legal document front-matter missing required key "${key}" at ${sourcePath}`);
    }
  }
  return {
    frontMatter: parsed as unknown as LegalDocumentFrontMatter,
    body
  };
}

async function readFirstExisting(
  paths: string[]
): Promise<{ content: string; sourcePath: string } | null> {
  for (const p of paths) {
    try {
      const content = await fs.readFile(p, 'utf-8');
      return { content, sourcePath: p };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw err;
    }
  }
  return null;
}

async function _fetchLegalDocumentImpl(
  marketId: string,
  canonicalSlug: string,
  locale: LegalDocumentLocale
): Promise<LegalDocument> {
  if (!/^[a-z][a-z0-9_-]*$/.test(marketId)) {
    throw new Error(`Invalid marketId (path traversal guard): ${marketId}`);
  }
  const docId = docIdFromSlug(canonicalSlug);

  // Try requested locale first; fall back to PL canonical (`master.md`).
  const localePaths = legalPathsFor(marketId, docId, locale);
  let read = await readFirstExisting(localePaths);
  let localeFallback = false;

  let fallbackPaths: string[] = [];
  if (!read && locale !== 'pl') {
    fallbackPaths = legalPathsFor(marketId, docId, 'pl');
    read = await readFirstExisting(fallbackPaths);
    localeFallback = read !== null;
  }

  if (!read) {
    throw new LegalDocumentNotFoundError(marketId, canonicalSlug, locale, [
      ...localePaths,
      ...fallbackPaths
    ]);
  }

  const { frontMatter, body } = parseFrontMatter(read.content, read.sourcePath);

  return {
    docId: frontMatter.doc_id,
    canonicalSlug: frontMatter.canonical_slug,
    version: frontMatter.current_version,
    lastUpdated: frontMatter.last_updated,
    reviewStatus: frontMatter.review_status,
    authoringSource: frontMatter.authoring_source,
    legalReviewRef: frontMatter.legal_review_ref,
    locale: localeFallback ? 'pl' : locale,
    localeFallback,
    body,
    sourcePath: read.sourcePath
  };
}

/**
 * Fetch a published legal document. Cached per (marketId, slug, locale) tuple
 * for the duration of a single render pass via React `cache`.
 *
 * @throws LegalDocumentNotFoundError when neither the requested locale nor the
 *   PL canonical fallback exists on disk (fail-closed per F-NEW-A4 — render
 *   surface MUST surface this as an explicit error / 404 branch, NOT a silent
 *   placeholder).
 */
export const fetchLegalDocument = cache(
  async (
    marketId: string,
    canonicalSlug: string,
    locale: LegalDocumentLocale
  ): Promise<LegalDocument> => _fetchLegalDocumentImpl(marketId, canonicalSlug, locale)
);
