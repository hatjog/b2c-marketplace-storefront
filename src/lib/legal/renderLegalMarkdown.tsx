// @legal-signal-scope: v180
/**
 * Story v190-wf3-legal-docs-recovery: legal markdown → React renderer.
 *
 * Pure structural renderer that handles the subset of markdown used in
 * gp-ops/markets/<market>/legal/portal/<doc>/master*.md:
 *
 *   - H1 (#), H2 (##), H3 (###)
 *   - Paragraphs
 *   - Unordered lists (- item)
 *   - Ordered lists (1. item)
 *   - GFM tables (| h | h | / |---|---|)
 *   - Inline **bold**
 *   - Inline `code`
 *   - Blockquotes (>)
 *   - Fenced code blocks (```)
 *
 * Stdlib-only (no remark/unified pulled into the client bundle). Front-matter
 * MUST already be stripped by fetchLegalDocument; this renderer treats `---`
 * outside of table separators as horizontal-rule markers.
 */

import type { ReactNode } from 'react';

const KEY_PREFIX = 'lmd';

function inline(text: string, keyBase: string): ReactNode[] {
  // First split on `code` spans, then handle **bold** inside the non-code parts.
  const out: ReactNode[] = [];
  let codeKey = 0;
  const codeParts = text.split(/(`[^`]+`)/g);
  for (const part of codeParts) {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      out.push(
        <code
          key={`${keyBase}-c${codeKey++}`}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            background: 'var(--bb-surface-muted, rgba(0,0,0,0.05))',
            padding: '0.1em 0.3em',
            borderRadius: '0.2em',
            fontSize: '0.92em'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
      continue;
    }
    const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
    for (let i = 0; i < boldParts.length; i++) {
      const bp = boldParts[i];
      if (bp.startsWith('**') && bp.endsWith('**') && bp.length > 2) {
        out.push(<strong key={`${keyBase}-b${codeKey++}`}>{bp.slice(2, -2)}</strong>);
      } else if (bp) {
        out.push(bp);
      }
    }
  }
  return out;
}

export function renderLegalMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split('\n');
  const nodes: ReactNode[] = [];
  let key = 0;
  const nextKey = () => `${KEY_PREFIX}-${key++}`;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule
    if (line.trim() === '---') {
      nodes.push(
        <hr
          key={nextKey()}
          style={{
            border: 0,
            borderTop: '1px solid var(--bb-border-soft, rgba(0,0,0,0.1))',
            margin: '1.5rem 0'
          }}
        />
      );
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith('```')) {
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // skip closing fence
      if (i < lines.length) i++;
      nodes.push(
        <pre
          key={nextKey()}
          style={{
            background: 'var(--bb-surface-muted, rgba(0,0,0,0.04))',
            padding: '1rem',
            borderRadius: '0.375rem',
            overflowX: 'auto',
            fontSize: '0.875rem',
            lineHeight: 1.5,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            margin: '1rem 0'
          }}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      nodes.push(
        <h1
          key={nextKey()}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: 300,
            color: 'var(--text-primary)',
            marginTop: '0',
            marginBottom: '1rem'
          }}
        >
          {inline(line.slice(2), nextKey())}
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(
        <h2
          key={nextKey()}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.25rem, 2vw, 2rem)',
            fontWeight: 400,
            color: 'var(--text-primary)',
            marginTop: '2rem',
            marginBottom: '0.75rem'
          }}
        >
          {inline(line.slice(3), nextKey())}
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      nodes.push(
        <h3
          key={nextKey()}
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.1rem, 1.5vw, 1.625rem)',
            fontWeight: 500,
            color: 'var(--text-primary)',
            marginTop: '1.5rem',
            marginBottom: '0.5rem'
          }}
        >
          {inline(line.slice(4), nextKey())}
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ') || line === '>') {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      nodes.push(
        <blockquote
          key={nextKey()}
          style={{
            borderLeft: '3px solid var(--bb-border-soft, rgba(0,0,0,0.2))',
            paddingLeft: '1rem',
            margin: '1rem 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            lineHeight: 1.6
          }}
        >
          {inline(quoteLines.join(' '), nextKey())}
        </blockquote>
      );
      continue;
    }

    // Table block
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      const rows = tableLines.filter(l => !l.match(/^\|[-| :]+\|$/));
      const parsedRows = rows.map(row =>
        row
          .split('|')
          .slice(1, -1)
          .map(cell => cell.trim())
      );
      if (parsedRows.length === 0) continue;
      const [header, ...body] = parsedRows;
      nodes.push(
        <div
          key={nextKey()}
          style={{ overflowX: 'auto', marginTop: '1rem', marginBottom: '1rem' }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              color: 'var(--text-primary)'
            }}
          >
            <thead>
              <tr>
                {header.map((cell, idx) => (
                  <th
                    key={idx}
                    scope="col"
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      borderBottom: '2px solid var(--text-secondary)',
                      fontWeight: 600
                    }}
                  >
                    {inline(cell, `${nextKey()}-th${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{ borderBottom: '1px solid var(--bb-border-soft, rgba(0,0,0,0.1))' }}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}
                    >
                      {inline(cell, `${nextKey()}-td${rowIdx}-${cellIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Unordered list
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <ul
          key={nextKey()}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            paddingLeft: '1.5rem',
            marginTop: '0.5rem',
            marginBottom: '0.75rem',
            listStyleType: 'disc'
          }}
        >
          {items.map((item, idx) => (
            <li
              key={idx}
              style={{ marginBottom: '0.25rem' }}
            >
              {inline(item, `${nextKey()}-li${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      nodes.push(
        <ol
          key={nextKey()}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            paddingLeft: '1.5rem',
            marginTop: '0.5rem',
            marginBottom: '0.75rem'
          }}
        >
          {items.map((item, idx) => (
            <li
              key={idx}
              style={{ marginBottom: '0.25rem' }}
            >
              {inline(item, `${nextKey()}-oli${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Default: paragraph
    nodes.push(
      <p
        key={nextKey()}
        style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: '1rem',
          lineHeight: 1.6,
          color: 'var(--text-primary)',
          marginTop: '0.5rem',
          marginBottom: '0.5rem'
        }}
      >
        {inline(line, nextKey())}
      </p>
    );
    i++;
  }

  return nodes;
}
