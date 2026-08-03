import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchPayloadBlogPage, mapRouteLocaleToPayloadLocale } from './fetchPayloadBlogPage';

vi.mock('server-only', () => ({}));

const originalFetch = global.fetch;
const originalPayloadApiUrl = process.env.PAYLOAD_API_URL;

function restoreEnvironment() {
  global.fetch = originalFetch;

  if (originalPayloadApiUrl == null) {
    delete process.env.PAYLOAD_API_URL;
  } else {
    process.env.PAYLOAD_API_URL = originalPayloadApiUrl;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  });
}

function toUrl(input: RequestInfo | URL) {
  if (input instanceof URL) {
    return input;
  }

  return new URL(typeof input === 'string' ? input : input.url);
}

const lexicalContent = {
  root: {
    children: [
      {
        type: 'heading',
        tag: 'h2',
        children: [{ type: 'text', text: 'Payload heading' }]
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'Payload blog body.' }]
      }
    ]
  }
};

afterEach(() => {
  restoreEnvironment();
});

describe('fetchPayloadBlogPage', () => {
  it('maps route locale ua to Payload locale uk', () => {
    expect(mapRouteLocaleToPayloadLocale('ua')).toBe('uk');
    expect(mapRouteLocaleToPayloadLocale('pl')).toBe('pl');
  });

  it('queries Payload Pages as published blog with slug, tenant and locale', async () => {
    process.env.PAYLOAD_API_URL = 'https://payload.test';
    const calls: URL[] = [];

    global.fetch = vi.fn(async input => {
      const url = toUrl(input);
      calls.push(url);

      if (url.pathname === '/api/market-configs') {
        return jsonResponse({
          docs: [{ id: 'market-config', market_id: 'bonbeauty', tenant: { id: 42 } }]
        });
      }

      if (url.pathname === '/api/pages') {
        return jsonResponse({
          docs: [
            {
              id: 'payload-post-1',
              title: 'Payload Blog Post',
              slug: 'payload-blog-post',
              excerpt: 'Payload excerpt',
              page_type: 'blog',
              _status: 'published',
              hero_image: {
                url: '/images/blog/post-1.jpg',
                alt: 'Payload hero alt'
              },
              publishedAt: '2026-05-18T10:00:00.000Z',
              content: lexicalContent,
              structuredData: {
                articleSection: 'Payload',
                author: {
                  name: 'Payload Author',
                  role: 'Editor',
                  bio: 'Writes from Payload.'
                }
              },
              meta: {
                title: 'Payload SEO title',
                description: 'Payload SEO description'
              }
            }
          ]
        });
      }

      throw new Error(`Unexpected fetch: ${url.toString()}`);
    }) as typeof fetch;

    const page = await fetchPayloadBlogPage({
      locale: 'ua',
      fallbackLocale: 'pl',
      slug: 'payload-blog-post',
      marketId: 'bonbeauty'
    });

    expect(page?.title).toBe('Payload Blog Post');
    expect(page?.contentFallbackLocale).toBeNull();
    expect(page?.content[0]?.type).toBe('heading-2');
    expect(calls[1]?.searchParams.get('where[page_type][equals]')).toBe('blog');
    expect(calls[1]?.searchParams.get('where[_status][equals]')).toBe('published');
    expect(calls[1]?.searchParams.get('where[slug][equals]')).toBe('payload-blog-post');
    expect(calls[1]?.searchParams.get('where[tenant][equals]')).toBe('42');
    expect(calls[1]?.searchParams.get('locale')).toBe('uk');
    expect(calls[1]?.searchParams.get('fallback-locale')).toBe('none');
  });

  it('fails closed for invalid RichText and missing image alt', async () => {
    process.env.PAYLOAD_API_URL = 'https://payload.test';

    global.fetch = vi.fn(async input => {
      const url = toUrl(input);

      if (url.pathname === '/api/pages') {
        return jsonResponse({
          docs: [
            {
              id: 'invalid',
              title: 'Invalid',
              slug: 'invalid',
              excerpt: 'Invalid',
              page_type: 'blog',
              _status: 'published',
              hero_image: {
                url: '/images/blog/post-1.jpg',
                alt: ''
              },
              content: { root: {} }
            }
          ]
        });
      }

      throw new Error(`Unexpected fetch: ${url.toString()}`);
    }) as typeof fetch;

    await expect(
      fetchPayloadBlogPage({
        locale: 'pl',
        fallbackLocale: 'pl',
        slug: 'invalid',
        marketId: ''
      })
    ).resolves.toBeNull();
  });
});

