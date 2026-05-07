/**
 * SDK adapters — Path B (story v160-cleanup-28).
 *
 * Public re-exports for Mercur 2 typed proxy adapter wrappers.
 *
 * AC2: hand-authored adapter module; "codegen" here means documented wrappers
 * with stable typed signatures, not a generator script (inventory showed 1
 * MIGRATE callsite, so generator unnecessary — per OQ #3 default).
 *
 * @see TF-50 (Path B migration)
 * @see TF-51 (getSellerByHandle resolution)
 */

export { fetchSellerById, resolveSellerHandleToId } from './sellers';
