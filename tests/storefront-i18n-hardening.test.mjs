import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test, { describe } from 'node:test';

const root = process.cwd();
const locales = ['pl', 'en', 'ua', 'de'];
const showcaseChromeKeys = [
  'sections.searchOverlay',
  'sections.toastAlert',
  'sections.modalPatterns',
  'search.query',
  'search.resultA.name',
  'search.resultA.price',
  'search.resultB.name',
  'search.resultB.price',
  'search.recentA',
  'search.recentB',
  'search.suggestionA',
  'search.suggestionB',
  'toasts.info',
  'toasts.success',
  'toasts.warning',
  'toasts.error',
  'modal.title',
  'modal.body',
  'modal.primary',
  'modal.secondary',
];

const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = relativePath => JSON.parse(read(relativePath));

function flatten(value, prefix = '', mode = 'keys') {
  return Object.entries(value).flatMap(([key, item]) => {
    if (key === '_review' && prefix === '') return [];
    const next = prefix ? `${prefix}.${key}` : key;
    return item && typeof item === 'object' && !Array.isArray(item)
      ? flatten(item, next, mode)
      : [mode === 'entries' ? [next, item] : next];
  });
}

function readPath(value, dottedPath) {
  return dottedPath.split('.').reduce((cursor, segment) => {
    if (!cursor || typeof cursor !== 'object') return undefined;
    return cursor[segment];
  }, value);
}

