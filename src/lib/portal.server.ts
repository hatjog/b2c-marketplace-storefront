import * as Sentry from '@sentry/nextjs';

import type { SupportedLocale } from '@/i18n/routing';
import { resolveMarketLocales } from '@/lib/market-locales';
import {
  resolveFooterLocalizedCopy,
  resolveLegalEntity,
  resolveRuntimePortalMarketConfig,
  resolveRuntimeSocialLinks,
  type LegalEntity,
  type MarketLocaleContext,
  type MarketSocialLinks
} from '@/lib/runtime-market-config';
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

function withRuntimeLegalEntity(marketConfig: MarketConfig, legalEntity: LegalEntity | null) {
  return {
    ...marketConfig,
    legal_entity: legalEntity
  } satisfies MarketConfig;
}

/**
 * QD-02 — the ONE place a footer locale map becomes a string.
 *
 * Applied inside `applyRuntimeOverrides`, so it covers all THREE exits of
 * `resolveMarketConfig`: the runtime YAML config, the Payload API fallback, and
 * the hardcoded fallback config. Resolving only in the YAML loader would leave
 * the Payload path serving its non-localized scalar `footer_copyright` verbatim
 * — the shim in `resolveLocalizedConfigValue` labels that as a fallback instead
 * of passing it off as a translation, and its removal criterion is QD-04
 * (Payload `localized: true`), not this package.
 */
function withResolvedFooterCopy(
  marketConfig: MarketConfig,
  locale: SupportedLocale,
  marketLocales: MarketLocaleContext
) {
  return {
    ...marketConfig,
    footer: resolveFooterLocalizedCopy(marketConfig.footer, {
      locale,
      marketLocales,
      marketId: marketConfig.market_id ?? 'unknown'
    })
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

/**
 * QD-01 (SPEC-storefront-i18n-completeness): `locale` is REQUIRED.
 *
 * Market config carries user-facing copy, so it cannot be resolved without a
 * locale. Making the parameter mandatory turns "did every call site pass the
 * route locale?" from a review question into a compile error. Surfaces with no
 * route locale (the non-localized root layout, the filters sidebar) must pass
 * `await getMarketDefaultLocale()` explicitly — never implicitly.
 *
 * The effective locale set comes from the single ADR-154 resolver; this function
 * does not keep a locale list of its own.
 */
export async function resolveMarketConfig(marketId: string, locale: SupportedLocale) {
  const [runtimeSocialLinks, legalEntity, marketLocales] = await Promise.all([
    resolveRuntimeSocialLinks(marketId),
    resolveLegalEntity(marketId),
    resolveMarketLocales()
  ]);

  const applyRuntimeOverrides = (config: MarketConfig) =>
    withResolvedFooterCopy(
      withRuntimeLegalEntity(withRuntimeSocialLinks(config, runtimeSocialLinks), legalEntity),
      locale,
      marketLocales
    );

  try {
    const runtimeMarketConfig = await resolveRuntimePortalMarketConfig(marketId, locale, marketLocales);

    if (runtimeMarketConfig) {
      return {
        marketConfig: applyRuntimeOverrides(runtimeMarketConfig),
        usedFallback: false
      };
    }

    const marketConfig = await fetchMarketConfig(marketId);

    if (marketConfig) {
      return {
        marketConfig: applyRuntimeOverrides(marketConfig),
        usedFallback: false
      };
    }
  } catch (error) {
    logMarketConfigError(`[market-config] resolve failed for market ${marketId}`, error);
  }

  return {
    marketConfig: applyRuntimeOverrides(getFallbackMarketConfig(marketId)),
    usedFallback: true
  };
}
