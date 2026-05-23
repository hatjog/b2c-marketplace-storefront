import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontRouteStateSignal } from '@/components/atoms';
import { RegisterAuthForm } from '@/components/auth/AuthForms';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await retrieveCustomer();
  const t = await getTranslations({ locale, namespace: 'auth' });

  if (user) {
    redirect(`/${locale}/user`);
  }

  return (
    <AuthLayout
      surface="W3-02"
      locale={locale}
      eyebrow={t('register_eyebrow')}
      pageTitle={t('register_title')}
      subtitle={t('register_subtitle')}
    >
      <StorefrontRouteStateSignal
        route="auth-register"
        surface="auth-register"
      />
      <RegisterAuthForm />
    </AuthLayout>
  );
}
