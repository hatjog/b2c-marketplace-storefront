'use client';

/**
 * DiscoveryEmptyState — BonBeauty DS multi-variant empty/error state cell.
 *
 * v1.7.0 Story 2.2: Covers the four distinct state classes required by UX-DR19:
 *   - initial:           no purchase history on home; show recommendations fallback
 *   - no-results:        filters applied / query typed with zero matches
 *   - permission-denied: region-restricted, account-state restricted, unavailable offer set
 *   - load-error:        network/Store API failure, hydration error
 *
 * Each variant has a distinct headline, body, accessible status text (role/aria-live)
 * and exactly one recommended next action (CTA slot) per UX-DR18.
 *
 * Built on Story 2.1 StateCard primitive — slot/variant over fork (UX-PAT-3).
 * All surface tokens resolve through bb-surfaces.css + bonbeauty.css chain.
 *
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 */

import { useTranslations } from 'next-intl';

import { StateCard } from '@/components/molecules/StateCard/StateCard';

export type DiscoveryEmptyVariant =
  | 'initial'
  | 'no-results'
  | 'permission-denied'
  | 'load-error';

interface DiscoveryEmptyStateProps {
  variant: DiscoveryEmptyVariant;
  /** Override action slot — if omitted a default is rendered */
  action?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

/** Maps our 4-class variants onto StateCard's 3 semantic variants.
 *  - initial        → empty  (genuinely no data yet)
 *  - no-results     → empty  (filters applied, no match — still an "empty" result state)
 *  - permission-denied → unavailable (item exists but not accessible)
 *  - load-error     → error  (provider/system failure) */
const VARIANT_MAP = {
  initial: 'empty',
  'no-results': 'empty',
  'permission-denied': 'unavailable',
  'load-error': 'error',
} as const;

export function DiscoveryEmptyState({
  variant,
  action,
  className,
  'data-testid': dataTestId,
}: DiscoveryEmptyStateProps) {
  const t = useTranslations('discovery_empty');

  const headlineKey = `${variant.replace('-', '_')}_headline` as
    | 'initial_headline'
    | 'no_results_headline'
    | 'permission_denied_headline'
    | 'load_error_headline';
  const bodyKey = `${variant.replace('-', '_')}_body` as
    | 'initial_body'
    | 'no_results_body'
    | 'permission_denied_body'
    | 'load_error_body';
  const ctaKey = `${variant.replace('-', '_')}_cta` as
    | 'initial_cta'
    | 'no_results_cta'
    | 'permission_denied_cta'
    | 'load_error_cta';

  const title = t(headlineKey);
  const description = t(bodyKey);
  const ctaLabel = t(ctaKey);

  const stateCardVariant = VARIANT_MAP[variant];

  return (
    <StateCard
      variant={stateCardVariant}
      title={title}
      titleAs="h2"
      description={description}
      action={action ?? <DefaultCta variant={variant} label={ctaLabel} />}
      className={className}
      data-testid={dataTestId ?? `discovery-empty-${variant}`}
    />
  );
}

/**
 * Default CTA per variant — one recommended next action per UX-DR18.
 * Consumers override via `action` prop for custom routing needs.
 */
function DefaultCta({
  variant,
  label,
}: {
  variant: DiscoveryEmptyVariant;
  label: string;
}) {
  if (variant === 'load-error') {
    return (
      <button
        type="button"
        onClick={() => window.location.reload()}
        aria-label={label}
        className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-2 text-sm font-medium text-action-on-primary transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        data-testid="discovery-empty-cta-load-error"
      >
        {label}
      </button>
    );
  }

  // For initial, no-results, permission-denied — link to categories
  const href = variant === 'no-results' ? '#clear-filters' : '/categories';
  return (
    <a
      href={href}
      aria-label={label}
      className="inline-flex min-h-[44px] items-center justify-center rounded-sm bg-action px-5 py-2 text-sm font-medium text-action-on-primary transition-colors hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      data-testid={`discovery-empty-cta-${variant}`}
    >
      {label}
    </a>
  );
}
