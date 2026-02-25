import { cache } from "react"

export type MarketConfig = {
  id?: string
  market_id?: string
  name?: string | null
  logo?: string | null
  primary_color?: string | null
  [key: string]: unknown
}

type PayloadCollectionResponse<T> = {
  docs?: T[]
}

const inFlightRequests = new Map<string, Promise<MarketConfig | null>>()

function buildMarketConfigUrl(marketId: string) {
  const payloadApiUrl = process.env.PAYLOAD_API_URL

  if (!payloadApiUrl) {
    throw new Error("PAYLOAD_API_URL is required")
  }

  const baseUrl = payloadApiUrl.endsWith("/")
    ? payloadApiUrl
    : `${payloadApiUrl}/`
  const url = new URL("api/market-configs", baseUrl)

  url.searchParams.set("where[market_id][equals]", marketId)
  url.searchParams.set("depth", "2")

  return url
}

export const fetchMarketConfig = cache(async (marketId: string) => {
  if (!marketId) {
    return null
  }

  const existingRequest = inFlightRequests.get(marketId)
  if (existingRequest) {
    return existingRequest
  }

  const request = (async () => {
    try {
      const response = await fetch(buildMarketConfigUrl(marketId), {
        method: "GET",
        next: {
          revalidate: 300,
          tags: ["market-config", `market-config:${marketId}`],
        },
      })

      if (!response.ok) {
        return null
      }

      const data =
        (await response.json()) as PayloadCollectionResponse<MarketConfig>

      return data.docs?.[0] ?? null
    } catch {
      return null
    } finally {
      inFlightRequests.delete(marketId)
    }
  })()

  inFlightRequests.set(marketId, request)

  return request
})
