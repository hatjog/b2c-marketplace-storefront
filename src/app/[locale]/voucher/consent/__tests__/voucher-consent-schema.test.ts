import { describe, expect, it } from 'vitest';

import {
  createVoucherConsentSchema,
  formDataToVoucherConsentValues,
  isVoucherConsentSubmitEnabled
} from '@/lib/voucher-consent/schema';

describe('voucher consent form rules', () => {
  it('keeps adult CTA disabled until both mandatory consents are checked', () => {
    expect(
      isVoucherConsentSubmitEnabled(
        {
          consent_rodo: false,
          consent_service_execution: false,
          consent_marketing: true
        },
        false
      )
    ).toBe(false);

    expect(
      isVoucherConsentSubmitEnabled(
        {
          consent_rodo: true,
          consent_service_execution: true,
          consent_marketing: false
        },
        false
      )
    ).toBe(true);
  });

  it('does not require optional marketing consent', () => {
    const schema = createVoucherConsentSchema(false);

    expect(
      schema.safeParse({
        consent_rodo: true,
        consent_service_execution: true,
        consent_marketing: false,
        guardian_email: '',
        guardian_is_parent: false,
        captcha_token: ''
      }).success
    ).toBe(true);
  });

  it('requires guardian email, parent checkbox, and captcha in minor path', () => {
    expect(
      isVoucherConsentSubmitEnabled(
        {
          consent_rodo: true,
          consent_service_execution: true,
          guardian_email: 'guardian@example.test',
          guardian_is_parent: true,
          captcha_token: 'test-captcha-token'
        },
        true
      )
    ).toBe(true);

    expect(
      isVoucherConsentSubmitEnabled(
        {
          consent_rodo: true,
          consent_service_execution: true,
          guardian_email: 'invalid',
          guardian_is_parent: true,
          captcha_token: 'test-captcha-token'
        },
        true
      )
    ).toBe(false);
  });

  it('maps zod validation errors to i18n keys instead of raw zod codes', () => {
    const result = createVoucherConsentSchema(true).safeParse({
      consent_rodo: false,
      consent_service_execution: true,
      consent_marketing: false,
      guardian_email: 'bad-email',
      guardian_is_parent: false,
      captcha_token: ''
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(issue => issue.message);
      expect(messages).toContain('RODO_CONSENT_REQUIRED');
      expect(messages).toContain('GUARDIAN_EMAIL_INVALID');
      expect(messages).toContain('GUARDIAN_CONSENT_REQUIRED');
      expect(messages).not.toContain('invalid_string');
    }
  });

  it('parses missing checkbox fields as false for explicit opt-in defaults', () => {
    const formData = new FormData();
    formData.set('consent_service_execution', 'on');

    expect(formDataToVoucherConsentValues(formData)).toEqual(
      expect.objectContaining({
        consent_rodo: false,
        consent_service_execution: true,
        consent_marketing: false,
        guardian_is_parent: false
      })
    );
  });
});