describe('fetchPayloadBlogPage — market default fallback (CAP-4 / AC2)', () => {
  const publishedDoc = (overrides: Record<string, unknown> = {}) => ({
    id: 'payload-post-1',
    title: 'Poranny rytuał',
    slug: 'poranny-rytual',
    excerpt: 'Polska zajawka',
    page_type: 'blog',
    _status: 'published',
    hero_image: { url: '/images/blog/post-1.jpg', alt: 'Hero alt' },
    content: lexicalContent,
    ...overrides
  });

  /** Serves `docsByLocale[locale]`; a locale absent from the map has no variant. */
  function stubPayload(docsByLocale: Record<string, unknown[]>) {
    process.env.PAYLOAD_API_URL = 'https://payload.test';
    const localesRequested: string[] = [];
    const tagsRequested: string[][] = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = toUrl(input);

      if (url.pathname !== '/api/pages') {
        throw new Error(`Unexpected fetch: ${url.toString()}`);
      }

      const locale = url.searchParams.get('locale') ?? '';
      localesRequested.push(locale);
      tagsRequested.push((init as { next?: { tags?: string[] } } | undefined)?.next?.tags ?? []);

      return jsonResponse({ docs: docsByLocale[locale] ?? [] });
    }) as unknown as typeof fetch;

    return { localesRequested, tagsRequested };
  }

  it('falls back to market.locales.default and tags the result as a fallback', async () => {
    const { localesRequested, tagsRequested } = stubPayload({ pl: [publishedDoc()] });

    const page = await fetchPayloadBlogPage({
      locale: 'de',
      fallbackLocale: 'pl',
      slug: 'poranny-rytual',
      marketId: ''
    });

    expect(localesRequested).toEqual(['de', 'pl']);
    expect(page?.title).toBe('Poranny rytuał');
    expect(page?.contentFallbackLocale).toBe('pl');
    // Cache keys stay separated per canonical locale — a `de` miss must not
    // poison the `pl` entry or vice versa.
    expect(tagsRequested[0]).toEqual(['pages-de', 'page-poranny-rytual-de']);
    expect(tagsRequested[1]).toEqual(['pages-pl', 'page-poranny-rytual-pl']);
  });

  it('does not fall back when the requested locale has its own variant', async () => {
    const { localesRequested } = stubPayload({
      uk: [publishedDoc({ title: 'Ранковий ритуал' })],
      pl: [publishedDoc()]
    });

    const page = await fetchPayloadBlogPage({
      locale: 'ua',
      fallbackLocale: 'pl',
      slug: 'poranny-rytual',
      marketId: ''
    });

    expect(localesRequested).toEqual(['uk']);
    expect(page?.title).toBe('Ранковий ритуал');
    expect(page?.contentFallbackLocale).toBeNull();
  });

  it('does not issue a second request when the route locale is the market default', async () => {
    const { localesRequested } = stubPayload({});

    const page = await fetchPayloadBlogPage({
      locale: 'pl',
      fallbackLocale: 'pl',
      slug: 'poranny-rytual',
      marketId: ''
    });

    expect(localesRequested).toEqual(['pl']);
    expect(page).toBeNull();
  });

  it('returns null when neither the requested nor the default locale renders', async () => {
    const { localesRequested } = stubPayload({});

    const page = await fetchPayloadBlogPage({
      locale: 'de',
      fallbackLocale: 'pl',
      slug: 'poranny-rytual',
      marketId: ''
    });

    expect(localesRequested).toEqual(['de', 'pl']);
    expect(page).toBeNull();
  });
});