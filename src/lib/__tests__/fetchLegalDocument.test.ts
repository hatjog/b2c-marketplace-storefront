import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  LegalDocumentNotFoundError,
  fetchLegalDocument
} from '../legal/fetchLegalDocument';

const MASTER_PL = `---
doc_id: regulamin
canonical_slug: /regulamin
current_version: v0.3
review_status: published_draft_status
authoring_source: in_house
legal_review_ref: in_house_translated
last_updated: 2026-05-24
locale: pl
---

# Regulamin Sklepu — Test

## § 1
Tekst polski.
`;

const MASTER_EN = `---
doc_id: regulamin
canonical_slug: /regulamin
current_version: v0.3
review_status: published_draft_status
authoring_source: in_house
legal_review_ref: in_house_translated
last_updated: 2026-05-24
locale: en
---

# Terms — Test

## § 1
English text.
`;

describe('fetchLegalDocument', () => {
  let root: string;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'gp-legal-test-'));
    originalEnv = process.env.LEGAL_DOCS_ROOT;
    process.env.LEGAL_DOCS_ROOT = root;
  });

  afterEach(async () => {
    if (originalEnv === undefined) {
      delete process.env.LEGAL_DOCS_ROOT;
    } else {
      process.env.LEGAL_DOCS_ROOT = originalEnv;
    }
    await rm(root, { recursive: true, force: true });
  });

  async function writeDoc(market: string, doc: string, file: string, content: string) {
    const dir = path.join(root, 'gp-ops', 'markets', market, 'legal', 'portal', doc);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, file), content, 'utf-8');
  }

  it('returns the PL canonical document for locale=pl', async () => {
    await writeDoc('bonbeauty', 'regulamin', 'master.md', MASTER_PL);
    const doc = await fetchLegalDocument('bonbeauty', '/regulamin', 'pl');
    expect(doc.docId).toBe('regulamin');
    expect(doc.canonicalSlug).toBe('/regulamin');
    expect(doc.version).toBe('v0.3');
    expect(doc.reviewStatus).toBe('published_draft_status');
    expect(doc.locale).toBe('pl');
    expect(doc.localeFallback).toBe(false);
    expect(doc.body).toContain('# Regulamin Sklepu — Test');
  });

  it('returns the EN translation when present', async () => {
    await writeDoc('bonbeauty', 'regulamin', 'master.md', MASTER_PL);
    await writeDoc('bonbeauty', 'regulamin', 'master.en.md', MASTER_EN);
    const doc = await fetchLegalDocument('bonbeauty', '/regulamin', 'en');
    expect(doc.locale).toBe('en');
    expect(doc.localeFallback).toBe(false);
    expect(doc.body).toContain('English text.');
  });

  it('falls back to PL when EN is missing', async () => {
    await writeDoc('bonbeauty', 'regulamin', 'master.md', MASTER_PL);
    const doc = await fetchLegalDocument('bonbeauty', '/regulamin', 'en');
    expect(doc.locale).toBe('pl');
    expect(doc.localeFallback).toBe(true);
    expect(doc.body).toContain('Tekst polski.');
  });

  it('throws LegalDocumentNotFoundError when no file exists at all (fail-closed)', async () => {
    await expect(
      fetchLegalDocument('bonbeauty', '/regulamin', 'pl')
    ).rejects.toBeInstanceOf(LegalDocumentNotFoundError);
  });

  it('maps ua → master.uk.md per F-NEW-S3', async () => {
    await writeDoc(
      'bonbeauty',
      'regulamin',
      'master.uk.md',
      MASTER_PL.replace('locale: pl', 'locale: uk')
    );
    const doc = await fetchLegalDocument('bonbeauty', '/regulamin', 'ua');
    expect(doc.locale).toBe('ua');
    expect(doc.localeFallback).toBe(false);
  });

  it('rejects path-traversal in slug', async () => {
    await expect(
      fetchLegalDocument('bonbeauty', '/../etc/passwd', 'pl')
    ).rejects.toThrow(/path traversal/);
  });

  it('rejects path-traversal in marketId', async () => {
    await expect(
      fetchLegalDocument('../etc', '/regulamin', 'pl')
    ).rejects.toThrow(/path traversal/);
  });

  it('rejects document with missing front-matter', async () => {
    await writeDoc('bonbeauty', 'regulamin', 'master.md', '# No front matter');
    await expect(
      fetchLegalDocument('bonbeauty', '/regulamin', 'pl')
    ).rejects.toThrow(/front-matter/);
  });

  it('rejects document with incomplete front-matter', async () => {
    await writeDoc(
      'bonbeauty',
      'regulamin',
      'master.md',
      '---\ndoc_id: regulamin\n---\n\n# Body\n'
    );
    await expect(
      fetchLegalDocument('bonbeauty', '/regulamin', 'pl')
    ).rejects.toThrow(/required key/);
  });
});
