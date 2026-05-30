import 'server-only';

import { buildMedusaUrl } from '@/lib/env';
import { localeAwareFetch } from '@/lib/sdk/locale-interceptor';
import type { VoucherConsentErrorKey } from '@/lib/voucher-consent/schema';

export type VoucherConsentContext =
  | {
      ok: true;
      state: 'ready' | 'blocked';
      age_check_required: boolean;
      consent_status: 'pending' | 'approved' | 'approved_by_guardian' | 'rejected';
      error: 'GUARDIAN_APPROVAL_REQUIRED' | null;
    }
  | {
      ok: false;
      error: VoucherConsentErrorKey;
    };

const E2E_CONTEXTS: Record<string, VoucherConsentContext> = {
  'E2E-W2-15-ADULT': {
    ok: true,
    state: 'ready',
    age_check_required: false,
    consent_status: 'pending',
    error: null
  },
  'E2E-W2-15-MINOR': {
    ok: true,
    state: 'blocked',
    age_check_required: true,
    consent_status: 'pending',
    error: 'GUARDIAN_APPROVAL_REQUIRED'
  },
  'E2E-W2-15-MINOR-READY': {
    ok: true,
    state: 'ready',
    age_check_required: true,
    consent_status: 'approved_by_guardian',
    error: null
  },
  'E2E-W2-15-INVALID': {
    ok: false,
    error: 'TOKEN_INVALID'
  }
};

function publishableHeaders(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  return {
    Accept: 'application/json',
    ...(key ? { 'x-publishable-api-key': key } : {})
  };
}

function normalizeError(value: unknown): VoucherConsentErrorKey {
  if (typeof value === 'string') {
    if (
      value === 'TOKEN_EXPIRED' ||
      value === 'TOKEN_REVOKED' ||
      value === 'TOKEN_INVALID' ||
      value === 'RATE_LIMITED' ||
      value === 'FIELD_NOT_ALLOWED' ||
      value === 'SERVICE_UNAVAILABLE'
    ) {
      return value;
    }
  }
  return 'TOKEN_INVALID';
}

export async function getVoucherConsentContext(token: string): Promise<VoucherConsentContext> {
  if (process.env.NODE_ENV !== 'production' && token in E2E_CONTEXTS) {
    return E2E_CONTEXTS[token];
  }

  try {
    const response = await localeAwareFetch(
      buildMedusaUrl(`/store/voucher-consent/${encodeURIComponent(token)}`),
      {
        method: 'GET',
        headers: publishableHeaders(),
        cache: 'no-store'
      }
    );
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: normalizeError(json.error) };
    }
    return {
      ok: true,
      state: json.state === 'blocked' ? 'blocked' : 'ready',
      age_check_required: json.age_check_required === true,
      consent_status:
        json.consent_status === 'approved' ||
        json.consent_status === 'approved_by_guardian' ||
        json.consent_status === 'rejected'
          ? json.consent_status
          : 'pending',
      error: json.error === 'GUARDIAN_APPROVAL_REQUIRED' ? 'GUARDIAN_APPROVAL_REQUIRED' : null
    };
  } catch {
    return { ok: false, error: 'SERVICE_UNAVAILABLE' };
  }
}
