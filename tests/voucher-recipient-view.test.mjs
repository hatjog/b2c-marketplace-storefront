import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('W2-14 baseline index defines 12 desktop recipient entries across 4 locales and 3 states', () => {
  const index = YAML.parse(read('../e2e/visual-baselines/baseline-index.yaml'));
  const entries = index.entries.filter(
    (entry) =>
      entry.surface_key === 'w2-14-voucher-recipient-view' &&
      entry.breakpoint === 'desktop-1280' &&
      /E2E-RECIPIENT-(ACTIVE|EXPIRED|REDEEMED)-001/.test(entry.test_path)
  );

  assert.equal(entries.length, 12);

  const locales = new Set(entries.map((entry) => entry.locale));
  assert.deepEqual([...locales].sort(), ['de', 'en', 'pl', 'ua']);

  const states = new Set(
    entries.map((entry) => {
      if (entry.test_path.includes('ACTIVE')) return 'active';
      if (entry.test_path.includes('EXPIRED')) return 'expired';
      if (entry.test_path.includes('REDEEMED')) return 'already_redeemed';
      return 'unknown';
    })
  );
  assert.deepEqual([...states].sort(), ['active', 'already_redeemed', 'expired']);
});

test('W2-14 storefront visual smoke spec covers active and desktop state matrix', () => {
  const source = read('tests/visual-regression/w2-14-voucher-recipient.spec.ts');

  assert.match(source, /E2E-RECIPIENT-ACTIVE-001/);
  assert.match(source, /E2E-RECIPIENT-EXPIRED-001/);
  assert.match(source, /E2E-RECIPIENT-REDEEMED-001/);
  assert.match(source, /for \(const locale of LOCALES\)/);
  assert.match(source, /for \(const bp of BREAKPOINTS\)/);
  assert.match(source, /DESKTOP_STATES/);
});
