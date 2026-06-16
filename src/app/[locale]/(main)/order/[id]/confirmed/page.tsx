import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { ConfirmationPageContent } from '@/components/sections/ConfirmationPageContent/ConfirmationPageContent';

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'confirmation' });
  return {
    title: t('meta_title'),
    description: t('meta_description')
  };
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params;
  setRequestLocale(params.locale);

  return (
    <main
      id="main-content"
      className="container"
    >
      <StorefrontRouteStateSignal
        route="confirmation"
        surface="confirmation"
      />
      <StorefrontI18nLongContentProbe
        locale={params.locale}
        surface="confirmation-handoff"
      />
      <ConfirmationPageContent orderId={params.id} />
    </main>
  );
}
