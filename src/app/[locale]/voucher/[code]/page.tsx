import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { StorefrontI18nLongContentProbe, StorefrontRouteStateSignal } from '@/components/atoms';
import { VoucherRecipientView } from '@/components/voucher/VoucherRecipientView';
import { getVoucherRecipientByCode } from '@/lib/data/voucher';

export const dynamic = 'force-dynamic';

interface VoucherRecipientPageProps {
  params: Promise<{ locale: string; code: string }>;
}

export async function generateMetadata({
  params,
}: VoucherRecipientPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'voucher.recipient.meta' });

  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
    other: {
      'Referrer-Policy': 'no-referrer',
    },
  };
}

export default async function VoucherRecipientPage({
  params,
}: VoucherRecipientPageProps) {
  const { locale, code } = await params;
  const voucher = await getVoucherRecipientByCode(code);

  return (
    <main
      id="main-content"
      data-testid="voucher-recipient-page"
      data-state={voucher?.state ?? 'expired'}
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(214,180,112,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(214,180,112,0.12),_transparent_28%)] bg-[#fcf7ef]"
    >
      <StorefrontRouteStateSignal
        route="voucher-recipient"
        surface="voucher-recipient"
      />
      <StorefrontI18nLongContentProbe
        locale={locale}
        surface="voucher-claim"
      />
      <VoucherRecipientView
        locale={locale}
        requestedCode={code}
        voucher={voucher}
      />
    </main>
  );
}
