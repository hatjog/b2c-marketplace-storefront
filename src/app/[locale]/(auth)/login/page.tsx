import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { LoginAuthForm } from '@/components/auth/AuthForms';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await retrieveCustomer();
  const t = await getTranslations({ locale, namespace: 'auth' });

  if (user) {
    redirect(`/${locale}/user`);
  }

  return (
    <AuthLayout
      surface="W3-01"
      locale={locale}
      eyebrow={t('login_eyebrow')}
      pageTitle={t('login_title')}
      subtitle={t('login_subtitle')}
    >
      <StorefrontRouteStateSignal
        route="auth-login"
        surface="auth-login"
      />
      <LoginAuthForm />
    </AuthLayout>
  );
}
