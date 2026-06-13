import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const AUTH_SURFACES = ['W3-01', 'W3-02', 'W3-03', 'W3-04', 'W3-05', 'W3-06', 'W3-07'];
const ACCOUNT_SURFACES = [
  'W2-01',
  'W2-02',
  'W2-03',
  'W2-04',
  'W2-05',
  'W2-06',
  'W2-07',
  'W2-08',
  'W2-09',
  'W2-10',
  'W2-11',
  'W2-12',
  'W2-13',
];

const files = {
  authLayout: read('src/components/templates/AuthLayout.tsx'),
  accountLayout: read('src/components/templates/AccountLayout.tsx'),
  voucherRecipientPage: read('src/app/[locale]/voucher/[code]/page.tsx'),
  voucherConsentPage: read('src/app/[locale]/voucher/consent/[token]/page.tsx'),
  voucherConsentForm: read('src/app/[locale]/voucher/consent/[token]/ConsentForm.tsx'),
};

test('STORE-AUTH-SKIN maps all seven auth surfaces to the BonBeauty contract-A shell', () => {
  for (const surface of AUTH_SURFACES) {
    assert.match(files.authLayout, new RegExp(`'${surface}'`));
  }

  assert.match(files.authLayout, /bb-gradient-page-warm/);
  assert.match(files.authLayout, /bb-surface-strong/);
  assert.match(files.authLayout, /bb-border-soft/);
  assert.doesNotMatch(files.authLayout, /terracotta|stitch/i);
});

test('STORE-ACCOUNT-SKIN maps account hub surfaces to cream/gold token-bound navigation and cards', () => {
  for (const surface of ACCOUNT_SURFACES) {
    assert.match(files.accountLayout, new RegExp(`'${surface}'`));
  }

  assert.match(files.accountLayout, /--account-nav-width/);
  assert.match(files.accountLayout, /bg-\[var\(--gold\)\]/);
  assert.match(files.accountLayout, /color-selected-bg/);
  assert.match(files.accountLayout, /bb-surface-strong/);
  assert.doesNotMatch(files.accountLayout, /terracotta|stitch/i);
});

test('voucher recipient and consent views consume the same contract-A page/card tokens', () => {
  assert.match(files.voucherRecipientPage, /bb-gradient-page-warm/);
  assert.match(files.voucherConsentPage, /bb-gradient-page-warm/);
  assert.match(files.voucherConsentPage, /bb-surface-strong/);
  assert.match(files.voucherConsentForm, /bb-border-soft/);
  assert.match(files.voucherConsentForm, /bb-white-75/);
  assert.doesNotMatch(
    [
      files.voucherRecipientPage,
      files.voucherConsentPage,
      files.voucherConsentForm,
    ].join('\n'),
    /terracotta|stitch/i
  );
});
