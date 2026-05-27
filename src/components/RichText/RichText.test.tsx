import type { ReactNode } from 'react';

import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { RichTextDocument, RichTextNode } from '@/types/richtext';

import publicFixture from '../../../__tests__/richtext/twenty-nodes.json';
import canonicalFixture from './__fixtures__/twenty-nodes.json';
import { collectRichTextNodeTypes, RICH_TEXT_NODE_TYPES } from './helpers';
import { RichText } from './index';

vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, ...props }: Record<string, unknown>) => (
    <img
      src={String(src)}
      alt={String(alt)}
      width={Number(width)}
      height={Number(height)}
      {...props}
    />
  )
}));

vi.mock('@/components/molecules/LocalizedLink/LocalizedLink', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a
      href={href}
      {...props}
    >
      {children}
    </a>
  )
}));

const fixture = canonicalFixture as RichTextDocument;

const nodeCases = [
  ['paragraph', '<p'],
  ['heading-h1', '<h1'],
  ['heading-h2', '<h2'],
  ['heading-h3', '<h3'],
  ['heading-h4', '<h4'],
  ['heading-h5', '<h5'],
  ['heading-h6', '<h6'],
  ['heading-h2-repeat', 'cms-baseline-second-section-8'],
  ['bold', '<strong'],
  ['italic', '<em'],
  ['code', '<code'],
  ['link', 'rel="noopener noreferrer"'],
  ['link-aria-label', 'aria-label="External editorial reference"'],
  ['list-ordered', '<ol'],
  ['list-unordered', '<ul'],
  ['listitem-ordered-a', '<li><span>First ordered item</span></li>'],
  ['listitem-ordered-b', 'Second ordered item with'],
  ['quote', '<blockquote'],
  ['hr', '<hr'],
  ['image', 'alt="Editorial product arrangement"'],
  ['embed', '<iframe']
] as const;

describe('Renderer CMS RichText', () => {
  it('renderuje fixture twenty-nodes bez wyjatku', () => {
    expect(() => renderToStaticMarkup(<RichText document={fixture} />)).not.toThrow();
  });

  it.each(nodeCases)('renderuje przypadek %s z fixture', (_nodeCase, expectedMarkup) => {
    const html = renderToStaticMarkup(
      <RichText
        document={fixture}
        idBase="cms-baseline"
      />
    );

    expect(html).toContain(expectedMarkup);
  });

  it('utrzymuje canonical fixture w zgodzie z wymaganym kontraktem node types', () => {
    const renderedTypes = collectRichTextNodeTypes(fixture);

    for (const nodeType of RICH_TEXT_NODE_TYPES) {
      expect(renderedTypes.has(nodeType), `${nodeType} missing from fixture`).toBe(true);
    }
  });

  it('generuje deterministyczne heading id wspolnym slug patternem', () => {
    const html = renderToStaticMarkup(
      <RichText
        document={fixture}
        idBase="cms-baseline"
      />
    );

    expect(html).toContain('id="cms-baseline-cms-richtext-baseline-2"');
    expect(html).toContain('id="cms-baseline-editorial-hierarchy-3"');
  });

  it('rzuca wyjatek, gdy image node ma pusty alt text', () => {
    const document = [
      {
        type: 'image',
        src: '/images/blog/post-1.jpg',
        alt: '',
        width: 1200,
        height: 800
      }
    ] as unknown as RichTextDocument;

    expect(() => renderToStaticMarkup(<RichText document={document} />)).toThrow(
      'RichText image alt must be a non-empty string'
    );
  });

  it('renderuje null i ostrzega dla embed URL spoza whitelist providera', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const document = [
      {
        type: 'embed',
        provider: 'youtube',
        src: 'https://evil.example.com/embed/1',
        title: 'Blocked embed'
      }
    ] as RichTextDocument;

    const html = renderToStaticMarkup(<RichText document={document} />);

    expect(html).not.toContain('<iframe');
    expect(warn).toHaveBeenCalledWith(
      'RichText embed blocked for provider "youtube": https://evil.example.com/embed/1'
    );

    warn.mockRestore();
  });

  it('renderuje null i ostrzega dla nieznanego node type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const document = [{ type: 'unknown-node', children: [] }] as unknown as RichTextDocument;

    const html = renderToStaticMarkup(<RichText document={document} />);

    expect(html).not.toContain('unknown-node');
    expect(warn).toHaveBeenCalledWith('Unknown RichText node type: unknown-node');

    warn.mockRestore();
  });

  it('spelnia per-node accessibility contract zakodowany w fixture', () => {
    const html = renderToStaticMarkup(
      <RichText
        document={fixture}
        idBase="cms-baseline"
      />
    );

    expect(html).toContain('<h1');
    expect(html.indexOf('<h1')).toBeLessThan(html.indexOf('<h2'));
    expect(html).toContain('aria-label="External editorial reference"');
    expect(html).toContain('alt="Editorial product arrangement"');
    expect(html).toContain('title="CMS RichText embedded video"');
    expect(html).toContain('<ol');
    expect(html).toContain('<ul');
    expect(html).toContain('<li>');
    expect(html).toContain('bg-[var(--bb-tint-gold-12)]');
  });

  it('nie ma critical violations w axe scan dla fixture', async () => {
    const html = renderToStaticMarkup(
      <RichText
        document={fixture}
        idBase="cms-baseline"
      />
    );
    const dom = new JSDOM(`<!doctype html><html lang="pl"><body>${html}</body></html>`, {
      runScripts: 'dangerously'
    });

    dom.window.eval(axe.source);

    const results = await (
      dom.window as unknown as {
        axe: {
          run: (context: Document) => Promise<{ violations: Array<{ impact: string | null }> }>;
        };
      }
    ).axe.run(dom.window.document);

    expect(results.violations.filter(violation => violation.impact === 'critical')).toEqual([]);
  });

  it('utrzymuje kopie fixture w __tests__ zgodna z canonical fixture', () => {
    expect(publicFixture).toEqual(canonicalFixture);
  });
});
