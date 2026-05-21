import type { VoucherConsentErrorKey } from '@/lib/voucher-consent/schema';

export type VoucherConsentActionState =
  | {
      status: 'idle';
      error: null;
      retryAfter?: undefined;
    }
  | {
      status: 'success';
      error: null;
      backendStatus: 'approved' | 'approved_by_guardian';
      retryAfter?: undefined;
    }
  | {
      status: 'error';
      error: VoucherConsentErrorKey;
      retryAfter?: number;
    };

export const initialVoucherConsentActionState: VoucherConsentActionState = {
  status: 'idle',
  error: null
};
