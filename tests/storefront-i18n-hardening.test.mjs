import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const locales = ['pl', 'en', 'ua', 'de'];

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = relativePath => JSON.parse(read(relativePath));

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, item]) => {
    if (key === '_review' && prefix === '') return [];
    const next = prefix ? `${prefix}.${key}` : key;
    return item && typeof item === 'object' && !Array.isArray(item)
      ? flatten(item, next)
      : [next];
  });
}

describe('Story 6.3 storefront i18n hardening', () => {
  test('all release locales contain the PL baseline keys', () => {
    const baseline = new Set(flatten(readJson('messages/pl.json')));

    for (const locale of locales.filter(locale => locale !== 'pl')) {
      const keys = new Set(flatten(readJson(`messages/${locale}.json`)));
      const missing = [...baseline].filter(key => !keys.has(key));

      assert.deepEqual(missing, [], `${locale} is missing PL baseline keys`);
    }
  });

  test('checkout, confirmation and account copy are translated in every release locale', () => {
    for (const locale of locales) {
      const messages = readJson(`messages/${locale}.json`);

      assert.equal(typeof messages.page.checkout_title, 'string');
      assert.equal(typeof messages.page.checkout_description, 'string');
      assert.equal(typeof messages.confirmation.meta_title, 'string');
      assert.equal(typeof messages.confirmation.meta_description, 'string');
      assert.equal(typeof messages.user.welcome_heading, 'string');
      assert.equal(typeof messages.user.welcome_subheading, 'string');
    }
  });

  test('sitemap emits native alternates for active locales with x-default pointing to PL', () => {
    const source = read('src/app/sitemap.ts');

    assert.match(source, /SUPPORTED_LOCALES\.reduce/);
    assert.match(source, /toHreflang\(locale\)/);
    assert.match(source, /'x-default': localizedUrl\(base, DEFAULT_LOCALE, path\)/);
    assert.match(source, /\/regulamin/);
    assert.match(source, /\/polityka-prywatnosci/);
    assert.match(source, /\/zasady/);
    assert.match(source, /\/pomoc/);
  });

  test('localized private surfaces avoid hardcoded English metadata and loading copy', () => {
    const checkout = read('src/app/[locale]/(checkout)/checkout/page.tsx');
    const confirmed = read('src/app/[locale]/(main)/order/[id]/confirmed/page.tsx');
    const forgotPassword = read('src/app/[locale]/(auth)/forgot-password/page.tsx');
    const account = read('src/app/[locale]/(main)/user/page.tsx');

    assert.doesNotMatch(checkout, /title:\s*['"]Checkout['"]/);
    assert.doesNotMatch(checkout, /Loading\.\.\./);
    assert.doesNotMatch(confirmed, /Order Confirmed|Your purchase was successful/);
    assert.doesNotMatch(forgotPassword, /Forgot password|Create a new password/);
    assert.doesNotMatch(account, /Welcome \{user\.first_name\}|Your account is ready to go!/);
  });
});
