import 'server-only';

import * as Sentry from '@sentry/nextjs';

import { resolveRuntimeSocialLinks, type MarketSocialLinks } from '@/lib/runtime-market-config';
import { getFallbackMarketConfig, type MarketConfig } from '@/lib/portal';

type PayloadCollectionResponse<T> = {
  docs?: T[];
};

const inFlightRequests = new Map<string, Promise<MarketConfig | null>>();

function logMarketConfigError(message: string, error?: unknown) {
  if (error instanceof Error) {
    Sentry.captureException(error);
  } else {
    Sentry.captureMessage(message);
  }

  console.error(message, error);
}

function buildMarketConfigUrl(marketId: string) {
  const payloadApiUrl = process.env.PAYLOAD_API_URL;

  if (!payloadApiUrl) {
    throw new Error('PAYLOAD_API_URL is required');
  }

  const baseUrl = payloadApiUrl.endsWith('/') ? payloadApiUrl : `${payloadApiUrl}/`;
  const url = new URL('api/market-configs', baseUrl);

  url.searchParams.set('where[market_id][equals]', marketId);
  url.searchParams.set('depth', '2');

  return url;
}

function withRuntimeSocialLinks(
  marketConfig: MarketConfig,
  runtimeSocialLinks: MarketSocialLinks | null
) {
  if (!runtimeSocialLinks) {
    return marketConfig;
  }

  return {
    ...marketConfig,
    public_profile: {
      ...(marketConfig.public_profile ?? {}),
      social_links: runtimeSocialLinks
    }
  } satisfies MarketConfig;
}

export async function fetchMarketConfig(marketId: string) {
  if (!marketId) {
    return null;
  }

  const existingRequest = inFlightRequests.get(marketId);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const response = await fetch(buildMarketConfigUrl(marketId), {
        method: 'GET',
        signal: AbortSignal.timeout(2500),
        cache: 'no-store'
      });

      if (!response.ok) {
        const error = new Error(
          `[market-config] fetch failed for market ${marketId}: ${response.status} ${response.statusText}`
        );
        logMarketConfigError(error.message, error);
        return null;
      }

      const data = (await response.json()) as PayloadCollectionResponse<MarketConfig>;

      return data.docs?.[0] ?? null;
    } catch (error) {
      logMarketConfigError(`[market-config] request error for market ${marketId}`, error);
      return null;
    } finally {
      inFlightRequests.delete(marketId);
    }
  })();

  inFlightRequests.set(marketId, request);

  return request;
}

export async function resolveMarketConfig(marketId: string) {
  const runtimeSocialLinks = await resolveRuntimeSocialLinks(marketId);

  try {
    const marketConfig = await fetchMarketConfig(marketId);

    if (marketConfig) {
      return {
        marketConfig: withRuntimeSocialLinks(marketConfig, runtimeSocialLinks),
        usedFallback: false
      };
    }
  } catch (error) {
    logMarketConfigError(`[market-config] resolve failed for market ${marketId}`, error);
  }

  return {
    marketConfig: withRuntimeSocialLinks(getFallbackMarketConfig(marketId), runtimeSocialLinks),
    usedFallback: true
  };
}
