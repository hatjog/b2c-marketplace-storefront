import type { ReactNode } from 'react';

import Image from 'next/image';

import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import { buildHeadingId, isAllowedIframeUrl } from '@/lib/blog';
import type { BlogInlineNode, BlogRichTextNode } from '@/types/blog';

function renderInlineNode(node: BlogInlineNode, key: string): ReactNode {
  switch (node.type) {
    case 'bold':
      return <strong key={key}>{node.text}</strong>;
    case 'italic':
      return <em key={key}>{node.text}</em>;
    case 'underline':
      return (
        <span
          key={key}
          className="underline decoration-[1.5px]"
        >
          {node.text}
        </span>
      );
    case 'strikethrough':
      return (
        <span
          key={key}
          className="line-through"
        >
          {node.text}
        </span>
      );
    case 'inline-code':
      return (
        <code
          key={key}
          className="rounded-md bg-[rgba(144,112,50,0.12)] px-1.5 py-0.5 font-mono text-[0.95em]"
        >
          {node.text}
        </code>
      );
    case 'link':
      if (node.external) {
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
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
          className="font-medium text-primary underline decoration-[1.5px] underline-offset-4"
        >
          {node.text}
        </LocalizedClientLink>
      );
    case 'reference':
      return (
        <sup key={key}>
          <a
            href={`#footnote-${node.footnoteId}`}
            className="font-medium text-primary underline decoration-[1.5px] underline-offset-2"
          >
            {node.label}
          </a>
        </sup>
      );
    case 'text':
    default:
      return <span key={key}>{node.text}</span>;
  }
}

function renderInline(nodes: BlogInlineNode[]) {
  return nodes.map((node, index) => renderInlineNode(node, `${node.type}-${index}`));
}

export function BlogRichText({
  content,
  slug,
  disallowedEmbedLabel,
  inlineEmbedLabel
}: {
  content: BlogRichTextNode[];
  slug: string;
  disallowedEmbedLabel: string;
  inlineEmbedLabel: string;
}) {
  return (
    <div
      className="space-y-6 text-base leading-8 text-primary"
      data-testid="blog-post-richtext"
    >
      {content.map((node, index) => {
        switch (node.type) {
          case 'paragraph':
            return (
              <p
                key={`${node.type}-${index}`}
                className="text-base leading-8 text-primary"
              >
                {renderInline(node.content)}
              </p>
            );
          case 'heading-1':
          case 'heading-2':
          case 'heading-3':
          case 'heading-4': {
            const headingId = buildHeadingId(slug, node.text, index);
            const level = node.type === 'heading-4' ? 4 : node.type === 'heading-3' ? 3 : 2;
            const Tag = `h${level}` as const;

            return (
              <Tag
                key={`${node.type}-${index}`}
                id={headingId}
                className="scroll-mt-28 text-balance font-[var(--font-heading)] text-primary"
              >
                {node.text}
              </Tag>
            );
          }
          case 'ordered-list':
          case 'unordered-list': {
            const Tag = node.type === 'ordered-list' ? 'ol' : 'ul';
            return (
              <Tag
                key={`${node.type}-${index}`}
                className="space-y-3 pl-5"
              >
                {node.items.map((item, itemIndex) => (
                  <li key={`${node.type}-${index}-${itemIndex}`}>{renderInline(item)}</li>
                ))}
              </Tag>
            );
          }
          case 'blockquote':
            return (
              <blockquote
                key={`${node.type}-${index}`}
                className="border-l-4 border-[var(--bg-action)] pl-5 text-lg italic text-secondary"
              >
                <p>{node.quote}</p>
                {node.citation ? (
                  <footer className="mt-3 text-sm not-italic">{node.citation}</footer>
                ) : null}
              </blockquote>
            );
          case 'pull-quote':
            return (
              <aside
                key={`${node.type}-${index}`}
                className="rounded-[28px] bg-[rgba(144,112,50,0.08)] px-6 py-8 text-center"
              >
                <p className="heading-sm text-primary">“{node.quote}”</p>
                {node.attribution ? (
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-secondary">
                    {node.attribution}
                  </p>
                ) : null}
              </aside>
            );
          case 'inline-embed':
            return (
              <LocalizedClientLink
                key={`${node.type}-${index}`}
                href={node.href}
                className="block rounded-[24px] border border-[rgba(144,112,50,0.14)] bg-white p-5 transition-opacity hover:opacity-90"
              >
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">
                  {inlineEmbedLabel}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-primary">{node.title}</h3>
                <p className="mt-2 text-sm leading-6 text-secondary">{node.description}</p>
              </LocalizedClientLink>
            );
          case 'image':
            return (
              <figure
                key={`${node.type}-${index}`}
                className="space-y-3"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[rgba(144,112,50,0.08)]">
                  <Image
                    src={node.src}
                    alt={node.alt}
                    fill
                    sizes="(min-width: 1024px) 720px, 100vw"
                    className="object-cover"
                  />
                </div>
                {node.caption ? (
                  <figcaption className="text-sm leading-6 text-secondary">
                    {node.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          case 'video':
            return (
              <figure
                key={`${node.type}-${index}`}
                className="space-y-3"
              >
                <video
                  controls
                  preload="metadata"
                  poster={node.poster}
                  className="w-full rounded-[24px] bg-black"
                  aria-label={node.title}
                >
                  <source src={node.src} />
                </video>
                {node.caption ? (
                  <figcaption className="text-sm leading-6 text-secondary">
                    {node.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          case 'divider':
            return (
              <hr
                key={`${node.type}-${index}`}
                className="border-[rgba(144,112,50,0.14)]"
              />
            );
          case 'table':
            return (
              <figure
                key={`${node.type}-${index}`}
                className="space-y-3 overflow-x-auto"
              >
                <table className="min-w-full border-collapse rounded-[20px] border border-[rgba(144,112,50,0.14)] text-left">
                  <thead className="bg-[rgba(144,112,50,0.08)]">
                    <tr>
                      {node.headers.map(header => (
                        <th
                          key={header}
                          className="px-4 py-3 text-sm font-semibold text-primary"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {node.rows.map((row, rowIndex) => (
                      <tr
                        key={`${node.type}-row-${rowIndex}`}
                        className="border-t border-[rgba(144,112,50,0.14)]"
                      >
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${node.type}-cell-${rowIndex}-${cellIndex}`}
                            className="px-4 py-3 text-sm leading-6 text-secondary"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {node.caption ? (
                  <figcaption className="text-sm leading-6 text-secondary">
                    {node.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          case 'embedded-iframe':
            return isAllowedIframeUrl(node.src) ? (
              <div
                key={`${node.type}-${index}`}
                className="overflow-hidden rounded-[24px] border border-[rgba(144,112,50,0.14)]"
              >
                <iframe
                  src={node.src}
                  title={node.title}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  className="aspect-video w-full"
                />
              </div>
            ) : (
              <p
                key={`${node.type}-${index}`}
                className="rounded-[20px] bg-[rgba(144,112,50,0.08)] p-4 text-sm text-secondary"
              >
                {disallowedEmbedLabel}
              </p>
            );
          case 'footnote':
            return (
              <div
                key={`${node.type}-${index}`}
                id={`footnote-${node.id}`}
                className="rounded-[20px] border border-[rgba(144,112,50,0.14)] bg-white px-4 py-3 text-sm leading-6 text-secondary"
              >
                <span className="font-semibold text-primary">{node.label}. </span>
                {node.content}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
