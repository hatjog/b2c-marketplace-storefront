import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { getFixtureBlogPost } from '@/lib/blog-fixtures';

import { BlogRichText } from './BlogRichText';

vi.mock('@/components/molecules/LocalizedLink/LocalizedLink', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a
      href={href}
      {...props}
    >
      {children}
    </a>
  )
}));

describe('BlogRichText', () => {
  it('renders the canonical fixture with headings, lists, table, video, iframe and footnotes', () => {
    const post = getFixtureBlogPost('pl', 'mercur-accessories-edit');
    expect(post).not.toBeNull();

    const html = renderToStaticMarkup(
      <BlogRichText
        slug={post!.slug}
        content={post!.content}
        disallowedEmbedLabel="Blocked embed"
        inlineEmbedLabel="Inline embed"
      />
    );

    expect(html).toContain('blog-post-richtext');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<h4');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<table');
    expect(html).toContain('<video');
    expect(html).toContain('<iframe');
    expect(html).toContain('footnote-seasonal-ledger');
    expect(html).toContain('Inline embed');
  });

  it('falls back to a safe notice for disallowed iframe providers', () => {
    const html = renderToStaticMarkup(
      <BlogRichText
        slug="unsafe"
        disallowedEmbedLabel="Blocked embed"
        inlineEmbedLabel="Inline embed"
        content={[
          {
            type: 'embedded-iframe',
            src: 'https://evil.example.com/frame',
            title: 'Unsafe provider'
          }
        ]}
      />
    );

    expect(html).toContain('Blocked embed');
    expect(html).not.toContain('<iframe');
  });
});
