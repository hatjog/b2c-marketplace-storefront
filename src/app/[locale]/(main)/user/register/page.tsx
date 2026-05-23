import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { InlineRegisterAuthForm } from '@/components/auth/AuthForms';
import { retrieveCart } from '@/lib/data/cart';
import { retrieveCustomer } from '@/lib/data/customer';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; email?: string }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  const user = await retrieveCustomer();
  const cart = await retrieveCart();
  const { order, email } = await searchParams;

  if (user) {
    redirect(`/${locale}/user`);
  }

  const inlineEmail = email ?? cart?.email ?? '';

  return (
    <main
      className="bb-page-shell"
      data-testid="user-inline-register-page"
    >
      <StorefrontRouteStateSignal
        route="user-account"
        surface="user-account"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="auth-inline-register"
      />
      <section className="mx-auto flex w-full max-w-[820px] flex-col gap-4 py-4 md:py-8">
        <header className="rounded-[20px] border border-[rgba(22,101,52,0.18)] bg-[rgba(22,101,52,0.08)] px-5 py-4 text-sm text-[var(--text-primary)]">
          {order
            ? t('inline.order_notice', { orderReference: order, email: inlineEmail })
            : t('inline.header_fallback', { email: inlineEmail || t('email_placeholder') })}
        </header>
        <InlineRegisterAuthForm
          email={inlineEmail}
          orderReference={order}
        />
      </section>
    </main>
  );
}
