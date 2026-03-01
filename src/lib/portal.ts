import * as Sentry from '@sentry/nextjs';

type MarketConfigLogo = {
  url?: string | null;
};

type MarketConfigSeoDefaults = {
  title_pattern?: string | null;
};

export type MarketConfig = {
  id?: string;
  market_id?: string;
  name?: string | null;
  logo?: MarketConfigLogo | string | null;
  primary_color?: string | null;
  theme?: string | null;
  seo_defaults?: MarketConfigSeoDefaults | null;
  [key: string]: unknown;
};

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

export function getMarketLogoUrl(marketConfig: MarketConfig | null | undefined) {
  const logo = marketConfig?.logo;

  if (!logo) {
    return null;
  }

  if (typeof logo === 'string') {
    return logo;
  }

  return logo.url ?? null;
}

export function getFallbackMarketConfig(marketId: string): MarketConfig {
  const fallbackMarketName = marketId || 'market';

  return {
    market_id: marketId,
    name: fallbackMarketName,
    logo: null,
    primary_color: null,
    theme: null,
    seo_defaults: {
      title_pattern: `%s | ${fallbackMarketName}`
    }
  };
}

export async function resolveMarketConfig(marketId: string) {
  try {
    const marketConfig = await fetchMarketConfig(marketId);

    if (marketConfig) {
      return {
        marketConfig,
        usedFallback: false
      };
    }
  } catch (error) {
    logMarketConfigError(`[market-config] resolve failed for market ${marketId}`, error);
  }

  return {
    marketConfig: getFallbackMarketConfig(marketId),
    usedFallback: true
  };
}
