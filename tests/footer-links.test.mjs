import assert from 'node:assert/strict';
import test, { describe } from 'node:test';

const {
  resolveFooterConnectLinks,
  resolveFooterCopyright,
  resolveFooterLegalSignoffBadge,
  resolveFooterNavLinks
} = await import('../src/lib/footer.ts');

describe('footer social links resolution', () => {
  test('prefers MarketConfig footer.social when available', () => {
    const links = resolveFooterConnectLinks({
      footer: {
        social: [
          { label: 'Instagram', href: 'https://www.instagram.com/market' },
          { label: 'TikTok', href: 'https://www.tiktok.com/@market' }
        ]
      },
      public_profile: {
        social_links: {
          facebook: 'https://www.facebook.com/market'
        }
      }
    });

    assert.deepEqual(links, [
      { label: 'Instagram', href: 'https://www.instagram.com/market' },
      { label: 'TikTok', href: 'https://www.tiktok.com/@market' }
    ]);
  });

  test('falls back to runtime public_profile.social_links when footer.social is missing', () => {
    const links = resolveFooterConnectLinks({
      public_profile: {
        social_links: {
          facebook: 'https://www.facebook.com/bonbeauty.pl',
          instagram: 'https://www.instagram.com/bonbeauty.pl'
        }
      }
    });

    assert.deepEqual(links, [
      { label: 'Facebook', href: 'https://www.facebook.com/bonbeauty.pl' },
      { label: 'Instagram', href: 'https://www.instagram.com/bonbeauty.pl' }
    ]);
  });

  test('treats explicit empty footer.social as authoritative and does not revive runtime fallbacks', () => {
    const links = resolveFooterConnectLinks({
      footer: {
        social: []
      },
      public_profile: {
        social_links: {
          facebook: 'https://www.facebook.com/bonbeauty.pl'
        }
      }
    });

    assert.deepEqual(links, []);
  });

  test('filters invalid footer.social href values before rendering', () => {
    const links = resolveFooterConnectLinks({
      footer: {
        social: [
          { label: 'Instagram', href: 'javascript:alert(1)' },
          { label: 'TikTok', href: 'https://www.tiktok.com/@market' }
        ]
      }
    });

    assert.deepEqual(links, [{ label: 'TikTok', href: 'https://www.tiktok.com/@market' }]);
  });

  test('returns empty array when both footer.social and public_profile.social_links are absent', () => {
    const links = resolveFooterConnectLinks({
      name: 'SomeMarket'
    });

    assert.deepEqual(links, []);
  });
});

// QD-02: nav labels are CHROME. `resolveFooterNavLinks` no longer reads
// `item.label` — it maps the route onto a canonical key and asks the chrome
// translator. This fake stands in for `messages/<locale>.json`; the real message
// files are exercised against real config in
// src/lib/__tests__/footer-locale-resolution.test.ts.
const UA_CHROME = {
  'nav.about': 'Про нас',
  'nav.faq': 'FAQ',
  'nav.kontakt': 'Контакт',
  'nav.regulamin': 'Умови використання',
  'nav.polityka-prywatnosci': 'Політика конфіденційності',
  'nav.pomoc': 'Допомога',
  'nav.zasady': 'Правила ваучерів'
};

const translateUa = key => UA_CHROME[key] ?? null;

