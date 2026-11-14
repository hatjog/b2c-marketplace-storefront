import { getTranslations } from 'next-intl/server';

import { VoucherRecipientStateScreen } from '@/components/voucher/VoucherRecipientStateScreen';
import { projectVoucherRecipientPage } from '@/lib/data/voucher-recipient-projection';

/**
 * v1.16.0 Story 6.9 AC1: loading state of the recipient page. Uses the same
 * projection as the page (state `loading`); no code or personal data is shown.
 */
export default async function VoucherRecipientLoading() {
  const t = await getTranslations('voucher.recipient');
  const projection = projectVoucherRecipientPage(null, { locale: 'pl', code: '' });

  return (
    <main
      id="main-content"
      data-testid="voucher-recipient-loading"
      data-state={projection.state}
      className="min-h-screen bg-[var(--bb-gradient-page-warm)]"
    >
      <VoucherRecipientStateScreen projection={projection} t={(key) => t(key as never)} />
    </main>
  );
}