const DE_ACCEPTED_IDENTICAL_TO_PL = new Set([
  'header.logo_alt',
  'header.nav.blog',
  'seller.list.radius_5km',
  'seller.list.radius_10km',
  'seller.list.radius_25km',
  'seller.list.radius_50km',
  'seller.detail_v180.legal.nip',
  'seller.detail_v180.legal.regon',
  'seller.detail_v180.legal.krs',
  'seller.reviews_v180.summary.ratingLine',
  'seller.reviews_v180.list.ratingVisible',
  'products.seller_regon',
  'products.seller_krs',
  'blog.title',
  'legal.contact_email',
  'voucher.pdf.directions_google_label',
  'voucher.pdf.directions_apple_label',
  'voucher.recipient.active.card_eyebrow_with_city',
  'voucher.recipient.salon.phone_label',
  'voucher.pdf_directions.google_maps_label',
  'voucher.pdf_directions.apple_maps_label',
  'voucher.recipient_audit_trail.empty.cta_href',
  'voucher.recipient_audit_trail.error.support_href',
  'voucher_withdrawal.state_withdrawal_eligible_before_service_execution.status_token',
  'voucher_withdrawal.state_consent_to_execute_captured.status_token',
  'voucher_withdrawal.state_withdrawal_blocked_after_execution.status_token',
  'voucher_withdrawal.state_refunded.status_token',
  'voucher_withdrawal.state_support_review.status_token',
  'voucher_withdrawal.legal.contact_support_href',
  'payment_status.mailto_ticket_label',
  'storefront_state.empty.initial.action_href',
  'storefront_state.empty.no_results.action_href',
  'storefront_state.empty.permission_denied.action_href',
  'storefront_state.empty.load_error.action_href',
  'storefront_state.validation.action_href',
  'storefront_state.unavailable.action_href',
  'storefront_state.access_denied.action_href',
  'storefront_state.stale.action_href',
  'storefront_state.pending.action_href',
  'storefront_state.failed.action_href',
  'storefront_state.retry.action_href',
  'storefront_state.recovered.action_href',
  'pdp.seller_proof.treatments_value',
  'pdp.tabs.faq.label',
  'accountRead.empty.collectionCode',
  'accountRead.empty.wishlistCode',
  'accountRead.empty.messagesCode',
  'accountRead.orderDetail.payment.providers.stripe',
  'accountRead.orderDetail.payment.providers.pp_stripe_stripe',
  'accountRead.orderDetail.payment.providers.paypal',
  'accountRead.orderDetail.payment.providers.blik',
  'accountRead.orderDetail.payment.providers.p24',
  'error_surface.offline_label',
  'categories_index.hero.eyebrow',
  // Cognates — same word in German and Polish; not silent fallbacks.
  // LOW-2 fix (review 6.5): reverted inconsistent *filter/*suchen compounds to
  // cognate-identical forms matching German and sibling label conventions.
  'category_plp.filter_salon',          // "Salon" — no German alternative; filter-chip siblings are single nouns
  'categories_index.filters.premium',   // "Premium" — international loanword
  'home_v3.search.tabs.product',        // "Produkt" — search-tab siblings are single nouns; "Produkt suchen" was wrong form
  'loading_states_catalogue.lp1_prefix',
  'loading_states_catalogue.lp2_prefix',
  'loading_states_catalogue.lp3_prefix',
  'loading_states_catalogue.lp4_prefix',
  'loading_states_catalogue.lp5_prefix',
  'loading_states_catalogue.lp6_prefix',
  'showcase.chrome.modal.title',
  'showcase.chrome.search.query',
  'showcase.chrome.search.recentA',
  'showcase.chrome.search.resultA.price',
  'showcase.chrome.search.resultB.price',
  'showcase.chrome.sections.modalPatterns',
  'showcase.chrome.sections.searchOverlay',
  // Cognates / loanwords / hrefs inherited from v1.12.0 catalogs — identical PL==DE by design,
  // not silent fallbacks. Explicitly accepted so the storefront i18n-hardening gate is green.
  'common.price_display.free',                  // "Gratis" — valid German word, identical to PL
  'confirmation.next_for_recipient_href',       // "/help" — route href, never translated
  'consent.modal.categories.marketing.label',   // "Marketing" — international loanword
  'footer.nav.faq',                             // "FAQ" — acronym/loanword
  'footer.nav.kontakt',                         // "Kontakt" — identical German cognate
  'mobile_bottom_nav.account',                  // "Konto" — identical German cognate
]);

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

  test('voucher QR labels exist at the top-level voucher namespace in every release locale', () => {
    for (const locale of locales) {
      const messages = readJson(`messages/${locale}.json`);

      assert.equal(typeof messages.voucher.qr_code_aria_label, 'string');
      assert.equal(typeof messages.voucher.qr_code_label, 'string');
      assert.notEqual(messages.voucher.qr_code_aria_label.trim(), '');
      assert.notEqual(messages.voucher.qr_code_label.trim(), '');
    }
  });

  test('showcase chrome copy is keyed in every locale without raw-key fallback values', () => {
    for (const locale of locales) {
      const messages = readJson(`messages/${locale}.json`);

      for (const key of showcaseChromeKeys) {
        const fullKey = `showcase.chrome.${key}`;
        const value = readPath(messages, fullKey);

        assert.equal(typeof value, 'string', `${locale} missing ${fullKey}`);
        assert.notEqual(value.trim(), '', `${locale} has empty ${fullKey}`);
        assert.notEqual(value, key, `${locale} renders raw key ${key}`);
        assert.notEqual(value, fullKey, `${locale} renders raw key ${fullKey}`);
      }
    }
  });

  test('showcase chrome route no longer keeps user-visible fixture copy as JSX literals', () => {
    const client = read('src/app/[locale]/showcase/chrome/_client.tsx');

    assert.match(client, /useTranslations\('showcase\.chrome'\)/);
    assert.match(client, /useLocale\(\)/);

    for (const literal of [
      'Produkt showcase A',
      'Produkt showcase B',
      'Showcase: informacja (info)',
      'Showcase: operacja zakonczona (success)',
      'Showcase: ostrzezenie (warning)',
      'Showcase: blad krytyczny (error)',
      'Treść showcase dla golden baseline',
      'Potwierdź',
      'Anuluj',
    ]) {
      assert.doesNotMatch(client, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });

  test('de catalog has no silent PL fallback copies outside the accepted technical allowlist', () => {
    const pl = Object.fromEntries(flatten(readJson('messages/pl.json'), '', 'entries'));
    const de = Object.fromEntries(flatten(readJson('messages/de.json'), '', 'entries'));

    const identical = Object.entries(pl)
      .filter(([key, value]) => de[key] === value)
      .map(([key]) => key)
      .sort();

    assert.deepEqual(
      identical,
      [...DE_ACCEPTED_IDENTICAL_TO_PL].sort(),
      'de.json contains a PL-identical value that is not an explicit accept-fallback'
    );
  });

  test('price, checkout and voucher-adjacent radiogroups are named by visible labels', () => {
    const giftMode = read('src/components/atoms/GiftModeToggle/GiftModeToggle.tsx');
    const purchaseMode = read('src/components/molecules/PurchaseModeToggle/PurchaseModeToggle.tsx');
    const sellerSelector = read('src/components/cells/SellerSelector/SellerSelector.tsx');
    const categorySidebar = read('src/components/sections/CategoryPlp/CategoryPlpSidebar.tsx');

    for (const source of [giftMode, purchaseMode, sellerSelector, categorySidebar]) {
      assert.doesNotMatch(source, /role="radiogroup"[\s\S]{0,160}aria-label=/);
      assert.match(source, /role="radiogroup"[\s\S]{0,180}aria-labelledby=/);
    }
  });

  test('sitemap emits native alternates for market locales with x-default pointing to locales.default', () => {
    const source = read('src/lib/seo/sitemap.ts');

    // Story 1.1 v1.14.0 (AD-2): locale enumeration comes from the market-aware
    // resolver, x-default from `locales.default` — not from compile-time constants.
    assert.match(source, /resolveMarketLocales/);
    assert.match(source, /marketLocales\.supported\.reduce/);
    assert.match(source, /toHreflangBare\(locale\)/);
    assert.match(source, /'x-default': localizedUrl\(base, marketLocales\.defaultLocale, path\)/);
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
