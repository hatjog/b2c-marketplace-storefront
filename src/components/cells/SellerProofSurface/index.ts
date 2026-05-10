/**
 * SellerProofSurface cell barrel.
 *
 * Server-only exports — do NOT re-export through a client barrel (index.client.ts).
 * SellerProofSurface is a server component.
 *
 * ARCH-007: Customer-facing storefront only.
 */
export type {
  SellerProofSurfaceProps,
  SellerProofData,
} from './SellerProofSurface';
export { SellerProofSurface } from './SellerProofSurface';
