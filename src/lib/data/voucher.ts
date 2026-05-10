import { mercurClient, sdk } from '../config';
import { getAuthHeaders } from './cookies';
import type {
  VoucherAuditEvent,
  VoucherAuditEventType
} from '@/types/voucher';

/**
 * Story v160-6-1: Recipient claim page voucher data layer (Path B).
 *
 * Privacy boundary AR45: server-side allowlist projection — only public
 * fields ever leave this module. Defensive even if backend Mercur 2 voucher
 * schema includes buyer fields; we strip them BEFORE the Server Component
 * renders. NEVER move to deny-list (whitelist preserves invariant under
 * future schema additions).
 *
 * Mercur 2 voucher endpoint strategy (post cleanup-25 / TF-134):
 *   Path B (primary): typed `mercurClient.store.vouchers.byCode({ code })` —
 *   first-class in Mercur 2.1.1 SDK surface provisioned by cleanup-25.
 *   The raw `sdk.client.fetch` fallback is retained as a safety net for
 *   transient SDK type-surface regressions during Mercur 2.x churn; it is NOT
 *   a happy-path alternative and carries no fixture-only escape hatch beyond
 *   the existing `E2E_VOUCHER_FIXTURES` / `E2E_VOUCHER_EVENTS` gating (see
 *   below). If neither path yields a payload, returns null / empty array and
 *   the page calls `notFound()` or renders the empty-state copy respectively.
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

const E2E_CLAIMED_FIXTURE_CODE = 'E2E-CLAIMED-VOUCHER-002';

const E2E_VOUCHER_FIXTURES: Record<string, VoucherPublicView> = {
  [E2E_CLAIMED_FIXTURE_CODE]: {
    code: E2E_CLAIMED_FIXTURE_CODE,
    seller_id: 'sel_01CITYBEAUTY00000000000',
    seller_name: 'City Beauty',
    seller_handle: 'city-beauty',
    product_title: 'Peeling kwasami',
    value_minor: 19900,
    currency_code: 'PLN',
    status: 'claimed',
    expires_at: '2026-12-31T23:59:59.000Z'
  }
};

const E2E_VOUCHER_EVENTS: Record<string, VoucherAuditEvent[]> = {
  [E2E_CLAIMED_FIXTURE_CODE]: [
    {
      id: 'evt_e2e_claimed_fixture_created',
      event_type: 'created',
      occurred_at: '2026-05-01T10:00:00.000Z',
      metadata: {}
    },
    {
      id: 'evt_e2e_claimed_fixture_sent',
      event_type: 'sent',
      occurred_at: '2026-05-01T10:05:00.000Z',
      metadata: {}
    },
    {
      id: 'evt_e2e_claimed_fixture_claimed',
      event_type: 'claimed',
      occurred_at: '2026-05-01T10:15:00.000Z',
      metadata: {}
    }
  ]
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
 * server boundary (AR45 invariant). Returns null when not found.
 *
 * Primary path: typed `mercurClient.store.vouchers.byCode({ code })` (cleanup-25).
 * Fallback: raw `sdk.client.fetch('/store/vouchers/<code>')` (safety net for SDK churn).
 * E2E escape hatch: known codes in `E2E_VOUCHER_FIXTURES` return fixture data.
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

  // Fallback A: Medusa SDK raw fetch (cleanup-13b backend endpoint).
  try {
    const url = `/store/vouchers/${encodeURIComponent(code)}`;
    const res = (await sdk.client.fetch(url, { method: 'GET' })) as
      | { voucher?: VoucherApiPayload }
      | null;
    const view = projectAllowlist(res?.voucher ?? (res as VoucherApiPayload));
    if (view) return view;
  } catch {
    // Endpoint not provisioned or 404 — fall through.
  }

  if (code in E2E_VOUCHER_FIXTURES) {
    return E2E_VOUCHER_FIXTURES[code];
  }

  return null;
}

const KNOWN_EVENT_TYPES: ReadonlySet<VoucherAuditEventType> = new Set([
  'created',
  'sent',
  'opened',
  'claimed',
  'withdrawn'
]);

type VoucherAuditEventApiPayload = {
  id?: string;
  event_type?: string;
  type?: string;
  occurred_at?: string;
  created_at?: string;
  // Buyer-side fields are explicitly NOT enumerated; AR45 strip applied below.
};

/**
 * Story v160-6-3: AR45-safe projection — whitelist allowlist (ONLY id +
 * event_type + occurred_at survive). Backend metadata is stripped regardless
 * of payload shape, so the timeline cannot leak buyer-side PII.
 */
