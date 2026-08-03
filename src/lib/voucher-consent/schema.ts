import { z } from 'zod';

export const VOUCHER_CONSENT_ERROR_KEYS = [
  'RODO_CONSENT_REQUIRED',
  'SERVICE_CONSENT_REQUIRED',
  'GUARDIAN_EMAIL_INVALID',
  'GUARDIAN_CONSENT_REQUIRED',
  'CAPTCHA_REQUIRED',
  'RATE_LIMITED',
  'TOKEN_EXPIRED',
  'TOKEN_REVOKED',
  'TOKEN_INVALID',
  'FIELD_NOT_ALLOWED',
  'GUARDIAN_APPROVAL_REQUIRED',
  'SERVICE_UNAVAILABLE'
] as const;

export type VoucherConsentErrorKey = (typeof VOUCHER_CONSENT_ERROR_KEYS)[number];

export interface VoucherConsentFormValues {
  consent_rodo: boolean;
  consent_service_execution: boolean;
  consent_marketing: boolean;
  guardian_email: string;
  guardian_is_parent: boolean;
  captcha_token: string;
}

const emailSchema = z.string().email({ message: 'GUARDIAN_EMAIL_INVALID' });

export function createVoucherConsentSchema(ageCheckRequired: boolean) {
  return z
    .object({
      consent_rodo: z.boolean().refine(value => value === true, {
        message: 'RODO_CONSENT_REQUIRED'
      }),
      consent_service_execution: z.boolean().refine(value => value === true, {
        message: 'SERVICE_CONSENT_REQUIRED'
      }),
      consent_marketing: z.boolean().default(false),
      guardian_email: z.string().default(''),
      guardian_is_parent: z.boolean().default(false),
      captcha_token: z.string().default('')
    })
    .superRefine((value, ctx) => {
      if (!ageCheckRequired) return;

      if (!emailSchema.safeParse(value.guardian_email).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardian_email'],
          message: 'GUARDIAN_EMAIL_INVALID'
        });
      }
      if (value.guardian_is_parent !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['guardian_is_parent'],
          message: 'GUARDIAN_CONSENT_REQUIRED'
        });
      }
      if (!value.captcha_token || value.captcha_token.trim().length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['captcha_token'],
          message: 'CAPTCHA_REQUIRED'
        });
      }
    });
}

export function isVoucherConsentSubmitEnabled(
  values: Partial<VoucherConsentFormValues>,
  ageCheckRequired: boolean
): boolean {
  if (values.consent_rodo !== true || values.consent_service_execution !== true) {
    return false;
  }
  if (!ageCheckRequired) {
    return true;
  }
  return (
    typeof values.guardian_email === 'string' &&
    emailSchema.safeParse(values.guardian_email).success &&
    values.guardian_is_parent === true &&
    typeof values.captcha_token === 'string' &&
    values.captcha_token.trim().length >= 8
  );
}

function checkboxValue(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === 'true' || value === 'on';
}

export function formDataToVoucherConsentValues(formData: FormData): VoucherConsentFormValues {
  return {
    consent_rodo: checkboxValue(formData, 'consent_rodo'),
    consent_service_execution: checkboxValue(formData, 'consent_service_execution'),
    consent_marketing: checkboxValue(formData, 'consent_marketing'),
    guardian_email: String(formData.get('guardian_email') ?? '').trim(),
    guardian_is_parent: checkboxValue(formData, 'guardian_is_parent'),
    captcha_token: String(formData.get('captcha_token') ?? '').trim()
  };
}

export function firstVoucherConsentError(error: unknown): VoucherConsentErrorKey {
  if (error instanceof z.ZodError) {
    const message = error.issues[0]?.message;
    if (
      typeof message === 'string' &&
      (VOUCHER_CONSENT_ERROR_KEYS as readonly string[]).includes(message)
    ) {
      return message as VoucherConsentErrorKey;
    }
  }
  return 'FIELD_NOT_ALLOWED';
}
