/**
 * Story v1.8.0-7-5: W5-05 Seller 404 variant.
 *
 * App Router not-found boundary for /[locale]/sellers/[handle].
 * Renders when getSellerByHandle returns null (seller not found).
 *
 * data-testid="seller-not-found" for E2E variant verification.
 * UX-DR20 EP-P1: no blame, empathic, one primary CTA.
 */
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function SellerNotFound() {
  const t = await getTranslations('not_found');

  return (
    <main
      id="main-content"
      data-testid="seller-not-found"
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
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px'
        }}
      >
        {/* 120px illustration per UX-DR20 EP-P1 */}
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
            fontSize: '2.5rem'
          }}
        >
          ✦
        </div>

        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: 400,
            color: 'var(--text-primary, #1A1A1A)',
            margin: 0
          }}
        >
          {t('headline')}
        </h1>

        <p
          style={{
            fontSize: '1rem',
            color: 'var(--text-secondary, #6B6252)',
            margin: 0,
            lineHeight: 1.6
          }}
        >
          {t('seller_body')}
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            width: '100%'
          }}
        >
          <Link
            href="/"
            data-testid="seller-not-found-cta-home"
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
            {t('cta_home')}
          </Link>

          <Link
            href="/?search=1"
            data-testid="seller-not-found-cta-search"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 24px',
              border: '1px solid var(--bb-border-soft, #E2D9C5)',
              background: 'transparent',
              color: 'var(--text-primary, #1A1A1A)',
              borderRadius: 'var(--radius-sm, 4px)',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.9375rem',
              fontWeight: 400,
              textDecoration: 'none',
              minHeight: '44px',
              minWidth: '44px'
            }}
          >
            {t('cta_search')}
          </Link>
        </div>
      </div>
    </main>
  );
}
