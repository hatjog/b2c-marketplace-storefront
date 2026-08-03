/**
 * W3-07 — Post-checkout inline-register surface (Story 5.2).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review HIGH-2):
 *   - Moved from (main) → (auth-recover) route group to drop full Wave 6
 *     chrome leakage (SiteHeader / SiteFooter / MiniCart / MobileBottomNav)
 *     and consume AuthLayout T3 slim shell per Story 5.4 AC10 / UX-DR12.
 *   - Same business logic as v1.8.0 implementation: inline register prompted
 *     after a successful checkout with order context.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { InlineRegisterAuthForm } from '@/components/auth/AuthForms';
import { AuthLayout } from '@/components/templates/AuthLayout';
import { retrieveCart } from '@/lib/data/cart';
import { retrieveCustomer } from '@/lib/data/customer';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; email?: string }>;
};

export default async function Page({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'auth' });
  const user = await retrieveCustomer();
  const cart = await retrieveCart();
  const { order, email } = await searchParams;

  if (user) {
    redirect(`/${locale}/user`);
  }

  const inlineEmail = email ?? cart?.email ?? '';

  return (
    <AuthLayout
      surface="W3-07"
      locale={locale}
      eyebrow={t('register_eyebrow')}
      pageTitle={t('register_title')}
      subtitle={t('register_subtitle')}
    >
      <StorefrontRouteStateSignal
        route="user-account"
        surface="user-account"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="auth-inline-register"
      />
      <header className="mb-4 rounded-[var(--bb-radius-panel)] border border-[var(--bb-trust-tint-18)] bg-[var(--bb-trust-card-bg)] px-5 py-4 text-sm text-[var(--text-primary)]">
        {order
          ? t('inline.order_notice', { orderReference: order, email: inlineEmail })
          : t('inline.header_fallback', { email: inlineEmail || t('email_placeholder') })}
      </header>
      <InlineRegisterAuthForm
        email={inlineEmail}
        orderReference={order}
      />
    </AuthLayout>
  );
}
