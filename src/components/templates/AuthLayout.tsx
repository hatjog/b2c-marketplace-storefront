import Image from 'next/image';
import Link from 'next/link';

type AuthSurface = 'W3-01' | 'W3-02' | 'W3-03' | 'W3-04' | 'W3-05' | 'W3-06' | 'W3-07';

type AuthLayoutProps = {
  children: React.ReactNode;
  surface: AuthSurface;
  locale: string;
  pageTitle: string;
  eyebrow?: string;
  subtitle?: string;
  footerSlot?: React.ReactNode;
  trustStripItems?: Array<{
    label: string;
    ariaLabel?: string;
  }>;
  showHomeLink?: boolean;
};

const DEFAULT_TRUST_ITEMS = [
  { label: 'Zweryfikowany marketplace', ariaLabel: 'Zweryfikowany marketplace BonBeauty' },
  { label: '30 dni na zwrot', ariaLabel: 'Do trzydziestu dni na zwrot' },
  { label: 'Wsparcie po polsku', ariaLabel: 'Wsparcie klienta w języku polskim' }
];

export function AuthLayout({
  children,
  surface,
  locale,
  pageTitle,
  eyebrow,
  subtitle,
  footerSlot,
  trustStripItems = DEFAULT_TRUST_ITEMS,
  showHomeLink = true
}: AuthLayoutProps) {
  return (
    <div
      className="min-h-dvh bg-[linear-gradient(135deg,rgba(249,244,236,1)_0%,rgba(244,241,235,1)_100%)]"
      data-auth-surface={surface}
      style={
        {
          '--auth-form-max-width': '480px',
          '--auth-page-min-height': '100dvh'
        } as React.CSSProperties
      }
    >
      <a
        href="#auth-form-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--bb-surface)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--text-primary)]"
      >
        Przejdź do formularza
      </a>

      <div className="mx-auto flex min-h-[var(--auth-page-min-height)] w-full max-w-[1440px] flex-col px-4 py-5 md:px-5 md:py-6 lg:px-8 lg:py-8">
        <header
          role="banner"
          className="flex flex-col items-center gap-3 pb-8 md:pb-10"
        >
          {showHomeLink ? (
            <Link
              href={`/${locale}`}
              className="inline-flex items-center gap-3 rounded-full px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
            >
              <Image
                src="/bonbeauty/logo/bonbeauty-logo-monogram-dark.svg"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-base font-medium tracking-[0.12em] text-[var(--text-primary)]">
                BonBeauty
              </span>
            </Link>
          ) : (
            <div className="inline-flex items-center gap-3">
              <Image
                src="/bonbeauty/logo/bonbeauty-logo-monogram-dark.svg"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-base font-medium tracking-[0.12em] text-[var(--text-primary)]">
                BonBeauty
              </span>
            </div>
          )}
        </header>

        <main
          id="auth-form-main"
          role="main"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center"
        >
          <section className="w-full max-w-[var(--auth-form-max-width)]">
            <div className="bb-card rounded-[28px] border border-[var(--bb-border-soft)] bg-[rgba(255,252,247,0.96)] p-6 md:p-8">
              <div className="mb-6 space-y-3">
                {eyebrow ? <p className="bb-eyebrow">{eyebrow}</p> : null}
                <h1 className="heading-md text-[var(--text-primary)]">{pageTitle}</h1>
                {subtitle ? (
                  <p className="text-md text-[var(--text-secondary)]">{subtitle}</p>
                ) : null}
              </div>
              {children}
            </div>

            <section
              aria-label="Security and trust information"
              className="mt-4 rounded-[24px] border border-[var(--bb-border-soft)] bg-[rgba(255,252,247,0.82)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {trustStripItems.map(item => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]"
                    aria-label={item.ariaLabel ?? item.label}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full bg-[var(--color-trust)]"
                    />
                    {item.label}
                  </span>
                ))}
              </div>
            </section>

            {footerSlot ? <div className="mt-4">{footerSlot}</div> : null}
          </section>
        </main>

        <footer
          role="contentinfo"
          className="pt-6 text-center text-sm text-[var(--text-secondary)]"
        >
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href={`/${locale}/regulamin`}
              className="underline decoration-[rgba(26,26,26,0.22)] underline-offset-4"
            >
              Regulamin
            </Link>
            <Link
              href={`/${locale}/polityka-prywatnosci`}
              className="underline decoration-[rgba(26,26,26,0.22)] underline-offset-4"
            >
              Polityka prywatności
            </Link>
            <Link
              href={`/${locale}/pomoc`}
              className="underline decoration-[rgba(26,26,26,0.22)] underline-offset-4"
            >
              Pomoc
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
