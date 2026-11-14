import Link from 'next/link';

import type { VoucherRecipientPageProjection } from '@/lib/data/voucher-recipient-projection';

/**
 * v1.16.0 Story 6.9 (FR-20, FR-30, NFR-4): screen for the non-entitlement
 * states of the recipient page (loading, pending, voided, forbidden,
 * not_found, technical_error). Copy comes only from `voucher.recipient.states.*`
 * and never contains the voucher code, e-mail or buyer/sender name.
 */
type Translate = (key: string) => string;

export function VoucherRecipientStateScreen({
  projection,
  t,
}: {
  projection: VoucherRecipientPageProjection;
  t: Translate;
}) {
  const key = projection.messageKey;
  const isLoading = projection.state === 'loading';
  const isAlert = projection.state === 'technical_error' || projection.state === 'forbidden';

  return (
    <div
      data-testid="voucher-recipient-state"
      data-state={projection.state}
      data-message-key={key}
      data-next-action={projection.nextAction}
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8"
    >
      <section
        role={isLoading ? 'status' : isAlert ? 'alert' : undefined}
        aria-busy={isLoading ? 'true' : undefined}
        className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
      >
        <span className="inline-flex rounded-full border border-[var(--bb-border-soft)] bg-white/70 px-4 py-2 text-xs uppercase tracking-[0.24em] text-[var(--cta-hover)]">
          {t(`${key}.badge`)}
        </span>
        <h1 className="heading-lg max-w-2xl text-[var(--text-primary)]">{t(`${key}.heading`)}</h1>
        <p className="max-w-xl text-base leading-7 text-[var(--text-secondary)]">{t(`${key}.body`)}</p>
        {projection.nextActionHref ? (
          <Link
            href={projection.nextActionHref}
            data-testid="voucher-recipient-next-action"
            className="inline-flex min-h-12 items-center rounded-full bg-[var(--bg-action)] px-5 py-3 text-sm font-medium text-[var(--bb-surface)]"
          >
            {t(`${key}.cta`)}
          </Link>
        ) : (
          <p data-testid="voucher-recipient-next-action" className="text-sm text-[var(--text-secondary)]">
            {t(`${key}.cta`)}
          </p>
        )}
      </section>
    </div>
  );
}

export default VoucherRecipientStateScreen;
