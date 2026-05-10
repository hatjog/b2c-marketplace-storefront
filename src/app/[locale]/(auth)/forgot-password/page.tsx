import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { ForgotPasswordForm } from '@/components/molecules/ForgotPasswordForm/ForgotPasswordForm';

type ForgotPasswordPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: ForgotPasswordPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  return {
    title: t('forgot_password_heading'),
    description: t('forgot_password_description')
  };
}

export default async function ForgotPasswordPage({ params }: ForgotPasswordPageProps) {
  const { locale } = await params;
  return (
    <main
      id="main-content"
      className="container"
    >
      <StorefrontRouteStateSignal
        route="auth-forgot-password"
        surface="auth-forgot-password"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="account-recovery"
      />
      <ForgotPasswordForm />
    </main>
  );
}
