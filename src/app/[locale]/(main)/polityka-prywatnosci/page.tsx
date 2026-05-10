import { readFileSync } from 'fs';
import { join } from 'path';

import type { ReactNode } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { LegalPageLayout } from '@/components/templates/LegalPageLayout';

export const dynamic = 'force-static';

function parseLegalMarkdown(markdown: string): ReactNode[] {
  const lines = markdown.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function nextKey() {
    return `md-${key++}`;
  }

  function renderInline(text: string): ReactNode {
    // Handle **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    if (parts.length === 1) return text;
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  while (i < lines.length) {
    const line = lines[i];

    // Skip YAML-like front matter lines and horizontal rules and footer notes
    if (
      line.startsWith('Status:') ||
      line.startsWith('Data:') ||
      line.startsWith('Podstawa') ||
      line.startsWith('Uwaga:') ||
      line.startsWith('---') ||
      line.startsWith('_Zaktualizowano') ||
      line.startsWith('_BonBeauty') ||
      line.startsWith('# Polityka')
    ) {
      i++;
      continue;
    }

    // H2
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
          {line.slice(3)}
        </h2>
      );
      i++;
      continue;
    }

    // H3
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
          {line.slice(4)}
        </h3>
      );
      i++;
      continue;
    }

    // Table block — collect all | lines
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      // Parse header (first row), separator (second row with ---), body (rest)
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
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  style={{ borderBottom: '1px solid var(--bb-border-soft)' }}
                >
                  {row.map((cell, cellIdx) => (
                    <td
                      key={cellIdx}
                      style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}
                    >
                      {renderInline(cell)}
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

    // Unordered list item
    if (line.startsWith('- ')) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        listItems.push(lines[i].slice(2));
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
          {listItems.map((item, idx) => (
            <li
              key={idx}
              style={{ marginBottom: '0.25rem' }}
            >
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ''));
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
          {listItems.map((item, idx) => (
            <li
              key={idx}
              style={{ marginBottom: '0.25rem' }}
            >
              {renderInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Regular paragraph
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
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function loadPrivacyPolicyContent(): { nodes: ReactNode[]; lastUpdated: string } {
  const candidates = [
    join(process.cwd(), '..', '..', 'specs', 'ops', 'privacy-policy-draft-v120.md'),
    join(process.cwd(), 'specs', 'ops', 'privacy-policy-draft-v120.md')
  ];
  let content: string | undefined;
  for (const candidate of candidates) {
    try {
      content = readFileSync(candidate, 'utf-8');
      break;
    } catch {
      // try next candidate
    }
  }
  if (!content) {
    throw new Error(`Privacy policy source file not found. Tried:\n${candidates.join('\n')}`);
  }

  const dateMatch = content.match(/^Data:\s*(.+)$/m);
  const lastUpdated = dateMatch ? dateMatch[1].trim() : '2026-03-17';

  return { nodes: parseLegalMarkdown(content), lastUpdated };
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return {
    title: t('title_privacy'),
    description: t('privacy_description'),
    robots: { index: false, follow: false }
  };
}

export default async function PolitykaPrywatnosciPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('legal');
  const tWL = await getTranslations('voucher_withdrawal.legal');
  const { nodes, lastUpdated } = loadPrivacyPolicyContent();

  return (
    <LegalPageLayout>
      <article data-testid="privacy-policy-content">
        <StorefrontRouteStateSignal
          route="legal-polityka-prywatnosci"
          surface="legal-polityka-prywatnosci"
        />
        <StorefrontI18nLongContentProbe
          locale={locale}
          surface="legal-privacy"
        />
        <header style={{ marginBottom: '2rem' }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}
          >
            {t('title_privacy')}
          </h1>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)'
            }}
          >
            {t('last_updated')}: {lastUpdated}
          </p>
        </header>

        <div>{nodes}</div>

        {/* Review fix M6: cross-link note disambiguating RODO consent vs.
            FR64 consumer-purchase withdrawal so a customer landing here
            looking for "withdrawal" is steered to the right surface. */}
        <aside
          aria-labelledby="privacy-vs-consumer-withdrawal-heading"
          data-testid="privacy-vs-consumer-withdrawal-note"
          style={{
            marginTop: '2.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--bb-border-soft)'
          }}
        >
          <h2
            id="privacy-vs-consumer-withdrawal-heading"
            className="sr-only"
          >
            {tWL('section_title')}
          </h2>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9375rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.6
            }}
          >
            {tWL('privacy_cross_link_note')}
          </p>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9375rem' }}>
            <Link
              href={`/${locale}/regulamin`}
              style={{
                color: 'var(--text-primary)',
                textDecoration: 'underline',
                marginRight: '1rem'
              }}
              data-testid="privacy-link-regulamin"
            >
              {t('title_regulamin')}
            </Link>
            <Link
              href={`/${locale}/pomoc`}
              style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}
              data-testid="privacy-link-pomoc"
            >
              {tWL('contact_support')}
            </Link>
          </p>
        </aside>
      </article>
    </LegalPageLayout>
  );
}
