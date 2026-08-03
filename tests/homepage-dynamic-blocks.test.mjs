import test from 'node:test';
import assert from 'node:assert/strict';

const originalFetch = global.fetch;
const originalPayloadApiUrl = process.env.PAYLOAD_API_URL;
const originalMarketId = process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID;

function restoreEnvironment() {
  global.fetch = originalFetch;

  if (originalPayloadApiUrl == null) {
    delete process.env.PAYLOAD_API_URL;
  } else {
    process.env.PAYLOAD_API_URL = originalPayloadApiUrl;
  }

  if (originalMarketId == null) {
    delete process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID;
  } else {
    process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = originalMarketId;
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  });
}

function toUrl(input) {
  if (input instanceof URL) {
    return input;
  }

  return new URL(typeof input === 'string' ? input : input.url);
}

async function importDynamicBlocksModule(tag) {
  const moduleUrl = new URL('../src/lib/homepage/dynamic-blocks.ts', import.meta.url);
  return import(`${moduleUrl.href}?${tag}`);
}

test('fetchHomepageBlogPosts scopes page lookup to the current market tenant', async () => {
  process.env.PAYLOAD_API_URL = 'http://payload.test';
  process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'mercur';

  const calls = [];

  global.fetch = async input => {
    const url = toUrl(input);
    calls.push(url);

    if (url.pathname === '/api/market-configs') {
      return jsonResponse({
        docs: [{ id: 7, market_id: 'mercur', tenant: { id: 42 } }]
      });
    }

    if (url.pathname === '/api/pages') {
      return jsonResponse({
        docs: [
          {
            id: 1,
            title: 'Mercur Accessories Edit',
            excerpt: 'Curated looks for the current Mercur storefront.',
            page_type: 'blog',
            canonicalUrl: '#',
            structuredData: {
              articleSection: 'Accessories'
            }
          }
        ]
      });
    }

    throw new Error(`Unexpected fetch: ${url.toString()}`);
  };

  try {
    const { fetchHomepageBlogPosts } = await importDynamicBlocksModule(`tenant-scope=${Date.now()}`);
    const posts = await fetchHomepageBlogPosts({ limit: 3 });

    assert.equal(calls.length, 2);
  assert.equal(calls[0].pathname, '/api/market-configs');
    assert.equal(calls[0].searchParams.get('where[market_id][equals]'), 'mercur');
    assert.equal(calls[1].pathname, '/api/pages');
    assert.equal(calls[1].searchParams.get('where[tenant][equals]'), '42');
    assert.equal(calls[1].searchParams.get('where[page_type][equals]'), 'blog');
    assert.equal(calls[1].searchParams.get('sort'), '-publishedAt');
    assert.equal(posts.length, 1);
    assert.equal(posts[0].category, 'ACCESSORIES');
    assert.equal(posts[0].href, '#');
  } finally {
    restoreEnvironment();
  }
});

test('fetchHomepageBlogPosts returns no posts when tenant resolution fails for a scoped market', async () => {
  process.env.PAYLOAD_API_URL = 'http://payload.test';
  process.env.NEXT_PUBLIC_PAYLOAD_MARKET_ID = 'mercur';

  const calls = [];

  global.fetch = async input => {
    const url = toUrl(input);
    calls.push(url);

    if (url.pathname === '/api/market-configs') {
      return jsonResponse({ docs: [] });
    }

    throw new Error(`Unexpected fetch: ${url.toString()}`);
  };

  try {
    const { fetchHomepageBlogPosts } = await importDynamicBlocksModule(`tenant-miss=${Date.now()}`);
    const posts = await fetchHomepageBlogPosts({ limit: 3 });

    assert.deepStrictEqual(posts, []);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].pathname, '/api/market-configs');
  } finally {
    restoreEnvironment();
  }
});
