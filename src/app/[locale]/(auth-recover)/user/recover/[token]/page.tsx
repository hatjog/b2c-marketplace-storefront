/**
 * W3-06 — Magic-link landing route (Story 5.3 v1.9.0 re-implementation).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review CRITICAL P0):
 *   - Click-to-continue pattern: token is exchanged ONLY after a user
 *     gesture (form POST). Email-link prefetch / SafeLinks scanners do
 *     NOT prematurely consume the single-use token.
 *   - On verify success the Server Action `verifyMagicLinkRecoverForm`
 *     sets the auth cookie and redirects to
 *     /[locale]/user/vouchers?welcome=recover (Story 5.3 AC12).
 *   - On verify failure the action redirects to /[locale]/user/recover?attempted=1
 *     (token-less; NFR16 prevents consumed-token persistence).
 *   - noindex/nofollow + no-referrer headers.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StorefrontI18nLongContentProbe } from '@/components/atoms';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { MagicLinkRecoverLandingState } from '@/components/molecules/MagicLinkRecoverLandingState/MagicLinkRecoverLandingState';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.magic_link_recover' });
  return {
    title: t('meta_title'),
    description: t('meta_description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: { 'Referrer-Policy': 'no-referrer' }
  };
}

export default async function RecoverTokenPage({ params }: PageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth.magic_link_recover' });
  const hasToken = typeof token === 'string' && token.length > 0;

  return (
    <AuthLayout
      surface="W3-06"
      locale={locale}
      eyebrow={t('landing.eyebrow')}
      pageTitle={t('landing.title')}
      subtitle={t('landing.subtitle')}
    >
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="voucher-recovery"
      />
      <MagicLinkRecoverLandingState
        locale={locale}
        token={hasToken ? token : undefined}
        mode={hasToken ? 'continue' : 'neutral'}
      />
    </AuthLayout>
  );
}
