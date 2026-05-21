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
      slug: 'payload-blog-post',
      marketId: 'bonbeauty'
    });

    expect(page?.title).toBe('Payload Blog Post');
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
        slug: 'invalid',
        marketId: ''
      })
    ).resolves.toBeNull();
  });
});