import Link from 'next/link';

interface EmptyStatePattern {
  id: string;
  code: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  note?: string;
}

export function EmptyStatesCatalogue({
  title,
  description,
  patterns,
  locale,
}: {
  title: string;
  description: string;
  patterns: EmptyStatePattern[];
  locale: string;
}) {
  return (
    <main
      data-testid="empty-states-page"
      style={{ padding: '2rem 1rem 4rem', backgroundColor: 'var(--bb-page-bg)' }}
    >
      <div style={{ maxWidth: '80rem', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
        <header style={{ display: 'grid', gap: '0.75rem', maxWidth: '46rem' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: '"Cormorant Garamond", serif',
              fontSize: 'clamp(2.25rem, 5vw, 4rem)',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{description}</p>
        </header>

        <section
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {patterns.map((pattern) => (
            <article
              key={pattern.code}
              data-testid={`empty-pattern-${pattern.code}`}
              style={{
                borderRadius: '2rem',
                border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
                backgroundColor: 'var(--bb-white-90)',
                padding: '1.5rem',
                display: 'grid',
                gap: '1rem',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--bb-muted-72)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                {pattern.code}
              </div>
              <div style={{ maxWidth: '480px', display: 'grid', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>{pattern.title}</h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{pattern.body}</p>
              </div>
              {pattern.ctaLabel && pattern.ctaHref ? (
                <Link
                  href={`/${locale}${pattern.ctaHref}`}
                  className="inline-flex min-h-[44px] w-fit items-center justify-center rounded-sm bg-action px-5 py-3 text-sm font-medium text-action-on-primary no-underline"
                >
                  {pattern.ctaLabel}
                </Link>
              ) : (
                <p style={{ margin: 0, minHeight: '44px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {pattern.note}
                </p>
              )}
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
