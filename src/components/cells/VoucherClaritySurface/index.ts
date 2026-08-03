/**
 * VoucherClaritySurface cell barrel.
 *
 * Server-only exports — do NOT re-export through a client barrel (index.client.ts).
 * VoucherClaritySurface is a server component; importing it in a client bundle
 * will cause hydration errors.
 *
 * ARCH-007: Customer-facing storefront only.
 */
export type {
  VoucherClaritySurfaceProps,
  VoucherClarityVariantProp,
  VoucherClarityStatus,
  RealizationRule,
} from './VoucherClaritySurface';
export { VoucherClaritySurface } from './VoucherClaritySurface';
