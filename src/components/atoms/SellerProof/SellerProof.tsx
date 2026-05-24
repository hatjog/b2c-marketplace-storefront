// Trust Presence Invariant #2 — seller proof >=3 proof points on PDP + seller detail.
// validator: _grow/tools/validate_trust_invariant_seller_proof.py
// Required tokens: <SellerProof + >=3 of: years, treatments, rating, reviewsCount, ratingCount

import Link from 'next/link';

import { countSellerProofPoints } from '@/lib/helpers/pdp';
import { cn } from '@/lib/utils';

interface SellerProofLabels {
  aria: string;
  viewSeller: string;
  yearsValue: (count: number) => string;
  yearsLabel: string;
  treatmentsValue: (count: number) => string;
  treatmentsLabel: string;
  ratingValue: (rating: number, count: number) => string;
  ratingLabel: string;
  noRatings: string;
  warningTitle: string;
  warningBody: string;
}

interface SellerProofProps {
  years?: number | null;
  treatments?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  reviewsCount?: number | null;
  sellerName?: string;
  sellerHandle?: string;
  addressDisplay?: string | null;
  locale: string;
  labels: SellerProofLabels;
  className?: string;
  'data-testid'?: string;
}

function ProofPoint({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-white px-4 py-3">
      <span className="block text-lg font-medium text-[var(--text-primary)]">{value}</span>
      <span className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}

export function SellerProof({
  years,
  treatments,
  rating,
  ratingCount,
  reviewsCount,
  sellerName,
  sellerHandle,
  addressDisplay,
  locale,
  labels,
  className,
  'data-testid': dataTestId = 'seller-proof'
}: SellerProofProps) {
  const resolvedRatingCount = ratingCount ?? reviewsCount ?? null;
  const proofPointsCount = countSellerProofPoints({
    years,
    treatments,
    rating,
    ratingCount: resolvedRatingCount
  });
  const ratingCopy =
    rating !== null &&
    rating !== undefined &&
    resolvedRatingCount !== null &&
    resolvedRatingCount !== undefined
      ? labels.ratingValue(rating, resolvedRatingCount)
      : labels.noRatings;

  return (
    <section
      className={cn(
        'space-y-4 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-86)] p-5 shadow-[var(--bb-shadow-soft)]',
        className
      )}
      data-testid={dataTestId}
      aria-label={labels.aria}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {sellerName ? (
            <h2 className="text-xl font-medium text-[var(--text-primary)]">{sellerName}</h2>
          ) : null}
          {addressDisplay ? (
            <p
              className="mt-1 text-sm text-[var(--text-secondary)]"
              data-testid="pdp-seller-proof-address"
            >
              {addressDisplay}
            </p>
          ) : null}
        </div>
        {sellerHandle ? (
          <Link
            href={`/${locale}/sellers/${sellerHandle}`}
            className="text-xs font-medium uppercase tracking-normal text-[var(--text-primary)] underline decoration-[var(--gold)] decoration-2 underline-offset-4"
            data-testid="pdp-seller-proof-link"
          >
            {labels.viewSeller}
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {years !== null && years !== undefined ? (
          <ProofPoint
            value={labels.yearsValue(years)}
            label={labels.yearsLabel}
          />
        ) : null}
        {treatments !== null && treatments !== undefined ? (
          <ProofPoint
            value={labels.treatmentsValue(treatments)}
            label={labels.treatmentsLabel}
          />
        ) : null}
        <ProofPoint
          value={ratingCopy}
          label={labels.ratingLabel}
        />
      </div>

      {proofPointsCount < 3 ? (
        <div
          className="rounded-[var(--bb-radius-card)] border border-[var(--bb-border-error)] bg-[var(--bb-icon-bg-error)] px-4 py-3 text-sm text-[var(--text-primary)]"
          data-testid="pdp-seller-proof-warning"
        >
          <p className="font-medium">{labels.warningTitle}</p>
          <p className="mt-1 text-[var(--text-secondary)]">{labels.warningBody}</p>
        </div>
      ) : null}
    </section>
  );
}
