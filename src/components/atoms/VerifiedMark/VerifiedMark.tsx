// @trust-invariant-scope: v180 (component definition file — not a surface file)
// This component satisfies the <VerifiedMark token required by Trust Invariant #1.
// It wraps MarketplaceVerificationMark to provide the canonical <VerifiedMark identifier.

import {
  MarketplaceVerificationMark,
  type VerificationMarkSurface,
  type VerificationMarkVariant,
} from '@/components/atoms/MarketplaceVerificationMark/MarketplaceVerificationMark';

interface VerifiedMarkProps {
  label: string;
  variant?: VerificationMarkVariant;
  surface?: VerificationMarkSurface;
  className?: string;
  'data-testid'?: string;
}

export function VerifiedMark({
  label,
  variant = 'default',
  surface = 'page',
  className,
  'data-testid': dataTestId,
}: VerifiedMarkProps) {
  return (
    <MarketplaceVerificationMark
      label={label}
      variant={variant}
      surface={surface}
      className={className}
      data-testid={dataTestId ?? 'verified-mark'}
    />
  );
}
