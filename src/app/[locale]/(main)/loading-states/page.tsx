/**
 * Story v1.8.0-7-5: W5-08 Loading states catalogue showcase.
 *
 * Route: /[locale]/loading-states
 *
 * Presents LP1-LP6 loading state patterns per UX-DR18.
 * All examples have aria-busy="true" and aria-live="polite" where applicable.
 * Reduced motion respected via CSS media query on shimmer animations.
 *
 * AC 6, AC 7, AC 8, AC 9, AC 10, AC 12.
 */
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Loading States Catalogue',
    robots: { index: false, follow: false }
  };
}

export default async function LoadingStatesCataloguePage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('loading_states_catalogue');

  return (
    <main
      id="main-content"
      data-testid="loading-states-page"
      style={{ padding: '48px 24px', fontFamily: 'inherit' }}
    >
      {/* Shimmer animation keyframes — reduced-motion safe */}
      <style>{`
        @keyframes bb-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-shimmer-anim { animation: none !important; background: var(--bb-surface-muted, #EDE8DC) !important; }
        }
        @keyframes bb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-pulse-anim { animation: none !important; }
        }
        @keyframes bb-spin {
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bb-spin-anim { animation: none !important; }
        }
      `}</style>

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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

          {/* LP1: Skeleton Shimmer */}
          <section
            aria-labelledby="lp1-heading"
            data-testid="loading-state-lp1"
          >
            <h2
              id="lp1-heading"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary, #1A1A1A)', marginBottom: '16px' }}
            >
              {t('lp1_prefix')} {t('lp1_name')}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '0.875rem', marginBottom: '16px' }}>{t('lp1_description')}</p>
            <div
              aria-busy="true"
              aria-live="polite"
              aria-label={t('lp1_aria_label')}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px' }}
            >
              {[80, 60, 70].map((w, i) => (
                <div
                  key={i}
                  className="bb-shimmer-anim"
                  style={{
                    height: '16px',
                    width: `${w}%`,
                    borderRadius: '4px',
                    background: 'var(--bb-gradient-loading-shimmer)',
                    backgroundSize: '200% 100%',
                    animation: 'bb-shimmer 1.5s ease-in-out infinite'
                  }}
                />
              ))}
            </div>
          </section>

          {/* LP2: Pulse Animation Hero */}
          <section
            aria-labelledby="lp2-heading"
            data-testid="loading-state-lp2"
          >
            <h2
              id="lp2-heading"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary, #1A1A1A)', marginBottom: '16px' }}
            >
              {t('lp2_prefix')} {t('lp2_name')}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '0.875rem', marginBottom: '16px' }}>{t('lp2_description')}</p>
            <div
              aria-busy="true"
              aria-live="polite"
              aria-label={t('lp2_aria_label')}
              className="bb-pulse-anim"
              style={{
                width: '200px',
                height: '120px',
                borderRadius: '8px',
                background: 'var(--bb-surface, #F5F0E8)',
                border: '1px solid var(--bb-border-soft, #E2D9C5)',
                animation: 'bb-pulse 2s ease-in-out infinite'
              }}
            />
          </section>

          {/* LP3: Skeleton Dot Trio */}
          <section
            aria-labelledby="lp3-heading"
            data-testid="loading-state-lp3"
          >
            <h2
              id="lp3-heading"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary, #1A1A1A)', marginBottom: '16px' }}
            >
              {t('lp3_prefix')} {t('lp3_name')}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '0.875rem', marginBottom: '16px' }}>{t('lp3_description')}</p>
            <button
              type="button"
              aria-busy="true"
              aria-live="polite"
              aria-label={t('lp3_aria_label')}
              disabled
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 24px',
                background: 'var(--bg-action, #907032)',
                border: 'none',
                borderRadius: 'var(--radius-sm, 4px)',
                cursor: 'not-allowed',
                opacity: 0.7,
                minHeight: '44px'
              }}
            >
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="bb-pulse-anim"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'var(--text-on-action, #FAF8F5)',
                    animation: `bb-pulse 1.4s ease-in-out ${i * 0.2}s infinite`
                  }}
                />
              ))}
            </button>
          </section>

          {/* LP4: Auto-Poll Progress Indicator */}
          <section
            aria-labelledby="lp4-heading"
            data-testid="loading-state-lp4"
          >
            <h2
              id="lp4-heading"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary, #1A1A1A)', marginBottom: '16px' }}
            >
              {t('lp4_prefix')} {t('lp4_name')}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '0.875rem', marginBottom: '16px' }}>{t('lp4_description')}</p>
            <div
              aria-busy="true"
              aria-live="polite"
              aria-label={t('lp4_aria_label')}
              style={{ maxWidth: '400px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.8125rem', color: 'var(--text-secondary, #6B6252)' }}>
                <span>{t('lp4_polling_label')}</span>
                <span>{t('lp4_timeout_label')}</span>
              </div>
              <div style={{ height: '6px', background: 'var(--bb-surface-muted, #EDE8DC)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  className="bb-shimmer-anim"
                  style={{
                    height: '100%',
                    width: '60%',
                    background: 'var(--bg-action, #907032)',
                    borderRadius: '3px',
                    animation: 'bb-shimmer 2s ease-in-out infinite'
                  }}
                />
              </div>
            </div>
          </section>

          {/* LP5: Progress Bar */}
          <section
            aria-labelledby="lp5-heading"
            data-testid="loading-state-lp5"
          >
            <h2
              id="lp5-heading"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary, #1A1A1A)', marginBottom: '16px' }}
            >
              {t('lp5_prefix')} {t('lp5_name')}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '0.875rem', marginBottom: '16px' }}>{t('lp5_description')}</p>
            <div
              aria-busy="true"
              aria-live="polite"
              aria-label={t('lp5_aria_label')}
              role="progressbar"
              aria-valuenow={65}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ maxWidth: '400px' }}
            >
              <div style={{ height: '8px', background: 'var(--bb-surface-muted, #EDE8DC)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '65%', background: 'var(--bg-action, #907032)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-secondary, #6B6252)', textAlign: 'right' }}>65%</div>
            </div>
          </section>

          {/* LP6: Inline Spinner */}
          <section
            aria-labelledby="lp6-heading"
            data-testid="loading-state-lp6"
          >
            <h2
              id="lp6-heading"
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary, #1A1A1A)', marginBottom: '16px' }}
            >
              {t('lp6_prefix')} {t('lp6_name')}
            </h2>
            <p style={{ color: 'var(--text-secondary, #6B6252)', fontSize: '0.875rem', marginBottom: '16px' }}>{t('lp6_description')}</p>
            <div
              aria-busy="true"
              aria-live="polite"
              aria-label={t('lp6_aria_label')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <div
                className="bb-spin-anim"
                role="presentation"
                style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid var(--bb-border-soft, #E2D9C5)',
                  borderTopColor: 'var(--bg-action, #907032)',
                  borderRadius: '50%',
                  animation: 'bb-spin 0.8s linear infinite'
                }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #6B6252)' }}>{t('lp6_label')}</span>
            </div>
            <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted, #8A7D6B)', fontStyle: 'italic' }}>
              {t('lp6_rare_last_resort_note')}
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}
