import sanitizeHtml from 'sanitize-html';

import { isAllowedIframeUrl } from '@/lib/blog';
import type { BlogInlineNode, BlogRichTextNode } from '@/types/blog';

import { RichTextValidationError } from './errors';

const TEXT_FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
  underline: 8,
  code: 16
} as const;

type LexicalNode = {
  type?: unknown;
  text?: unknown;
  tag?: unknown;
  listType?: unknown;
  url?: unknown;
  href?: unknown;
  format?: unknown;
  children?: unknown;
  value?: unknown;
  relationTo?: unknown;
  fields?: unknown;
  src?: unknown;
  title?: unknown;
  caption?: unknown;
  alt?: unknown;
  id?: unknown;
  label?: unknown;
  quote?: unknown;
  attribution?: unknown;
  citation?: unknown;
  html?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function childrenOf(node: LexicalNode): LexicalNode[] {
  return Array.isArray(node.children) ? (node.children as LexicalNode[]) : [];
}

function textFromInline(nodes: LexicalNode[]): string {
  return normalizeInline(nodes)
    .map(node => ('text' in node ? node.text : ''))
    .join('')
    .trim();
}

function hasFormat(format: unknown, flag: number) {
  return typeof format === 'number' && (format & flag) === flag;
}

function normalizeTextNode(node: LexicalNode): BlogInlineNode {
  const text = typeof node.text === 'string' ? node.text : '';

  if (hasFormat(node.format, TEXT_FORMAT.code)) {
    return { type: 'inline-code', text };
  }

  if (hasFormat(node.format, TEXT_FORMAT.bold)) {
    return { type: 'bold', text };
  }

  if (hasFormat(node.format, TEXT_FORMAT.italic)) {
    return { type: 'italic', text };
  }

  if (hasFormat(node.format, TEXT_FORMAT.underline)) {
    return { type: 'underline', text };
  }

  if (hasFormat(node.format, TEXT_FORMAT.strikethrough)) {
    return { type: 'strikethrough', text };
  }

  return { type: 'text', text };
}

function safeRichTextHref(href: string): string | null {
  if (href.startsWith('/') || href.startsWith('#')) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (/^mailto:/i.test(href)) return href;
  return null;
}

function normalizeInline(nodes: LexicalNode[]): BlogInlineNode[] {
  return nodes.flatMap((node, index): BlogInlineNode[] => {
    if (node.type === 'text') {
      return [normalizeTextNode(node)];
    }

    if (node.type === 'linebreak') {
      return [{ type: 'text', text: '\n' }];
    }

    if (node.type === 'link' || node.type === 'autolink') {
      const rawHref = asString(node.url) ?? asString(node.href);
      if (!rawHref) {
        return normalizeInline(childrenOf(node));
      }

      const href = safeRichTextHref(rawHref);
      if (!href) {
        // unsafe scheme (e.g. javascript:, data:, //evil): render text content without link
        return normalizeInline(childrenOf(node));
      }

      const text = textFromInline(childrenOf(node)) || href;
      return [
        {
          type: 'link',
          text,
          href,
          external: /^https?:\/\//i.test(href)
        }
      ];
    }

    if (node.type === 'reference') {
      return [
        {
          type: 'reference',
          footnoteId: asString(node.id) ?? `reference-${index + 1}`,
          label: asString(node.label) ?? String(index + 1)
        }
      ];
    }

    return normalizeInline(childrenOf(node));
  });
}

function normalizeList(node: LexicalNode): BlogRichTextNode | null {
  const items = childrenOf(node)
    .map(child => normalizeInline(childrenOf(child)))
    .filter(item => item.length > 0);

  if (items.length === 0) {
    return null;
  }

  return {
    type:
      node.listType === 'number' || node.listType === 'ordered' ? 'ordered-list' : 'unordered-list',
    items
  };
}

function mediaValue(node: LexicalNode) {
  return asRecord(node.value) ?? asRecord(node.fields) ?? asRecord(node);
}

function normalizeImage(node: LexicalNode): BlogRichTextNode {
  const value = mediaValue(node);
  const src = asString(value?.url) ?? asString(value?.src) ?? asString(node.src);
  const alt = asString(value?.alt) ?? asString(node.alt);

  if (!src) {
    throw new RichTextValidationError('RichText image node is missing src');
  }

  if (!alt) {
    throw new RichTextValidationError('RichText image node is missing required alt text');
  }

  return {
    type: 'image',
    src,
    alt,
    caption: asString(value?.caption) ?? asString(node.caption) ?? undefined
  };
}

function normalizeVideo(node: LexicalNode): BlogRichTextNode | null {
  const value = mediaValue(node);
  const src = asString(value?.url) ?? asString(value?.src) ?? asString(node.src);
  const title = asString(value?.title) ?? asString(node.title);

  if (!src || !title) {
    return null;
  }

  return {
    type: 'video',
    src,
    title,
    poster: asString(value?.poster) ?? undefined,
    caption: asString(value?.caption) ?? asString(node.caption) ?? undefined
  };
}

function extractIframeSrc(html: string) {
  const sanitized = sanitizeHtml(html, {
    allowedTags: ['iframe'],
    allowedAttributes: {
      iframe: ['src', 'title', 'allow', 'allowfullscreen', 'loading']
    },
    allowedSchemes: ['https']
  });
  const match = sanitized.match(/\ssrc=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function normalizeIframe(node: LexicalNode): BlogRichTextNode | null {
  const src =
    asString(node.src) ??
    (typeof node.html === 'string' ? extractIframeSrc(node.html) : null) ??
    null;

  if (!src || !isAllowedIframeUrl(src)) {
    return null;
  }

  return {
    type: 'embedded-iframe',
    src,
    title: asString(node.title) ?? 'Embedded media'
  };
}

function normalizeTable(node: LexicalNode): BlogRichTextNode | null {
  const rows = childrenOf(node).map(row =>
    childrenOf(row).map(cell => textFromInline(childrenOf(cell)) || '')
  );

  if (rows.length === 0 || rows[0]?.length === 0) {
    return null;
  }

  return {
    type: 'table',
    headers: rows[0] ?? [],
    rows: rows.slice(1),
    caption: asString(node.caption) ?? undefined
  };
}

function normalizeBlock(node: LexicalNode, index: number): BlogRichTextNode | null {
  switch (node.type) {
    case 'paragraph': {
      const content = normalizeInline(childrenOf(node));
      return content.length > 0 ? { type: 'paragraph', content } : null;
    }
    case 'heading': {
      const tag = asString(node.tag) ?? 'h2';
      const level = ['h1', 'h2', 'h3', 'h4'].includes(tag) ? tag.slice(1) : '2';
      const text = textFromInline(childrenOf(node));
      const type = `heading-${level}` as 'heading-1' | 'heading-2' | 'heading-3' | 'heading-4';
      return text ? { type, text } : null;
    }
    case 'list':
      return normalizeList(node);
    case 'quote':
    case 'blockquote':
      return {
        type: 'blockquote',
        quote: asString(node.quote) ?? textFromInline(childrenOf(node)),
        citation: asString(node.citation) ?? undefined
      };
    case 'pull-quote':
      return {
        type: 'pull-quote',
        quote: asString(node.quote) ?? textFromInline(childrenOf(node)),
        attribution: asString(node.attribution) ?? undefined
      };
    case 'upload':
    case 'image':
      return normalizeImage(node);
    case 'video':
      return normalizeVideo(node);
    case 'horizontalrule':
    case 'divider':
      return { type: 'divider' };
    case 'table':
      return normalizeTable(node);
    case 'iframe':
    case 'embedded-iframe':
    case 'embed':
      return normalizeIframe(node);
    case 'inline-embed':
      return {
        type: 'inline-embed',
        title: asString(node.title) ?? `Inline embed ${index + 1}`,
        href: asString(node.href) ?? '/',
        description: asString(node.caption) ?? textFromInline(childrenOf(node))
      };
    case 'footnote':
      return {
        type: 'footnote',
        id: asString(node.id) ?? `footnote-${index + 1}`,
        label: asString(node.label) ?? String(index + 1),
        content: textFromInline(childrenOf(node)) || asString(node.text) || ''
      };
    default:
      return null;
  }
}

export function normalizeLexicalRichText(input: unknown): BlogRichTextNode[] {
  const root = asRecord(input)?.root;
  const rootRecord = asRecord(root);
  const rootChildren = rootRecord?.children;

  if (!Array.isArray(rootChildren)) {
    throw new RichTextValidationError('Invalid Payload Lexical root shape');
  }

  const nodes = (rootChildren as LexicalNode[])
    .map((node, index) => normalizeBlock(node, index))
    .filter((node): node is BlogRichTextNode => Boolean(node));

  if (nodes.length === 0) {
    throw new RichTextValidationError('Payload Lexical content is empty');
  }

  return nodes;
}