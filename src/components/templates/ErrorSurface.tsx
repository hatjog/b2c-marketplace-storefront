import type { ReactNode } from 'react';

type ErrorSurfaceTone = 'neutral' | 'error' | 'warning';

interface ErrorSurfaceProps {
  title: string;
  description: string;
  eyebrow?: string;
  role?: 'alert' | 'status';
  tone?: ErrorSurfaceTone;
  primaryAction: ReactNode;
  secondaryAction?: ReactNode;
  utilityLink?: ReactNode;
  technicalDetailsLabel?: string;
  technicalDetails?: {
    requestId: string;
    timestampIso: string;
    suggestedAction: string;
  };
  supportTitle?: string;
  supportPaths?: Array<{ id: string; label: string; description: string }>;
  'data-testid'?: string;
}

const toneMap: Record<ErrorSurfaceTone, { border: string; badgeBg: string; badgeText: string }> = {
  neutral: {
    border: 'var(--bb-border-soft, rgba(113,88,40,0.12))',
    badgeBg: 'rgba(144,112,50,0.12)',
    badgeText: 'var(--text-primary)',
  },
  error: {
    border: 'rgba(176, 44, 44, 0.24)',
    badgeBg: 'rgba(176, 44, 44, 0.12)',
    badgeText: '#7c2626',
  },
  warning: {
    border: 'rgba(181, 126, 0, 0.24)',
    badgeBg: 'rgba(181, 126, 0, 0.12)',
    badgeText: '#7a5a11',
  },
};

export function ErrorSurface({
  title,
  description,
  eyebrow,
  role,
  tone = 'neutral',
  primaryAction,
  secondaryAction,
  utilityLink,
  technicalDetailsLabel,
  technicalDetails,
  supportTitle,
  supportPaths = [],
  'data-testid': dataTestId,
}: ErrorSurfaceProps) {
  const colors = toneMap[tone];

  return (
    <main
      data-testid={dataTestId ?? 'error-surface'}
      style={{
        minHeight: 'calc(100vh - 6rem)',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--bb-gradient-seller-radial)',
        padding: '2rem 1.5rem 4rem',
      }}
    >
      <section
        aria-live={role === 'status' ? 'polite' : undefined}
        role={role}
        style={{
          width: '100%',
          maxWidth: '48rem',
          border: `1px solid ${colors.border}`,
          borderRadius: '2rem',
          backgroundColor: 'var(--bb-white-90)',
          boxShadow: 'var(--bb-shadow-seller-soft)',
          padding: 'clamp(1.5rem, 4vw, 3rem)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            alignItems: 'flex-start',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '999px',
              border: `1px solid ${colors.border}`,
              background: 'var(--bb-gradient-seller-card)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '999px',
                backgroundColor: colors.badgeBg,
                color: colors.badgeText,
                display: 'grid',
                placeItems: 'center',
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: '2rem',
                fontWeight: 600,
              }}
            >
              B
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {eyebrow ? (
              <span
                style={{
                  display: 'inline-flex',
                  width: 'fit-content',
                  minHeight: '44px',
                  alignItems: 'center',
                  padding: '0 1rem',
                  borderRadius: '999px',
                  backgroundColor: colors.badgeBg,
                  color: colors.badgeText,
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                {eyebrow}
              </span>
            ) : null}

            <h1
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontSize: 'clamp(2.2rem, 5vw, 4rem)',
                lineHeight: 1,
                margin: 0,
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: '42rem',
                fontSize: '1.0625rem',
                lineHeight: 1.7,
                color: 'var(--text-secondary)',
              }}
            >
              {description}
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            {primaryAction}
            {secondaryAction}
          </div>

          {utilityLink ? <div>{utilityLink}</div> : null}

          {supportPaths.length > 0 ? (
            <div
              style={{
                width: '100%',
                borderTop: `1px solid ${colors.border}`,
                paddingTop: '1.25rem',
              }}
            >
              {supportTitle ? (
                <h2
                  style={{
                    margin: '0 0 1rem',
                    fontSize: '1rem',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    color: 'var(--text-primary)',
                  }}
                >
                  {supportTitle}
                </h2>
              ) : null}
              <ul
                style={{
                  listStyle: 'none',
                  display: 'grid',
                  gap: '0.875rem',
                  padding: 0,
                  margin: 0,
                }}
              >
                {supportPaths.map((path) => (
                  <li key={path.id}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{path.label}</strong>
                    <span style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {path.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {technicalDetails && technicalDetailsLabel ? (
            <details
              style={{
                width: '100%',
                borderTop: `1px solid ${colors.border}`,
                paddingTop: '1rem',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  minHeight: '44px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                }}
              >
                {technicalDetailsLabel}
              </summary>
              <dl
                style={{
                  margin: '1rem 0 0',
                  display: 'grid',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <dt style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>request_id</dt>
                  <dd style={{ margin: '0.25rem 0 0' }}>
                    <code
                      style={{
                        userSelect: 'all',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {technicalDetails.requestId}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>timestamp</dt>
                  <dd style={{ margin: '0.25rem 0 0', color: 'var(--text-primary)' }}>
                    <time dateTime={technicalDetails.timestampIso}>{technicalDetails.timestampIso}</time>
                  </dd>
                </div>
                <div>
                  <dt style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>suggested_action</dt>
                  <dd style={{ margin: '0.25rem 0 0', color: 'var(--text-primary)' }}>
                    {technicalDetails.suggestedAction}
                  </dd>
                </div>
              </dl>
            </details>
          ) : null}
        </div>
      </section>
    </main>
  );
}
