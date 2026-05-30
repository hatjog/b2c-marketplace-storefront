import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { describe } from 'node:test';

const { loadLegalSignoffStatusMap, _resetLegalSignoffLedgerCacheForTests } =
  await import('../src/lib/legalSignoffStatus.ts');

async function setupLedger(yaml) {
  const root = await mkdtemp(path.join(tmpdir(), 'legal-signoff-status-'));
  const dir = path.join(root, '_bmad-output', 'releases', 'v1.10.0', 'implementation-artifacts');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'legal-signoff-ledger.yaml'), yaml, 'utf-8');
  process.env.LEGAL_SIGNOFF_LEDGER_ROOT = root;
  _resetLegalSignoffLedgerCacheForTests();
  return root;
}

const SAMPLE = `
- doc_type: regulamin
  locale: pl-PL
  market: bonbeauty
  status: accepted-in-house
- doc_type: polityka_prywatnosci
  locale: pl-PL
  market: bonbeauty
  status: accepted-in-house
- doc_type: regulamin
  locale: pl-PL
  market: bongarden
  status: WAIVED-demo
- doc_type: regulamin
  locale: en-US
  market: bonbeauty
  status: accepted-in-house
`;

describe('loadLegalSignoffStatusMap', () => {
  test('returns accepted-in-house per docType for bonbeauty pl-PL', async () => {
    const root = await setupLedger(SAMPLE);
    try {
      const map = await loadLegalSignoffStatusMap('bonbeauty', 'pl');
      assert.equal(map.regulamin, 'accepted-in-house');
      assert.equal(map.polityka_prywatnosci, 'accepted-in-house');
      assert.equal(map.pomoc, undefined);
    } finally {
      delete process.env.LEGAL_SIGNOFF_LEDGER_ROOT;
      _resetLegalSignoffLedgerCacheForTests();
      await rm(root, { recursive: true, force: true });
    }
  });

  test('returns WAIVED-demo for demo market — caller must not surface badge', async () => {
    const root = await setupLedger(SAMPLE);
    try {
      const map = await loadLegalSignoffStatusMap('bongarden', 'pl');
      assert.equal(map.regulamin, 'WAIVED-demo');
    } finally {
      delete process.env.LEGAL_SIGNOFF_LEDGER_ROOT;
      _resetLegalSignoffLedgerCacheForTests();
      await rm(root, { recursive: true, force: true });
    }
  });

  test('returns empty map when ledger missing (fail-soft)', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'legal-signoff-empty-'));
    process.env.LEGAL_SIGNOFF_LEDGER_ROOT = root;
    _resetLegalSignoffLedgerCacheForTests();
    try {
      const map = await loadLegalSignoffStatusMap('bonbeauty', 'pl');
      assert.deepEqual(map, {});
    } finally {
      delete process.env.LEGAL_SIGNOFF_LEDGER_ROOT;
      _resetLegalSignoffLedgerCacheForTests();
      await rm(root, { recursive: true, force: true });
    }
  });

  test('unknown runtime locale → empty map', async () => {
    const root = await setupLedger(SAMPLE);
    try {
      const map = await loadLegalSignoffStatusMap('bonbeauty', 'fr');
      assert.deepEqual(map, {});
    } finally {
      delete process.env.LEGAL_SIGNOFF_LEDGER_ROOT;
      _resetLegalSignoffLedgerCacheForTests();
      await rm(root, { recursive: true, force: true });
    }
  });
});
