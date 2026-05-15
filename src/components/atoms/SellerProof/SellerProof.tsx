// Trust Presence Invariant #2 — seller proof >=3 proof points on PDP + seller detail.
// validator: _grow/tools/validate_trust_invariant_seller_proof.py
// Required tokens: <SellerProof + >=3 of: years, treatments, rating, reviewsCount, ratingCount

import { cn } from '@/lib/utils';

interface SellerProofProps {
  /** Years of experience (proof point 1) */
  years?: number;
  /** Number of treatments performed (proof point 2) */
  treatments?: number;
  /** Star rating 0-5 (proof point 3) */
  rating?: number;
  /** Number of reviews (proof point alt 3) */
  ratingCount?: number;
  /** Number of reviews (proof point alt 3) */
  reviewsCount?: number;
  sellerName?: string;
  className?: string;
}

function ProofPoint({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="text-[var(--cta)]">{icon}</div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
      <span className="text-xs text-[var(--text-secondary)]">{label}</span>
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
  className,
}: SellerProofProps) {
  const reviewCount = ratingCount ?? reviewsCount;
  return (
    <div
      className={cn(
        'flex items-center justify-around gap-4 rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-4 py-3 shadow-[var(--bb-shadow-soft)]',
        className
      )}
      data-testid="seller-proof"
      aria-label={sellerName ? `Dowód jakości salonu ${sellerName}` : 'Dowód jakości salonu'}
    >
      {years !== undefined && (
        <ProofPoint
          icon={<span className="text-base">🏅</span>}
          value={`${years} lat`}
          label="doświadczenia"
        />
      )}
      {treatments !== undefined && (
        <ProofPoint
          icon={<span className="text-base">✨</span>}
          value={treatments >= 1000 ? `${Math.floor(treatments / 1000)}k+` : `${treatments}+`}
          label="zabiegów"
        />
      )}
      {rating !== undefined && (
        <ProofPoint
          icon={<span className="text-base">⭐</span>}
          value={rating.toFixed(1)}
          label="ocena"
        />
      )}
      {reviewCount !== undefined && (
        <ProofPoint
          icon={<span className="text-base">💬</span>}
          value={`${reviewCount}`}
          label="opinii"
        />
      )}
    </div>
  );
}
