/**
 * Story v1.8.0-7-5: W5-06 Global error/offline variants — runtime error preview.
 *
 * Route: /[locale]/error?variant=server-error|service-unavailable|offline
 *
 * This route is a catalogue preview page for error states, NOT a real error
 * boundary. Real error boundaries are error.tsx and global-error.tsx.
 *
 * Provides [data-testid="runtime-error-preview"] with [data-variant] attribute
 * for E2E visual regression and variant verification.
 *
 * UX-DR20 EP-P2/P3: system-wide vs local distinction, status page link,
 * 3-tier support paths, expandable technical details.
 * Recovery-as-care: no blame, calm tone, one primary CTA per variant.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { ErrorReloadButton } from '@/components/atoms/ErrorReloadButton/ErrorReloadButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Error preview',
    robots: { index: false, follow: false }
  };
}

const STATUS_PAGE_URL = process.env.NEXT_PUBLIC_STATUS_PAGE_URL ?? 'https://status.bonbeauty.pl';

type ErrorVariant = 'server-error' | 'service-unavailable' | 'offline';

function getVariant(raw: string | undefined): ErrorVariant {
  if (raw === 'service-unavailable' || raw === 'offline') return raw;
  return 'server-error';
}

export default async function ErrorPreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ variant?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const variant = getVariant(resolvedSearchParams.variant);

  const t = await getTranslations('error_surface');

  const headlineKey = variant === 'server-error'
    ? 'server_error_headline'
    : variant === 'service-unavailable'
    ? 'service_unavailable_headline'
    : 'offline_headline';

  const bodyKey = variant === 'server-error'
    ? 'server_error_body'
    : variant === 'service-unavailable'
    ? 'service_unavailable_body'
    : 'offline_body';

  const ctaKey = variant === 'server-error'
    ? 'server_error_cta'
    : variant === 'service-unavailable'
    ? 'service_unavailable_cta'
    : 'offline_cta';

  const statusLabel = variant === 'server-error' ? '500' : variant === 'service-unavailable' ? '503' : t('offline_label');

  return (
    <main
      id="main-content"
      role={variant === 'server-error' || variant === 'service-unavailable' ? 'alert' : 'status'}
      aria-live="polite"
      data-testid="runtime-error-preview"
      data-variant={variant}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '48px 24px',
        textAlign: 'center',
        fontFamily: 'inherit'
      }}
    >
      <div style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
        {/* Hero illustration */}
        <div
          aria-hidden="true"
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'var(--bb-surface, #F5F0E8)',
            border: '2px solid var(--bb-border-soft, #E2D9C5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: variant === 'offline' ? '2.25rem' : '1.75rem',
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            color: 'var(--text-secondary, #6B6252)'
          }}
        >
          {statusLabel}
        </div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
            fontWeight: 400,
            color: 'var(--text-primary, #1A1A1A)',
            margin: 0
          }}
        >
          {t(headlineKey)}
        </h1>

        <p style={{ fontSize: '1rem', color: 'var(--text-secondary, #6B6252)', margin: 0, lineHeight: 1.6 }}>
          {t(bodyKey)}
        </p>

        {/* Primary CTA — one per variant (AC 3) */}
        {variant === 'offline' ? (
          <ErrorReloadButton label={t(ctaKey)} />
        ) : (
          <Link
            href={`/${locale}`}
            data-testid="error-cta-home"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 28px',
              background: 'var(--bg-action, #907032)',
              color: 'var(--text-on-action, #FAF8F5)',
              borderRadius: 'var(--radius-sm, 4px)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9375rem',
              fontWeight: 500,
              textDecoration: 'none',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            {t(ctaKey)}
          </Link>
        )}

        {/* Status page link — system signal per AC 3 */}
        {(variant === 'server-error' || variant === 'service-unavailable') && (
          <a
            href={STATUS_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="error-status-page-link"
            style={{
              color: 'var(--text-secondary, #6B6252)',
              fontSize: '0.875rem',
              textDecoration: 'underline'
            }}
          >
            {t('status_page_link')}
          </a>
        )}

        {/* Expandable technical details — hidden by default (AC 3) */}
        <details
          data-testid="error-technical-details"
          style={{ width: '100%', textAlign: 'left', fontSize: '0.8125rem', color: 'var(--text-muted, #8A7D6B)' }}
        >
          <summary
            style={{ cursor: 'pointer', padding: '8px 0', userSelect: 'none', color: 'var(--text-secondary, #6B6252)' }}
          >
            {t('show_technical_details')}
          </summary>
          <div
            style={{
              marginTop: '8px',
              padding: '12px',
              background: 'var(--bb-surface, #F5F0E8)',
              borderRadius: '4px',
              fontFamily: 'monospace',
              wordBreak: 'break-all',
              userSelect: 'text'
            }}
          >
            <p style={{ margin: '0 0 4px' }}>
              <strong>variant:</strong> {variant}
            </p>
            <p style={{ margin: '0 0 4px' }}>
              <strong>timestamp:</strong> <span data-testid="error-timestamp">{new Date().toISOString()}</span>
            </p>
            <p style={{ margin: 0 }}>
              <strong>{t('suggested_action')}:</strong> {t('suggested_action_value')}
            </p>
          </div>
        </details>
      </div>
    </main>
  );
}
