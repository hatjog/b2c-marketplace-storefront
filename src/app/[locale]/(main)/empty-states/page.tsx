/**
 * Story v1.8.0-7-5: W5-07 Empty states catalogue showcase.
 *
 * Route: /[locale]/empty-states
 *
 * Visual reference and SSOT showcase for ES1-ES8 empty state patterns.
 * Source: specs/design-system/bonbeauty/empty-states.yaml
 *
 * Each pattern: 80px icon, h3, body, max-width 480px, exactly ONE primary CTA
 * or passive/no-CTA state per catalogue contract. Tap targets >= 44x44.
 *
 * AC 4, AC 5, AC 7, AC 8, AC 9, AC 10, AC 12.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Empty States Catalogue',
    robots: { index: false, follow: false }
  };
}

interface EmptyStatePatternProps {
  code: string;
  icon: string;
  headline: string;
  body: string;
  cta?: { label: string; href: string };
  passive?: boolean;
}

function EmptyStatePattern({ code, icon, headline, body, cta, passive }: EmptyStatePatternProps) {
  return (
    <section
      aria-labelledby={`es-heading-${code}`}
      data-testid={`empty-state-${code.toLowerCase()}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
        padding: '32px 24px',
        background: 'var(--bb-surface, #F5F0E8)',
        borderRadius: '8px',
        border: '1px solid var(--bb-border-soft, #E2D9C5)',
        gap: '16px'
      }}
    >
      {/* 80px icon */}
      <div
        aria-hidden="true"
        style={{
          width: '80px',
          height: '80px',
          fontSize: '2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {icon}
      </div>

      <h3
        id={`es-heading-${code}`}
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '1.25rem',
          fontWeight: 400,
          color: 'var(--text-primary, #1A1A1A)',
          margin: 0
        }}
      >
        {headline}
      </h3>

      <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary, #6B6252)', margin: 0, lineHeight: 1.6 }}>
        {body}
      </p>

      {cta && !passive && (
        <Link
          href={cta.href}
          data-testid={`empty-state-${code.toLowerCase()}-cta`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 24px',
            background: 'var(--bg-action, #907032)',
            color: 'var(--text-on-action, #FAF8F5)',
            borderRadius: 'var(--radius-sm, 4px)',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.9rem',
            fontWeight: 500,
            textDecoration: 'none',
            minHeight: '44px',
            minWidth: '44px'
          }}
        >
          {cta.label}
        </Link>
      )}

      <span
        style={{
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          color: 'var(--text-muted, #8A7D6B)',
          padding: '2px 8px',
          background: 'var(--bb-surface-muted, #EDE8DC)',
          borderRadius: '3px'
        }}
      >
        {code}
      </span>
    </section>
  );
}

export default async function EmptyStatesCataloguePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('empty_states_catalogue');

  const patterns: EmptyStatePatternProps[] = [
    {
      code: 'ES1',
      icon: '♡',
      headline: t('es1_headline'),
      body: t('es1_body'),
      cta: { label: t('es1_cta'), href: `/${locale}/categories` }
    },
    {
      code: 'ES2',
      icon: '◻',
      headline: t('es2_headline'),
      body: t('es2_body'),
      cta: { label: t('es2_cta'), href: `/${locale}/categories` }
    },
    {
      code: 'ES3',
      icon: '⊕',
      headline: t('es3_headline'),
      body: t('es3_body'),
      cta: { label: t('es3_cta'), href: `/${locale}` }
    },
    {
      code: 'ES4',
      icon: '⊘',
      headline: t('es4_headline'),
      body: t('es4_body'),
      cta: { label: t('es4_cta'), href: `/${locale}/categories` }
    },
    {
      code: 'ES5',
      icon: '☆',
      headline: t('es5_headline'),
      body: t('es5_body'),
      cta: { label: t('es5_cta'), href: `/${locale}` }
    },
    {
      code: 'ES6',
      icon: '✉',
      headline: t('es6_headline'),
      body: t('es6_body'),
      passive: true
    },
    {
      code: 'ES7',
      icon: '✎',
      headline: t('es7_headline'),
      body: t('es7_body'),
      cta: { label: t('es7_cta'), href: `/${locale}` }
    },
    {
      code: 'ES8',
      icon: '⌂',
      headline: t('es8_headline'),
      body: t('es8_body'),
      cta: { label: t('es8_cta'), href: `/${locale}/user/addresses` }
    }
  ];

  return (
    <main
      id="main-content"
      data-testid="empty-states-page"
      style={{ padding: '48px 24px', fontFamily: 'inherit' }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '48px', textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 'clamp(2rem, 4vw, 3rem)',
              fontWeight: 300,
              color: 'var(--text-primary, #1A1A1A)',
              marginBottom: '0.5rem'
            }}
          >
            {t('page_title')}
          </h1>
          <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '1rem' }}>
            {t('page_description')}
          </p>
        </header>

        <div
          role="list"
          aria-label={t('catalogue_label')}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px',
            justifyItems: 'center'
          }}
        >
          {patterns.map(pattern => (
            <div
              key={pattern.code}
              role="listitem"
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            >
              <EmptyStatePattern {...pattern} />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
