import { getMarketId } from '@/lib/helpers/market-filter';
import { resolveStorefrontState, type StorefrontStateInput } from '@/lib/helpers/storefront-state';
import {
  logStorefrontStateEvaluated,
  type StorefrontSurface
} from '@/lib/helpers/storefront-state-logger';

import { StorefrontStateSignal } from './StorefrontStateSignal';

export interface StorefrontRouteStateSignalProps {
  route: string;
  surface?: StorefrontSurface;
  stateInput?: Omit<StorefrontStateInput, 'market_id'>;
}

function hasExplicitState(input: Omit<StorefrontStateInput, 'market_id'>): boolean {
  return Boolean(
    input.is_loading ||
    input.is_submitting ||
    input.is_genuinely_empty ||
    input.has_validation_error ||
    input.is_access_denied ||
    input.is_unavailable ||
    input.is_stale ||
    input.is_pending ||
    input.has_failed ||
    input.is_retrying ||
    input.is_recovered ||
    input.freshness
  );
}

export function StorefrontRouteStateSignal({
  route,
  surface = 'unknown',
  stateInput = {}
}: StorefrontRouteStateSignalProps) {
  const marketId = getMarketId();
  const result = resolveStorefrontState({
    market_id: marketId,
    ...(hasExplicitState(stateInput) ? {} : { is_recovered: true }),
    ...stateInput
  });

  logStorefrontStateEvaluated(result, route, surface);

  return (
    <StorefrontStateSignal
      route={route}
      state={result.state}
      stateDetail={result.state_detail}
      market={result.market_id}
      freshness={result.freshness}
    />
  );
}
