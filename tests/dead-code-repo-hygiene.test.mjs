import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const exists = relativePath => fs.existsSync(path.join(root, relativePath));
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('dead-code repo hygiene', () => {
  test('removed legacy Footer component and stale payment-status dev record stay absent', () => {
    assert.equal(exists('src/components/organisms/Footer/Footer.tsx'), false);
    assert.equal(
      exists('src/app/[locale]/(main)/order/[id]/payment-status/DEV-AGENT-RECORD.md'),
      false
    );
  });

  test('server organism barrel does not re-export removed Footer', () => {
    const barrel = read('src/components/organisms/index.server.ts');
    assert.doesNotMatch(barrel, /Footer\/Footer/);
  });

  test('VendorMoRWizard placeholder scaffold is not present in live source or tests', () => {
    assert.equal(exists('src/components/molecules/VendorMoRWizard'), false);
    assert.equal(exists('src/components/molecules/__tests__/VendorMoRWizard.test.tsx'), false);

    const stateMachine = read('src/lib/state-machine/create-persisted-state-machine.ts');
    assert.doesNotMatch(stateMachine, /VendorMoRWizard/);
  });
});