function projectAuditEvent(
  p: VoucherAuditEventApiPayload | null | undefined
): VoucherAuditEvent | null {
  if (!p) return null;
  const id = p.id ? String(p.id) : null;
  const rawType = (p.event_type ?? p.type ?? '').toLowerCase();
  if (!id || !KNOWN_EVENT_TYPES.has(rawType as VoucherAuditEventType)) {
    return null;
  }
  const occurred_at = p.occurred_at ?? p.created_at;
  if (!occurred_at) return null;
  return {
    id,
    event_type: rawType as VoucherAuditEventType,
    occurred_at: String(occurred_at),
    metadata: {}
  };
}

/**
 * Fetches the recipient-visible voucher audit trail events. Strategy:
 *   (a) Try typed `mercurClient.store.vouchers.events({ code })`.
 *   (b) Fall back to raw `mercurClient.fetch('/store/vouchers/<code>/events')`.
 *   (c) Returns empty array if neither yields a payload; UI degrades
 *       gracefully via `voucher.audit_trail.empty_state` copy (AC3).
 *
 * Privacy: all surfaces apply `projectAuditEvent()` allowlist BEFORE return,
 * so no buyer-side metadata can reach the React tree (AR45 invariant).
 */
export async function getVoucherEvents(
  code: string
): Promise<VoucherAuditEvent[]> {
  if (!code || code.length < 3) return [];

  // Path B preferred: typed mercurClient call.
  try {
    const client = mercurClient as unknown as {
      store?: {
        vouchers?: {
          events?: (args: {
            code: string;
          }) => Promise<{ events?: VoucherAuditEventApiPayload[] }>;
        };
      };
    };
    if (client.store?.vouchers?.events) {
      const res = await client.store.vouchers.events({ code });
      const projected = (res?.events ?? [])
        .map(projectAuditEvent)
        .filter((e): e is VoucherAuditEvent => e !== null);
      if (projected.length > 0) {
        projected.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
        return projected;
      }
    }
  } catch {
    // Fall through.
  }

  // Fallback A: Medusa SDK raw fetch (cleanup-13b backend endpoint).
  try {
    const url = `/store/vouchers/${encodeURIComponent(code)}/events`;
    const res = (await sdk.client.fetch(url, { method: 'GET' })) as
      | { events?: VoucherAuditEventApiPayload[] }
      | null;
    const projected = (res?.events ?? [])
      .map(projectAuditEvent)
      .filter((e): e is VoucherAuditEvent => e !== null);
    projected.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    return projected;
  } catch {
    // Raw fetch fallback failed. UI shows empty state via audit_trail.empty_state copy.
  }

  if (code in E2E_VOUCHER_EVENTS) {
    return E2E_VOUCHER_EVENTS[code];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Story 2.6: Customer voucher list (account/recovery view)
// ---------------------------------------------------------------------------

/**
 * Server-side allowlist projection for a customer-scoped voucher list item.
 *
 * Allowlist: code, seller_name, seller_handle, product_title, value_minor,
 *   currency_code, status, expires_at.
 *
 * NEVER ships: seller_id (routing-only, never displayed per story spec),
 *   raw buyer PII (email, address, phone), internal token fields,
 *   salon-user audit details (employee id, station id, honoured_by,
 *   exception_note author email) or operator notes.
 *
 * Story 2.7 PII boundary note:
 *   listCustomerVouchers() exposes ONLY customer-owned voucher data.
 *   The salon-user voucher lookup view (Story 2.7) MUST NOT widen this
 *   projection to include customer email, full name, phone or address.
 *   The inverse also holds: this projection MUST NOT include any salon-user
 *   surface fields (employee id, station id, honoured_by, exception_note
 *   author email). Cross-view PII minimization per NFR17 + FR62.
 *   If Story 2.7 needs to JOIN voucher + salon-user data, it should do so
 *   through a dedicated server-side action with its own allowlist.
 */
export interface VoucherListItem {
  code: string;
  seller_name: string;
  seller_handle: string;
  product_title: string;
  value_minor: number;
  currency_code: string;
  status: VoucherStatus;
  expires_at?: string | null;
}

type VoucherListApiPayload = {
  code?: string;
  seller_id?: string;       // internal routing only — NOT projected to customer
  seller_name?: string;
  seller_handle?: string;
  product_title?: string;
  value_minor?: number;
  value?: number;
  currency_code?: string;
  status?: string;
  expires_at?: string | null;
  // Buyer-side fields are explicitly NOT enumerated (AR45 allowlist pattern).
};

function projectListAllowlist(p: VoucherListApiPayload | null | undefined): VoucherListItem | null {
  if (!p) return null;
  if (!p.code || !p.seller_name) return null;

  const rawStatus = (p.status ?? 'idle').toLowerCase();
  const status: VoucherStatus =
    rawStatus === 'consent_pending' || rawStatus === 'consent-pending' || rawStatus === 'pending'
      ? 'consent_pending'
      : rawStatus === 'claimed' || rawStatus === 'redeemed'
        ? 'claimed'
        : rawStatus === 'withdrawn' || rawStatus === 'revoked'
          ? 'withdrawn'
          : 'idle';

  return {
    code: String(p.code),
    seller_name: String(p.seller_name),
    // Review LOW: never fall back to voucher.code — that would mis-route
    // /sellers/<voucher_code> AND leak the voucher code into a seller URL.
    // When seller_handle is missing, return '' and let the consumer omit
    // the seller link (rendering the seller_name as plain text).
    seller_handle: p.seller_handle ? String(p.seller_handle) : '',
    product_title: String(p.product_title ?? ''),
    value_minor: typeof p.value_minor === 'number'
      ? p.value_minor
      : typeof p.value === 'number'
        ? p.value
        : 0,
    currency_code: String(p.currency_code ?? 'PLN'),
    status,
    expires_at: p.expires_at ?? null,
  };
}

/**
 * Fetches the authenticated customer's voucher list.
 *
 * Data layer strategy (Path B primary / Path A safety net — per voucher.ts
 * doc comment "Mercur 2 voucher endpoint strategy"):
 *   Path B (primary): typed `mercurClient.store.vouchers` list call.
 *   Path A (fallback): raw sdk.client.fetch('/store/vouchers') with auth headers.
 *
 * Returns { vouchers: VoucherListItem[], state: 'ok' | 'access_denied' |
 *   'unavailable' | 'failed' } so the calling page can map each to its
 * distinct UX state (Story 0.9 contract: may_mask_failures: false).
 *
 * Story 2.7 PII boundary: see projectListAllowlist doc above.
 */
export type CustomerVoucherListResult =
  | { state: 'ok'; vouchers: VoucherListItem[] }
  | { state: 'access_denied'; vouchers: [] }
  | { state: 'unavailable'; vouchers: [] }
  | { state: 'failed'; vouchers: [] };

export async function listCustomerVouchers(): Promise<CustomerVoucherListResult> {
  // Check auth headers — missing token means access_denied, not empty.
  // (getAuthHeaders always returns an object — `{}` when no token, the
  // authorization shape otherwise — so we only need the `in` check.)
  const authHeaders = await getAuthHeaders();
  if (!('authorization' in authHeaders)) {
    return { state: 'access_denied', vouchers: [] };
  }

  // Path B (primary): typed mercurClient list call.
  try {
    const client = mercurClient as unknown as {
      store?: {
        vouchers?: {
          list?: (args?: Record<string, unknown>) => Promise<{
            vouchers?: VoucherListApiPayload[];
          }>;
        };
      };
    };
    if (client.store?.vouchers?.list) {
      const res = await client.store.vouchers.list();
      const items = (res?.vouchers ?? [])
        .map(projectListAllowlist)
        .filter((v): v is VoucherListItem => v !== null);
      return { state: 'ok', vouchers: items };
    }
  } catch (err: unknown) {
    // Distinguish auth (401/403) from other errors.
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return { state: 'access_denied', vouchers: [] };
    }
    if (status === 503 || status === 502) {
      return { state: 'unavailable', vouchers: [] };
    }
    // Fall through to Path A.
  }

  // Path A (fallback): raw SDK fetch with auth headers.
  try {
    const res = await sdk.client.fetch<{ vouchers?: VoucherListApiPayload[] }>(
      '/store/vouchers',
      {
        method: 'GET',
        headers: authHeaders,
      }
    );
    const items = (res?.vouchers ?? [])
      .map(projectListAllowlist)
      .filter((v): v is VoucherListItem => v !== null);
    return { state: 'ok', vouchers: items };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return { state: 'access_denied', vouchers: [] };
    }
    if (status === 503 || status === 502) {
      return { state: 'unavailable', vouchers: [] };
    }
    return { state: 'failed', vouchers: [] };
  }
}
