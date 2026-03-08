import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

const { resolveFooterConnectLinks, resolveFooterCopyright } = await import('../src/lib/footer.ts');

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