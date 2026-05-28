import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

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

describe('footer nav links resolution', () => {
  test('returns empty array when footer.nav_links is absent', () => {
    const sections = resolveFooterNavLinks({ name: 'TestMarket' });
    assert.deepEqual(sections, []);
  });

  test('returns empty array when footer.nav_links is null', () => {
    const sections = resolveFooterNavLinks({ footer: { nav_links: null } });
    assert.deepEqual(sections, []);
  });

  test('returns empty array when footer.nav_links is empty array', () => {
    const sections = resolveFooterNavLinks({ footer: { nav_links: [] } });
    assert.deepEqual(sections, []);
  });

  test('parses flat nav_links with valid href fields', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          { label: 'FAQs', href: '/faq' },
          { label: 'Returns', href: '/returns' },
          { label: 'About us', href: '/about' }
        ]
      }
    });

    assert.deepEqual(sections, [
      {
        section: 'about',
        links: [
          { label: 'FAQs', path: '/faq' },
          { label: 'Returns', path: '/returns' },
          { label: 'About us', path: '/about' }
        ]
      }
    ]);
  });

  test('skips items with missing or empty label', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          { label: null, href: '/faq' },
          { label: '  ', href: '/faq' },
          { label: 'About us', href: '/about' }
        ]
      }
    });

    assert.equal(sections.length, 1);
    assert.equal(sections[0].links.length, 1);
    assert.equal(sections[0].links[0].label, 'About us');
  });

  test('skips items with missing label or href', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          { label: 'FAQ', href: '/faq' },
          { label: null, href: '/returns' },
          { label: 'Delivery', href: null }
        ]
      }
    });

    assert.deepEqual(sections, [
      {
        section: 'about',
        links: [{ label: 'FAQ', path: '/faq' }]
      }
    ]);
  });

  test('returns empty array when all items are invalid', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [{ label: null, href: null }]
      }
    });

    assert.deepEqual(sections, []);
  });

  test('skips disabled items', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          { label: 'About', href: '/about', enabled: true },
          { label: 'Hidden', href: '/hidden', enabled: false }
        ]
      }
    });

    assert.deepEqual(sections, [
      { section: 'about', links: [{ label: 'About', path: '/about' }] }
    ]);
  });

  test('rejects nav link hrefs that do not start with /', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          { label: 'Safe', href: '/about' },
          { label: 'XSS', href: 'javascript:alert(1)' },
          { label: 'External', href: 'https://evil.com' },
          { label: 'Relative', href: 'about' }
        ]
      }
    });

    assert.deepEqual(sections, [
      { section: 'about', links: [{ label: 'Safe', path: '/about' }] }
    ]);
  });

  test('marks BonBeauty legal document links with in-house sign-off badge metadata', () => {
    const sections = resolveFooterNavLinks({
      market_id: 'bonbeauty',
      footer: {
        nav_links: [
          { label: 'Regulamin', href: '/regulamin' },
          { label: 'Blog', href: '/blog' }
        ]
      }
    });

    assert.deepEqual(sections[0].links[0].legalSignoffBadge, {
      docType: 'regulamin',
      status: 'accepted-in-house'
    });
    assert.equal(sections[0].links[1].legalSignoffBadge, undefined);
  });
});

describe('footer legal sign-off badge resolution', () => {
  test('returns badge metadata only for bonbeauty accepted-in-house legal docs', () => {
    assert.deepEqual(resolveFooterLegalSignoffBadge({ market_id: 'bonbeauty' }, '/pomoc'), {
      docType: 'pomoc',
      status: 'accepted-in-house'
    });
    assert.equal(resolveFooterLegalSignoffBadge({ market_id: 'bongarden' }, '/pomoc'), null);
    assert.equal(resolveFooterLegalSignoffBadge({ market_id: 'bonbeauty' }, '/not-legal'), null);
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
});
