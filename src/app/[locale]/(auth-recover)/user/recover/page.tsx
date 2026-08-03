/**
 * W3-05 — Magic-link request page (Story 5.3 v1.9.0 re-implementation).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review CRITICAL P0):
 *   - Wraps `AuthLayout` T3 slim shell.
 *   - Renders `MagicLinkRecoverForm` per Story 5.3 AC1-3.
 *   - `?attempted=1` query (set by failed verify in W3-06) surfaces a
 *     neutral message asking the user to request a fresh link.
 *   - `noindex/nofollow` + `no-referrer` headers — token-bearing surfaces.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthLayout } from '@/components/templates/AuthLayout';
import { MagicLinkRecoverForm } from '@/components/molecules/MagicLinkRecoverForm/MagicLinkRecoverForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ attempted?: string; email?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth.magic_link_recover' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: { 'Referrer-Policy': 'no-referrer' }
  };
}

export default async function RecoverRequestPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { attempted, email } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'auth.magic_link_recover' });

  return (
    <AuthLayout
      surface="W3-05"
      locale={locale}
      eyebrow={t('request_eyebrow')}
      pageTitle={t('request_title')}
      subtitle={t('request_subtitle')}
    >
      {attempted ? (
        <p
          role="status"
          className="mb-4 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-3 text-sm text-[var(--text-primary)]"
          data-testid="magic-link-recover-attempted"
        >
          {t('request_attempted_notice')}
        </p>
      ) : null}
      <MagicLinkRecoverForm
        locale={locale}
        initialEmail={email}
      />
    </AuthLayout>
  );
}
