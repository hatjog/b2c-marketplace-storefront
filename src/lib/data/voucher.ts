import { mercurClient } from '../config';

/**
 * Story v160-6-1: Recipient claim page voucher data layer (Path B).
 *
 * Privacy boundary AR45: server-side allowlist projection — only public
 * fields ever leave this module. Defensive even if backend Mercur 2 voucher
 * schema includes buyer fields; we strip them BEFORE the Server Component
 * renders. NEVER move to deny-list (whitelist preserves invariant under
 * future schema additions).
 *
 * Mercur 2 voucher endpoint risk (per Story 2.6):
 *   Native `mercurClient.store.vouchers.byCode({ code })` may NOT be
 *   first-class in Mercur 2.1.1 SDK surface. We try the typed call first
 *   and fall back to a raw `sdk.client.fetch` GET probe. If neither yields
 *   a voucher payload, returns null and the page calls `notFound()`.
 *
 * Backend integration TODO:
 *   Backend voucher endpoint authoring is OUT OF 6.1 scope (per story
 *   boundary). When Story 6.x backend extension lands, swap this layer to
 *   the typed mercurClient call without changing call-sites.
 */

export type VoucherStatus =
  | 'idle'
  | 'consent_pending'
  | 'claimed'
  | 'withdrawn';

export interface VoucherPublicView {
  /** Recipient-visible code (URL fragment + redemption identifier). */
  code: string;
  /** Stable seller id — never displayed; used for routing. */
  seller_id: string;
  /** Display copy — public seller name (visible per FR30). */
  seller_name: string;
  /** Stable URL fragment for `/sellers/[handle]` link target. */
  seller_handle: string;
  /** Service / product title (e.g. "Manicure hybrydowy"). */
  product_title: string;
  /** Voucher value in PLN minor units (cents). */
  value_minor: number;
  /** ISO 4217 currency code (default `PLN`). */
  currency_code: string;
  /** State-machine status — preserves v1.5.0 baseline (idle | consent_pending | claimed | withdrawn). */
  status: VoucherStatus;
  /** ISO 8601 expiry timestamp (optional). */
  expires_at?: string | null;
}

type VoucherApiPayload = {
  code?: string;
  seller_id?: string;
  seller_name?: string;
  seller_handle?: string;
  product_title?: string;
  value_minor?: number;
  value?: number;
  currency_code?: string;
  status?: string;
  expires_at?: string | null;
  // Buyer-side fields are explicitly NOT enumerated; the projection below is
  // an allowlist, so any unknown fields are dropped at the boundary.
};

function projectAllowlist(p: VoucherApiPayload | null | undefined): VoucherPublicView | null {
  if (!p) return null;
  if (!p.code || !p.seller_id || !p.seller_name) return null;

  const rawStatus = (p.status ?? 'idle').toLowerCase();
  const status: VoucherStatus =
    rawStatus === 'consent_pending' ||
    rawStatus === 'consent-pending' ||
    rawStatus === 'pending'
      ? 'consent_pending'
      : rawStatus === 'claimed' || rawStatus === 'redeemed'
        ? 'claimed'
        : rawStatus === 'withdrawn' || rawStatus === 'revoked'
          ? 'withdrawn'
          : 'idle';

  return {
    code: String(p.code),
    seller_id: String(p.seller_id),
    seller_name: String(p.seller_name),
    seller_handle: String(p.seller_handle ?? p.seller_id),
    product_title: String(p.product_title ?? ''),
    value_minor: typeof p.value_minor === 'number'
      ? p.value_minor
      : typeof p.value === 'number'
        ? p.value
        : 0,
    currency_code: String(p.currency_code ?? 'PLN'),
    status,
    expires_at: p.expires_at ?? null
  };
}

/**
 * Fetches a voucher by recipient-facing code. Strips buyer-side PII at the
 * server boundary (AR45 invariant). Returns null when not found OR when the
 * Mercur 2 voucher endpoint is not yet provisioned (Story 6.x backend).
 */
export async function getVoucherByCode(code: string): Promise<VoucherPublicView | null> {
  if (!code || code.length < 3) return null;

  // Path B preferred: typed mercurClient call (when SDK surface lands).
  try {
    const client = mercurClient as unknown as {
      store?: { vouchers?: { byCode?: (args: { code: string }) => Promise<{ voucher?: VoucherApiPayload }> } };
    };
    if (client.store?.vouchers?.byCode) {
      const res = await client.store.vouchers.byCode({ code });
      const view = projectAllowlist(res?.voucher);
      if (view) return view;
    }
  } catch {
    // Fall through to raw fetch fallback.
  }

  // Fallback A: raw fetch via mercurClient (post-2.6 endpoint contract).
  try {
    const url = `/store/vouchers/${encodeURIComponent(code)}`;
    const rawClient = mercurClient as unknown as {
      fetch?: (path: string, init?: RequestInit) => Promise<unknown>;
    };
    if (typeof rawClient.fetch === 'function') {
      const res = (await rawClient.fetch(url, { method: 'GET' })) as { voucher?: VoucherApiPayload } | null;
      const view = projectAllowlist(res?.voucher ?? (res as VoucherApiPayload));
      if (view) return view;
    }
  } catch {
    // Endpoint not provisioned (Mercur 2 voucher native endpoint OUT OF 6.1 scope).
  }

  return null;
}
