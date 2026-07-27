import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { ResetPasswordAuthForm } from '@/components/auth/AuthForms';
import { AuthLayout } from '@/components/templates/AuthLayout';

type ResetPasswordPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
};

export async function generateMetadata({ params }: ResetPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('reset_title'),
    description: t('reset_subtitle')
  };
}

export default async function ResetPasswordPage({ params, searchParams }: ResetPasswordPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <AuthLayout
      surface="W3-04"
      locale={locale}
      eyebrow={t('reset_eyebrow')}
      pageTitle={t('reset_title')}
      subtitle={t('reset_subtitle')}
    >
      <StorefrontRouteStateSignal
        route="auth-forgot-password"
        surface="auth-forgot-password"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="password-reset"
      />
      <ResetPasswordAuthForm token={token} />
    </AuthLayout>
  );
}
