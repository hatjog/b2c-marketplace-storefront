import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { RichTextValidationError } from './errors';
import { normalizeLexicalRichText } from './lexical';
import { RichTextRenderer } from './RichTextRenderer';

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

const lexicalFixture = {
  root: {
    children: [
      {
        type: 'heading',
        tag: 'h1',
        children: [{ type: 'text', text: 'Editorial heading' }]
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Plain ' },
          { type: 'text', text: 'bold', format: 1 },
          { type: 'text', text: ' italic', format: 2 },
          { type: 'text', text: ' underline', format: 8 },
          { type: 'text', text: ' strike', format: 4 },
          { type: 'text', text: ' code', format: 16 },
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: ' external link' }]
          },
          { type: 'reference', id: 'note-1', label: '1' }
        ]
      },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Second level' }] },
      { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Third level' }] },
      { type: 'heading', tag: 'h4', children: [{ type: 'text', text: 'Fourth level' }] },
      {
        type: 'list',
        listType: 'bullet',
        children: [{ children: [{ type: 'text', text: 'Bullet item' }] }]
      },
      {
        type: 'list',
        listType: 'number',
        children: [{ children: [{ type: 'text', text: 'Numbered item' }] }]
      },
      { type: 'blockquote', quote: 'Quote body', citation: 'Citation' },
      { type: 'pull-quote', quote: 'Pull quote body', attribution: 'Editorial' },
      {
        type: 'image',
        src: '/images/blog/post-1.jpg',
        alt: 'Image alt',
        caption: 'Image caption'
      },
      {
        type: 'video',
        src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
        title: 'Video title',
        caption: 'Video caption'
      },
      { type: 'divider' },
      {
        type: 'table',
        children: [
          {
            children: [
              { children: [{ type: 'text', text: 'Header A' }] },
              { children: [{ type: 'text', text: 'Header B' }] }
            ]
          },
          {
            children: [
              { children: [{ type: 'text', text: 'Cell A' }] },
              { children: [{ type: 'text', text: 'Cell B' }] }
            ]
          }
        ]
      },
      {
        type: 'embedded-iframe',
        html: '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" title="Safe"></iframe><script>alert(1)</script>'
      },
      {
        type: 'inline-embed',
        title: 'Inline resource',
        href: '/blog',
        caption: 'Inline description'
      },
      {
        type: 'footnote',
        id: 'note-1',
        label: '1',
        children: [{ type: 'text', text: 'Footnote body' }]
      }
    ]
  }
};

describe('RichText baseline renderer', () => {
  it('normalizes and renders the canonical W7-05 node baseline', () => {
    const nodes = normalizeLexicalRichText(lexicalFixture);
    const html = renderToStaticMarkup(
      <RichTextRenderer
        slug="payload-post"
        content={nodes}
        disallowedEmbedLabel="Blocked embed"
        inlineEmbedLabel="Inline embed"
      />
    );

    expect(html).toContain('rich-text-renderer');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<h4');
    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('underline');
    expect(html).toContain('line-through');
    expect(html).toContain('<code');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<ul');
    expect(html).toContain('<ol');
    expect(html).toContain('<blockquote');
    expect(html).toContain('<table');
    expect(html).toContain('<video');
    expect(html).toContain('<iframe');
    expect(html).toContain('footnote-note-1');
    expect(html).toContain('Inline embed');
    expect(html).not.toContain('<script');
  });

  it('fails closed when Payload Lexical root is invalid', () => {
    expect(() => normalizeLexicalRichText({ root: {} })).toThrow(RichTextValidationError);
  });

  it('renders unsafe link schemes as plain text (XSS protection)', () => {
    const unsafeSchemes = [
      'javascript:alert(1)',
      'data:text/html,<h1>xss</h1>',
      '//evil.example/xss'
    ];

    for (const unsafeHref of unsafeSchemes) {
      const nodes = normalizeLexicalRichText({
        root: {
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: unsafeHref,
                  children: [{ type: 'text', text: 'click me' }]
                }
              ]
            }
          ]
        }
      });

      const html = renderToStaticMarkup(
        <RichTextRenderer
          slug="xss-test"
          content={nodes}
          disallowedEmbedLabel="Blocked"
          inlineEmbedLabel="Inline"
        />
      );

      expect(html, `href ${unsafeHref} should not appear as <a> link`).not.toContain('<a ');
      expect(html).toContain('click me');
    }
  });

  it('renders safe link schemes as anchor elements', () => {
    const safeLinks = [
      { href: 'https://example.com', label: 'external' },
      { href: '/internal/path', label: 'internal' }
    ];

    for (const { href, label } of safeLinks) {
      const nodes = normalizeLexicalRichText({
        root: {
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: href,
                  children: [{ type: 'text', text: label }]
                }
              ]
            }
          ]
        }
      });

      const html = renderToStaticMarkup(
        <RichTextRenderer
          slug="safe-link-test"
          content={nodes}
          disallowedEmbedLabel="Blocked"
          inlineEmbedLabel="Inline"
        />
      );

      expect(html, `href ${href} should render as <a> link`).toContain('<a ');
      expect(html).toContain(label);
    }
  });

  it('fails closed when a RichText image has no alt text', () => {
    expect(() =>
      normalizeLexicalRichText({
        root: {
          children: [
            {
              type: 'image',
              src: '/images/blog/post-1.jpg',
              alt: ''
            }
          ]
        }
      })
    ).toThrow(RichTextValidationError);
  });
});