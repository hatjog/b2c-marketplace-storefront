// PriceDisplay — the ONLY allowed price formatting component in the storefront.
// Consumers must pass `calculated_price` from the Mercur API (NOT base_price) converted to cents.
// Do NOT use manual formatting: "${price} zł", .toFixed(2), hardcoded "zł"/"PLN"/"złot".
export { PriceDisplay } from './PriceDisplay';
export type { PriceDisplayProps } from './PriceDisplay';
