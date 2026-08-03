'use server';

import { revalidatePath } from 'next/cache';

import { buildMedusaUrl } from '@/lib/env';
import { normalizeToCanonicalLocale, withLocaleHeader } from '@/lib/sdk/locale-interceptor';
import {
  createVoucherConsentSchema,
  firstVoucherConsentError,
  formDataToVoucherConsentValues,
  type VoucherConsentErrorKey
} from '@/lib/voucher-consent/schema';

import type { VoucherConsentActionState } from './voucher-kyc-consent-state';

function publishableHeaders(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(key ? { 'x-publishable-api-key': key } : {})
  };
}

function normalizeBackendError(value: unknown): VoucherConsentErrorKey {
  if (
    value === 'RODO_CONSENT_REQUIRED' ||
    value === 'SERVICE_CONSENT_REQUIRED' ||
    value === 'GUARDIAN_EMAIL_INVALID' ||
    value === 'GUARDIAN_CONSENT_REQUIRED' ||
    value === 'CAPTCHA_REQUIRED' ||
    value === 'RATE_LIMITED' ||
    value === 'TOKEN_EXPIRED' ||
    value === 'TOKEN_REVOKED' ||
    value === 'TOKEN_INVALID' ||
    value === 'FIELD_NOT_ALLOWED' ||
    value === 'SERVICE_UNAVAILABLE'
  ) {
    return value;
  }
  return 'FIELD_NOT_ALLOWED';
}

export async function submitVoucherConsent(
  _previousState: VoucherConsentActionState,
  formData: FormData
): Promise<VoucherConsentActionState> {
  const token = String(formData.get('token') ?? '').trim();
  const locale = String(formData.get('locale') ?? 'pl').trim();
  const ageCheckRequired = String(formData.get('age_check_required') ?? '') === 'true';

  if (!token) {
    return { status: 'error', error: 'TOKEN_INVALID' };
  }

  const values = formDataToVoucherConsentValues(formData);
  const schema = createVoucherConsentSchema(ageCheckRequired);
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return { status: 'error', error: firstVoucherConsentError(parsed.error) };
  }

  const canonicalLocale = normalizeToCanonicalLocale(locale);

  try {
    const response = await fetch(
      buildMedusaUrl(`/store/voucher-consent/${encodeURIComponent(token)}`),
      {
        method: 'POST',
        headers: await withLocaleHeader(publishableHeaders(), canonicalLocale),
        body: JSON.stringify(parsed.data),
        cache: 'no-store'
      }
    );
    const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        status: 'error',
        error: normalizeBackendError(json.error),
        retryAfter:
          response.status === 429
            ? Number(response.headers.get('Retry-After') ?? '3600')
            : undefined
      };
    }

    revalidatePath(`/${locale}/voucher/consent/[token]`, 'page');
    return {
      status: 'success',
      error: null,
      backendStatus: json.status === 'approved_by_guardian' ? 'approved_by_guardian' : 'approved'
    };
  } catch {
    return { status: 'error', error: 'SERVICE_UNAVAILABLE' };
  }
}
