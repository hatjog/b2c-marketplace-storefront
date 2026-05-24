import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

type AuthSurface = 'W3-01' | 'W3-02' | 'W3-03' | 'W3-04' | 'W3-05' | 'W3-06' | 'W3-07';

type TrustItem = {
  label: string;
  ariaLabel?: string;
};

type AuthLayoutProps = {
  children: React.ReactNode;
  surface: AuthSurface;
  locale: string;
  pageTitle: string;
  eyebrow?: string;
  subtitle?: string;
  footerSlot?: React.ReactNode;
  trustStripItems?: TrustItem[];
  showHomeLink?: boolean;
};

/**
 * AuthLayout T3 — focused auth shell (no SiteHeader, no SiteFooter, no MiniCart).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review HIGH-3 / review-5-2 re-land):
 *   - Removed hardcoded Polish strings (DEFAULT_TRUST_ITEMS, skip-link,
 *     home aria, trust-strip aria, footer links) and route them through
 *     `auth.layout.*` namespace in messages/{pl,en,ua,de}.json.
 *   - Component is async server component to read translations directly.
 */
export async function AuthLayout({
  children,
  surface,
  locale,
  pageTitle,
  eyebrow,
  subtitle,
  footerSlot,
  trustStripItems,
  showHomeLink = true
}: AuthLayoutProps) {
  const t = await getTranslations({ locale, namespace: 'auth.layout' });

  const items: TrustItem[] = trustStripItems ?? [
    {
      label: t('trust.marketplace_verified.label'),
      ariaLabel: t('trust.marketplace_verified.aria')
    },
    {
      label: t('trust.returns_30_days.label'),
      ariaLabel: t('trust.returns_30_days.aria')
    },
    {
      label: t('trust.support.label'),
      ariaLabel: t('trust.support.aria')
    }
  ];

  return (
    <div
      className="min-h-dvh bg-[var(--bb-gradient-page-warm)]"
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
        {t('skip_to_form')}
      </a>

      <div className="mx-auto flex min-h-[var(--auth-page-min-height)] w-full max-w-[1440px] flex-col px-4 py-5 md:px-5 md:py-6 lg:px-8 lg:py-8">
        <header
          role="banner"
          className="flex flex-col items-center gap-3 pb-8 md:pb-10"
        >
          {showHomeLink ? (
            <Link
              href={`/${locale}`}
              aria-label={t('home_aria')}
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
          tabIndex={-1}
          className="flex flex-1 items-center justify-center"
        >
          <section className="w-full max-w-[var(--auth-form-max-width)]">
            <div className="bb-card rounded-[28px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-strong)] p-6 md:p-8">
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
              aria-label={t('trust_aria')}
              className="mt-4 rounded-[24px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-82)] px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                {items.map(item => (
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
              className="underline decoration-[var(--bb-text-tint-22)] underline-offset-4"
            >
              {t('footer.terms')}
            </Link>
            <Link
              href={`/${locale}/polityka-prywatnosci`}
              className="underline decoration-[var(--bb-text-tint-22)] underline-offset-4"
            >
              {t('footer.privacy')}
            </Link>
            <Link
              href={`/${locale}/pomoc`}
              className="underline decoration-[var(--bb-text-tint-22)] underline-offset-4"
            >
              {t('footer.help')}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