describe('footer nav links resolution', () => {
  test('returns empty array when footer.nav_links is absent', () => {
    const sections = resolveFooterNavLinks({ name: 'TestMarket' }, null, translateUa);
    assert.deepEqual(sections, []);
  });

  test('returns empty array when footer.nav_links is null', () => {
    const sections = resolveFooterNavLinks({ footer: { nav_links: null } }, null, translateUa);
    assert.deepEqual(sections, []);
  });

  test('returns empty array when footer.nav_links is empty array', () => {
    const sections = resolveFooterNavLinks({ footer: { nav_links: [] } }, null, translateUa);
    assert.deepEqual(sections, []);
  });

  test('resolves every alias of the canonical route contract to the same chrome key', () => {
    // The point of QD-02: /o-nas and /about are the same destination, so both
    // must yield the ROUTE-LOCALE label, not the market's own vocabulary.
    for (const [aliasA, aliasB] of [
      ['/o-nas', '/about'],
      ['/kontakt', '/contact'],
      ['/regulamin', '/terms'],
      ['/polityka-prywatnosci', '/privacy'],
      ['/pomoc', '/help']
    ]) {
      const [a] = resolveFooterNavLinks(
        { footer: { nav_links: [{ href: aliasA }] } },
        null,
        translateUa
      );
      const [b] = resolveFooterNavLinks(
        { footer: { nav_links: [{ href: aliasB }] } },
        null,
        translateUa
      );

      assert.equal(a.links[0].label, b.links[0].label, `${aliasA} vs ${aliasB}`);
      assert.equal(a.links[0].path, aliasA);
      assert.equal(b.links[0].path, aliasB);
    }
  });

  test('renders the route-locale label and NEVER the label carried by the config', () => {
    const sections = resolveFooterNavLinks(
      {
        footer: {
          // A stale Polish label, exactly as Payload's NOT NULL column still holds.
          nav_links: [{ label: 'O nas', href: '/o-nas' }]
        }
      },
      null,
      translateUa
    );

    assert.equal(sections[0].links[0].label, UA_CHROME['nav.about']);
    assert.notEqual(sections[0].links[0].label, 'O nas');
  });

  test('strips a locale prefix before matching the canonical route', () => {
    const sections = resolveFooterNavLinks(
      { footer: { nav_links: [{ href: '/de/regulamin' }] } },
      null,
      translateUa
    );

    assert.equal(sections[0].links[0].label, UA_CHROME['nav.regulamin']);
  });

  test('drops a route outside the canonical contract instead of guessing a label', () => {
    const sections = resolveFooterNavLinks(
      { market_id: 'bonbeauty', footer: { nav_links: [{ label: 'Promo', href: '/promo' }] } },
      null,
      translateUa
    );

    assert.deepEqual(sections, []);
  });

  test('drops a link whose chrome key is missing rather than showing another language', () => {
    const sections = resolveFooterNavLinks(
      { footer: { nav_links: [{ label: 'O nas', href: '/o-nas' }, { href: '/faq' }] } },
      null,
      key => (key === 'nav.faq' ? 'FAQ' : null)
    );

    assert.deepEqual(sections, [{ section: 'about', links: [{ label: 'FAQ', path: '/faq' }] }]);
  });

  test('drops every link when no chrome translator is wired at all', () => {
    // Chrome has no cross-locale fallback: no translator means no honest label.
    const sections = resolveFooterNavLinks({ footer: { nav_links: [{ href: '/faq' }] } });

    assert.deepEqual(sections, []);
  });

  test('skips disabled items', () => {
    const sections = resolveFooterNavLinks(
      {
        footer: {
          nav_links: [
            { href: '/o-nas', enabled: true },
            { href: '/faq', enabled: false }
          ]
        }
      },
      null,
      translateUa
    );

    assert.deepEqual(sections, [
      { section: 'about', links: [{ label: UA_CHROME['nav.about'], path: '/o-nas' }] }
    ]);
  });

  test('rejects nav link hrefs that do not start with /', () => {
    const sections = resolveFooterNavLinks(
      {
        footer: {
          nav_links: [
            { href: '/o-nas' },
            { href: 'javascript:alert(1)' },
            { href: 'https://evil.com' },
            { href: 'about' }
          ]
        }
      },
      null,
      translateUa
    );

    assert.deepEqual(sections, [
      { section: 'about', links: [{ label: UA_CHROME['nav.about'], path: '/o-nas' }] }
    ]);
  });

  test('marks BonBeauty legal document links with in-house sign-off badge metadata when ledger status is accepted-in-house', () => {
    const sections = resolveFooterNavLinks(
      {
        market_id: 'bonbeauty',
        footer: { nav_links: [{ href: '/regulamin' }, { href: '/faq' }] }
      },
      { regulamin: 'accepted-in-house' },
      translateUa
    );

    assert.deepEqual(sections[0].links[0].legalSignoffBadge, {
      docType: 'regulamin',
      status: 'accepted-in-house'
    });
    assert.equal(sections[0].links[1].legalSignoffBadge, undefined);
  });

  test('hides legal sign-off badge when ledger status map is missing (no opt-in)', () => {
    const sections = resolveFooterNavLinks(
      { market_id: 'bonbeauty', footer: { nav_links: [{ href: '/regulamin' }] } },
      null,
      translateUa
    );

    assert.equal(sections[0].links[0].legalSignoffBadge, undefined);
  });

  test('hides legal sign-off badge when ledger status is WAIVED-demo (demo market)', () => {
    const sections = resolveFooterNavLinks(
      { market_id: 'bongarden', footer: { nav_links: [{ href: '/regulamin' }] } },
      { regulamin: 'WAIVED-demo' },
      translateUa
    );

    assert.equal(sections[0].links[0].legalSignoffBadge, undefined);
  });
});

describe('footer legal sign-off badge resolution', () => {
  test('returns badge metadata only when ledger status map says accepted-in-house', () => {
    assert.deepEqual(
      resolveFooterLegalSignoffBadge({ market_id: 'bonbeauty' }, '/pomoc', {
        pomoc: 'accepted-in-house'
      }),
      {
        docType: 'pomoc',
        status: 'accepted-in-house'
      }
    );
    assert.equal(
      resolveFooterLegalSignoffBadge({ market_id: 'bonbeauty' }, '/pomoc', {
        pomoc: 'WAIVED-demo'
      }),
      null
    );
    assert.deepEqual(
      resolveFooterLegalSignoffBadge({ market_id: 'bongarden' }, '/pomoc', {
        pomoc: 'accepted-in-house'
      }),
      {
        docType: 'pomoc',
        status: 'accepted-in-house'
      },
      "when ledger explicitly flags accepted-in-house for any market the badge MUST surface — gating by market is the ledger's job, not hard-coded marketId checks"
    );
    assert.equal(resolveFooterLegalSignoffBadge({ market_id: 'bonbeauty' }, '/pomoc'), null);
    assert.equal(
      resolveFooterLegalSignoffBadge({ market_id: 'bonbeauty' }, '/not-legal', {
        pomoc: 'accepted-in-house'
      }),
      null
    );
  });
});

describe('footer copyright resolution', () => {
  test('builds a dynamic copyright fallback from market name when custom footer copy is missing', () => {
    const year = new Date().getFullYear();
    const copyright = resolveFooterCopyright({
      name: 'BonBeauty'
    });

    assert.equal(copyright, `© ${year} BonBeauty`);
  });

  test('renders an already-resolved string unchanged', () => {
    assert.equal(
      resolveFooterCopyright({ footer: { copyright: '© 2026 BonBeauty. All rights reserved.' } }),
      '© 2026 BonBeauty. All rights reserved.'
    );
  });

  test('throws when a locale map reaches the renderer unresolved', () => {
    // The map must never leak past resolveMarketConfig. Degrading quietly here
    // would print [object Object] or silently swap in the `© year name`
    // fallback — both hide a broken call path instead of naming it.
    assert.throws(
      () =>
        resolveFooterCopyright({
          name: 'BonBeauty',
          footer: { copyright: { pl: '© 2026 BonBeauty', en: '© 2026 BonBeauty' } }
        }),
      /reached the renderer unresolved/
    );
  });
});
