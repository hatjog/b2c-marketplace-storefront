import type { ReactNode } from 'react';

import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { buildHeadingId } from '@/lib/blog';
import type {
  RichTextDocument,
  RichTextHeadingLevel,
  RichTextInlineNode,
  RichTextLinkNode,
  RichTextNode
} from '@/types/richtext';

import { assertNonEmptyString, getPlainText, isAllowedEmbedUrl, isExternalHref } from './helpers';

type RichTextProps = {
  document: RichTextDocument;
  idBase?: string;
  className?: string;
};

function warnRichText(message: string) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(message);
  }
}

function renderLink(node: RichTextLinkNode, key: string) {
  const accessibleLabel = node.ariaLabel || node.text;
  assertNonEmptyString(accessibleLabel, 'link aria label');

  if (node.external ?? isExternalHref(node.href)) {
    return (
      <a
        key={key}
        href={node.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={accessibleLabel}
        className="font-medium text-primary underline decoration-[1.5px] underline-offset-4"
      >
        {node.text}
      </a>
    );
  }

  return (
    <LocalizedClientLink
      key={key}
      href={node.href}
      aria-label={accessibleLabel}
      className="font-medium text-primary underline decoration-[1.5px] underline-offset-4"
    >
      {node.text}
    </LocalizedClientLink>
  );
}

function renderInlineNode(node: RichTextInlineNode, key: string): ReactNode {
  if (!('type' in node)) {
    return <span key={key}>{node.text}</span>;
  }

  switch (node.type) {
    case 'bold':
      return <strong key={key}>{node.text}</strong>;
    case 'italic':
      return <em key={key}>{node.text}</em>;
    case 'code':
      return (
        <code
          key={key}
          className="whitespace-pre-wrap break-words rounded-md bg-[var(--bb-tint-gold-12)] px-1.5 py-0.5 font-mono text-[0.95em] text-primary"
        >
          {node.text}
        </code>
      );
    case 'link':
      return renderLink(node, key);
  }
}

function renderInline(children: RichTextInlineNode[]) {
  return children.map((child, index) =>
    renderInlineNode(child, `${'type' in child ? child.type : 'text'}-${index}`)
  );
}

function getHeadingLevel(type: RichTextNode['type']): RichTextHeadingLevel | null {
  if (!type.startsWith('heading-h')) {
    return null;
  }

  return Number(type.replace('heading-h', '')) as RichTextHeadingLevel;
}

function renderNode(node: RichTextNode, index: number, idBase: string) {
  switch (node.type) {
    case 'paragraph':
      return (
        <p
          key={`${node.type}-${index}`}
          className="text-base leading-8 text-primary"
        >
          {renderInline(node.children)}
        </p>
      );
    case 'heading-h1':
    case 'heading-h2':
    case 'heading-h3':
    case 'heading-h4':
    case 'heading-h5':
    case 'heading-h6': {
      const level = getHeadingLevel(node.type) ?? 2;
      const Tag = `h${level}` as const;
      const headingText = getPlainText(node.children);

      return (
        <Tag
          key={`${node.type}-${index}`}
          id={buildHeadingId(idBase, headingText, index)}
          className="scroll-mt-28 text-balance font-[var(--font-heading)] font-semibold text-primary"
        >
          {renderInline(node.children)}
        </Tag>
      );
    }
    case 'list-ordered':
    case 'list-unordered': {
      const Tag = node.type === 'list-ordered' ? 'ol' : 'ul';
      return (
        <Tag
          key={`${node.type}-${index}`}
          className="space-y-3 pl-5 text-primary"
        >
          {node.children.map((item, itemIndex) => (
            <li key={`${node.type}-${index}-${itemIndex}`}>{renderInline(item.children)}</li>
          ))}
        </Tag>
      );
    }
    case 'listitem':
      return <li key={`${node.type}-${index}`}>{renderInline(node.children)}</li>;
    case 'quote':
      return (
        <blockquote
          key={`${node.type}-${index}`}
          className="border-l-4 border-[var(--bg-action)] pl-5 text-lg italic text-secondary"
        >
          <p>{renderInline(node.children)}</p>
          {node.citation ? (
            <footer className="mt-3 text-sm not-italic">{node.citation}</footer>
          ) : null}
        </blockquote>
      );
    case 'hr':
      return (
        <hr
          key={`${node.type}-${index}`}
          className="border-[var(--bb-border-soft)]"
        />
      );
    case 'image':
      assertNonEmptyString(node.alt, 'image alt');
      return (
        <figure
          key={`${node.type}-${index}`}
          className="space-y-3"
        >
          <Image
            src={node.src}
            alt={node.alt}
            width={node.width ?? 1200}
            height={node.height ?? 800}
            unoptimized={node.width == null || node.height == null}
            className="h-auto w-full rounded-lg object-cover"
          />
          {node.caption ? (
            <figcaption className="text-sm leading-6 text-secondary">{node.caption}</figcaption>
          ) : null}
        </figure>
      );
    case 'embed':
      assertNonEmptyString(node.title, 'embed title');
      if (!isAllowedEmbedUrl(node.provider, node.src)) {
        warnRichText(`RichText embed blocked for provider "${node.provider}": ${node.src}`);
        return null;
      }

      return (
        <div
          key={`${node.type}-${index}`}
          className="overflow-hidden rounded-lg border border-[var(--bb-border-soft)]"
        >
          <iframe
            src={node.src}
            title={node.title}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      );
    default:
      warnRichText(`Unknown RichText node type: ${(node as { type?: string }).type ?? 'missing'}`);
      return null;
  }
}

export function RichText({ document, idBase = 'cms-richtext', className }: RichTextProps) {
  return (
    <div
      className={className ?? 'mx-auto max-w-[720px] space-y-6 text-base leading-8 text-primary'}
      data-testid="cms-richtext"
    >
      {document.map((node, index) => renderNode(node, index, idBase))}
    </div>
  );
}

export default RichText;
