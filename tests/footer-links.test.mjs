import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { resolveFooterConnectLinks, resolveFooterCopyright, resolveFooterNavLinks } = await import('../src/lib/footer.ts');

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

  test('parses nav_links sections with valid links', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          {
            section: 'customer_services',
            links: [
              { label: 'FAQs', path: '/faq' },
              { label: 'Returns', path: '/returns' }
            ]
          },
          {
            section: 'about',
            links: [
              { label: 'About us', path: '/about' }
            ]
          }
        ]
      }
    });

    assert.deepEqual(sections, [
      {
        section: 'customer_services',
        links: [
          { label: 'FAQs', path: '/faq' },
          { label: 'Returns', path: '/returns' }
        ]
      },
      {
        section: 'about',
        links: [{ label: 'About us', path: '/about' }]
      }
    ]);
  });

  test('skips sections with missing or empty section identifier', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          { section: null, links: [{ label: 'FAQ', path: '/faq' }] },
          { section: '  ', links: [{ label: 'FAQ', path: '/faq' }] },
          { section: 'about', links: [{ label: 'About us', path: '/about' }] }
        ]
      }
    });

    assert.equal(sections.length, 1);
    assert.equal(sections[0].section, 'about');
  });

  test('skips individual links with missing label or path', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          {
            section: 'customer_services',
            links: [
              { label: 'FAQ', path: '/faq' },
              { label: null, path: '/returns' },
              { label: 'Delivery', path: null }
            ]
          }
        ]
      }
    });

    assert.deepEqual(sections, [
      {
        section: 'customer_services',
        links: [{ label: 'FAQ', path: '/faq' }]
      }
    ]);
  });

  test('handles section with no links (empty links array)', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [{ section: 'about', links: [] }]
      }
    });

    assert.deepEqual(sections, [{ section: 'about', links: [] }]);
  });

  test('handles section with null links', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [{ section: 'about', links: null }]
      }
    });

    assert.deepEqual(sections, [{ section: 'about', links: [] }]);
  });

  test('rejects nav link paths that do not start with /', () => {
    const sections = resolveFooterNavLinks({
      footer: {
        nav_links: [
          {
            section: 'about',
            links: [
              { label: 'Safe', path: '/about' },
              { label: 'XSS', path: 'javascript:alert(1)' },
              { label: 'External', path: 'https://evil.com' },
              { label: 'Relative', path: 'about' }
            ]
          }
        ]
      }
    });

    assert.deepEqual(sections, [
      { section: 'about', links: [{ label: 'Safe', path: '/about' }] }
    ]);
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