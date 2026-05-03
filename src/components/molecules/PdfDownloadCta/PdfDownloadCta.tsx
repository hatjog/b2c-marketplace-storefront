'use client';

/**
 * Story v160-6-2: PDF voucher download CTA molecule.
 *
 * Renders the download button on `/order/[id]/confirmed` per generated
 * per-vendor PDF (Story 6.2 backend dispatches 1 PDF per unique seller).
 * For multi-vendor cart (2+ vendors) the parent renders 2+ instances; each
 * instance is labelled with the vendor name (FR30 multi-vendor context).
 *
 * Privacy posture (AR45 + NFR-SEC-9):
 *   - The signed URL is presumed to be presigned with TTL ≤24h (NFR-SEC-1);
 *     URL generation is wired by the backend route, NOT this component.
 *   - Telemetry click events emit voucher_id + seller_id only; recipient/
 *     buyer PII is NEVER passed through props.
 *
 * Loading state: when `signedUrl` is undefined / null, the CTA is disabled
 * and a "voucher will arrive in your email within 5 min" copy is shown
 * (UX-DR20 calm anticipation).
 */

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';

export interface PdfDownloadCtaProps {
  voucherId: string;
  /** Optional vendor display name for multi-vendor cart labelling. */
  sellerName?: string | null;
  /** Stable seller id for telemetry event payload. */
  sellerId?: string | null;
  /** Presigned URL (TTL ≤24h). When null/undefined the CTA is disabled. */
  signedUrl?: string | null;
  /** Optional voucher code for filename. */
  voucherCode?: string | null;
}

export function PdfDownloadCta({
  voucherId,
  sellerName,
  sellerId,
  signedUrl,
  voucherCode
}: PdfDownloadCtaProps) {
  const t = useTranslations('voucher.pdf');
  const isPending = !signedUrl;
  const filename = voucherCode ? `voucher-${voucherCode}.pdf` : 'voucher.pdf';

  const handleClick = () => {
    try {
      Sentry.addBreadcrumb({
        category: 'voucher-pdf',
        message: 'pdf_download_cta_click',
        level: 'info',
        data: {
          voucher_id: voucherId,
          seller_id: sellerId ?? null
        }
      });
    } catch {
      // Sentry is optional; never block the download.
    }
  };

  if (isPending) {
    return (
      <div
        data-testid="voucher-pdf-cta-pending"
        className="rounded-sm border border-tertiary p-4 text-secondary"
      >
        {t('email_pending')}
      </div>
    );
  }

  const label = sellerName
    ? t('download_cta_for_vendor', { seller_name: sellerName })
    : t('download_cta');

  return (
    <a
      href={signedUrl}
      download={filename}
      onClick={handleClick}
      data-testid="voucher-pdf-cta"
      data-voucher-id={voucherId}
      data-seller-id={sellerId ?? undefined}
      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-sm bg-action px-6 py-3 text-action-on-primary"
    >
      {label}
    </a>
  );
}
