import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { ForgotPasswordAuthForm } from '@/components/auth/AuthForms';
import { AuthLayout } from '@/components/templates/AuthLayout';

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('forgot_title'),
    description: t('forgot_subtitle')
  };
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return (
    <AuthLayout
      surface="W3-03"
      locale={locale}
      eyebrow={t('forgot_eyebrow')}
      pageTitle={t('forgot_title')}
      subtitle={t('forgot_subtitle')}
    >
      <StorefrontRouteStateSignal
        route="auth-forgot-password"
        surface="auth-forgot-password"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="account-recovery"
      />
      <ForgotPasswordAuthForm />
    </AuthLayout>
  );
}
