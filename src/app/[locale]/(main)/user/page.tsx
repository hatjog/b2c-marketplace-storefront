import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { StorefrontI18nLongContentProbe } from '@/components/atoms';
import { UserNavigation } from '@/components/molecules';
import { retrieveCustomer } from '@/lib/data/customer';

export default async function UserPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await retrieveCustomer();
  const t = await getTranslations({ locale, namespace: 'user' });

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return (
    <main id="main-content" className="container">
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="account"
      />
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-4 md:gap-8">
        <UserNavigation />
        <div className="md:col-span-3">
          <h1 className="heading-xl uppercase">{t('welcome_heading', { firstName: user.first_name })}</h1>
          <p className="label-md">{t('welcome_subheading')}</p>
        </div>
      </div>
    </main>
  );
}
