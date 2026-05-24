interface LoadingStatePattern {
  code: string;
  title: string;
  body: string;
}

function Demo({ code }: { code: string }) {
  switch (code) {
    case 'LP1':
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          style={{ display: 'grid', gap: '0.75rem' }}
        >
          <div className="h-6 w-2/3 rounded-sm bg-[var(--bb-skeleton-base)] motion-reduce:animate-none animate-pulse" />
          <div className="h-4 w-full rounded-sm bg-[var(--bb-skeleton-base)] motion-reduce:animate-none animate-pulse" />
          <div className="h-4 w-4/5 rounded-sm bg-[var(--bb-skeleton-base)] motion-reduce:animate-none animate-pulse" />
        </div>
      );
    case 'LP2':
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="flex h-28 items-center justify-center rounded-2xl bg-[var(--bb-surface-90)] motion-reduce:animate-none animate-pulse"
        >
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Processing…</span>
        </div>
      );
    case 'LP3':
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="flex min-h-[44px] items-center gap-2"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={index}
              className="h-3 w-3 rounded-full bg-[var(--text-primary)] motion-reduce:animate-none animate-bounce"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
      );
    case 'LP4':
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Odswieżamy status co 15 sekund</strong>
          <div style={{ height: '10px', borderRadius: '999px', backgroundColor: 'var(--bb-muted-80)' }}>
            <div
              className="h-full rounded-full bg-[var(--bg-primary)] motion-reduce:animate-none animate-pulse"
              style={{ width: '58%' }}
            />
          </div>
        </div>
      );
    case 'LP5':
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          style={{ display: 'grid', gap: '0.5rem' }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>Krok 2 z 3</strong>
          <div style={{ height: '12px', borderRadius: '999px', backgroundColor: 'var(--bb-muted-80)' }}>
            <div style={{ width: '66%', height: '100%', borderRadius: '999px', backgroundColor: 'var(--bg-primary)' }} />
          </div>
        </div>
      );
    default:
      return (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="flex min-h-[44px] items-center gap-3"
        >
          <span
            className="inline-block h-5 w-5 rounded-full border-2 border-[var(--bb-tint-gold-24)] border-t-[var(--bg-primary)] motion-reduce:animate-none animate-spin"
            aria-hidden="true"
          />
          <span style={{ color: 'var(--text-secondary)' }}>Przechodzimy do kolejnego kroku…</span>
        </div>
      );
  }
}

export function LoadingStatesCatalogue({
  title,
  description,
  patterns,
}: {
  title: string;
  description: string;
  patterns: LoadingStatePattern[];
}) {
  return (
    <main
      data-testid="loading-states-page"
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
              data-testid={`loading-pattern-${pattern.code}`}
              style={{
                borderRadius: '2rem',
                border: '1px solid var(--bb-border-soft, rgba(113,88,40,0.12))',
                backgroundColor: 'var(--bb-white-90)',
                padding: '1.5rem',
                display: 'grid',
                gap: '1rem',
              }}
            >
              <div style={{ minHeight: '124px', borderRadius: '1.5rem', padding: '1rem', backgroundColor: 'var(--bb-cream-90)' }}>
                <Demo code={pattern.code} />
              </div>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
                  {pattern.code} · {pattern.title}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{pattern.body}</p>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
