import React from 'react'

import { Cash, CreditCard } from '@medusajs/icons'

/** ISR TTL in seconds. Usage: export const revalidate = ISR_TTL */
export const ISR_TTL = 60

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<string, { title: string; icon: React.JSX.Element }> = {
	'pp_card_stripe-connect': {
		title: 'Credit card',
		icon: React.createElement(CreditCard),
	},
	pp_stripe_stripe: {
		title: 'Credit card',
		icon: React.createElement(CreditCard),
	},
	pp_stripe: {
		title: 'Credit card',
		icon: React.createElement(CreditCard),
	},
	'pp_stripe-ideal_stripe': {
		title: 'iDeal',
		icon: React.createElement(CreditCard),
	},
	'pp_stripe-bancontact_stripe': {
		title: 'Bancontact',
		icon: React.createElement(CreditCard),
	},
	pp_paypal_paypal: {
		title: 'PayPal',
		icon: React.createElement(CreditCard),
	},
	pp_system_default: {
		title: 'Manual Payment',
		icon: React.createElement(Cash),
	},
}

/**
 * v1.9.0 wf5 (H-5 / F-CC1-006/008): canonical Stripe provider id is
 * `pp_stripe` (medusa-config.ts pins `id: "stripe"`; Medusa convention
 * `pp_<id>`). The legacy `pp_stripe_stripe` (plugin-name-derived id when
 * `id` is unset) is retained as a back-compat acceptor for transitional
 * deployments and pre-migration data; new code MUST use `STRIPE_PROVIDER_ID`.
 * `pp_card_stripe-connect` is the Mercur 2 connect-flow variant kept for
 * upstream compatibility. paymentInfoMap maps all three to the same UI.
 */
export const STRIPE_PROVIDER_ID = 'pp_stripe' as const

export const isStripe = (providerId?: string) =>
	providerId === STRIPE_PROVIDER_ID ||
	providerId === 'pp_stripe_stripe' || // back-compat: legacy id pre-medusa-config explicit id
	providerId?.startsWith('pp_card_stripe-connect')

export const isPaypal = (providerId?: string) => providerId?.startsWith('pp_paypal')

export const isManual = (providerId?: string) => providerId?.startsWith('pp_system_default')

export const SORT_OPTIONS = ['recommended', 'price_asc', 'price_desc'] as const
export type SortOption = (typeof SORT_OPTIONS)[number]

/** Number of services per page in SellerServiceList before "Show more" */
export const SELLER_SERVICE_LIST_PAGE_SIZE = 10

/** Max number of TrustSignals elements displayed at once */
export const TRUST_SIGNALS_MAX = 3

/** Max number of products in Cross-Sell section */
export const CROSS_SELL_MAX = 4

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
	'krw',
	'jpy',
	'vnd',
	'clp',
	'pyg',
	'xaf',
	'xof',
	'bif',
	'djf',
	'gnf',
	'kmf',
	'mga',
	'rwf',
	'xpf',
	'htg',
	'vuv',
	'xag',
	'xdr',
	'xau',
]

export const PROTECTED_ROUTES = [
	'/user',
	'/user/wishlist',
	'/user/orders',
	'/user/settings',
	'/user/addresses',
	'/user/messages',
	'/user/reviews',
	'/user/returns',
]
