import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { ConfirmationPageContent } from '@/components/sections/ConfirmationPageContent/ConfirmationPageContent';
import { resolveConfirmationPurchase } from '@/lib/data/confirmation-purchase';

/**
 * Stan potwierdzenia jest ZMIENNY (dostawa vouchera dzieje się po zakupie),
 * a segment `[id]` jest rozwijany serwerowo w kolekcję zamówień. ISR
 * zwracałoby tu współdzieloną migawkę cudzego zakupu — `force-dynamic` jest
 * wymagane, tak samo jak na `/order/[id]/payment-status`.
 */
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'confirmation' });
  return {
    title: t('meta_title'),
    description: t('meta_description')
  };
}

/**
 * v1.15.0 Story 3.7 (AC1) — segment `[id]` niesie IDENTYFIKATOR ZAKUPU,
 * a nie jednego zamówienia.
 *
 * Do tej story było tu `<ConfirmationPageContent orderId={params.id} />`, czyli
 * jeden identyfikator na całą powierzchnię — a powierzchnia statusu płatności
 * nawigowała tu przez `/order/${orderId}/confirmed`. Naprawa samego komponentu
 * niczego by nie zmieniła: drugie zamówienie nie miałoby jak dojechać.
 *
 * Rozwinięcie zakupu w kolekcję dzieje się SERWEROWO (mostek
 * `GET /store/carts/:id/completed-order`, który niesie też `order_count`).
 * Uzasadnienie wyboru tego nośnika — razem z odrzuconymi wariantami — jest
 * w `@/lib/confirmation/confirmation-purchase`.
 */
export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params;
  setRequestLocale(params.locale);

  const purchase = await resolveConfirmationPurchase(params.id);

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
      <ConfirmationPageContent purchase={purchase} />
    </main>
  );
}
