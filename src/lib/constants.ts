/** ISR TTL in seconds. Usage: export const revalidate = ISR_TTL */
export const ISR_TTL = 60

export const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

/** Number of services per page in SellerServiceList before "Show more" */
export const SELLER_SERVICE_LIST_PAGE_SIZE = 10

/** Max number of TrustSignals elements displayed at once */
export const TRUST_SIGNALS_MAX = 3

/** Max number of products in Cross-Sell section */
export const CROSS_SELL_MAX = 4
