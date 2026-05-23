'use client';

import { useActionState, useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Script from 'next/script';
import { useForm } from 'react-hook-form';

import { submitVoucherConsent } from '@/actions/voucher-kyc-consent';
import { initialVoucherConsentActionState } from '@/actions/voucher-kyc-consent-state';
import {
  createVoucherConsentSchema,
  isVoucherConsentSubmitEnabled,
  type VoucherConsentFormValues
} from '@/lib/voucher-consent/schema';

declare global {
  interface Window {
    __gpVoucherConsentCaptcha?: (token: string) => void;
  }
}

interface ConsentFormProps {
  token: string;
  locale: string;
  ageCheckRequired: boolean;
  captchaSiteKey: string | null;
}

function errorKey(message: unknown): string | null {
  return typeof message === 'string' && message.length > 0 ? `error_${message}` : null;
}

export function ConsentForm({ token, locale, ageCheckRequired, captchaSiteKey }: ConsentFormProps) {
  const t = useTranslations('voucher-consent');
  const schema = createVoucherConsentSchema(ageCheckRequired);
  const [serverState, formAction, pending] = useActionState(
    submitVoucherConsent,
    initialVoucherConsentActionState
  );
  const {
    register,
    setValue,
    watch,
    formState: { errors }
  } = useForm<VoucherConsentFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      consent_rodo: false,
      consent_service_execution: false,
      consent_marketing: false,
      guardian_email: '',
      guardian_is_parent: false,
      captcha_token: ''
    }
  });

  useEffect(() => {
    window.__gpVoucherConsentCaptcha = (captchaToken: string) => {
      setValue('captcha_token', captchaToken, { shouldDirty: true, shouldValidate: true });
    };
    return () => {
      delete window.__gpVoucherConsentCaptcha;
    };
  }, [setValue]);

  const values = watch();
  const submitEnabled = isVoucherConsentSubmitEnabled(values, ageCheckRequired) && !pending;
  const serverErrorKey = serverState.status === 'error' ? `error_${serverState.error}` : null;

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-5"
      data-testid="voucher-consent-form"
    >
      <input
        type="hidden"
        name="token"
        value={token}
      />
      <input
        type="hidden"
        name="locale"
        value={locale}
      />
      <input
        type="hidden"
        name="age_check_required"
        value={ageCheckRequired ? 'true' : 'false'}
      />

      {serverState.status === 'success' && (
        <p
          role="status"
          className="rounded-sm border border-positive bg-positive-secondary px-4 py-3 text-sm text-positive"
          data-testid="voucher-consent-success"
        >
          {t('success_message')}
        </p>
      )}

      {serverErrorKey && (
        <p
          role="alert"
          className="rounded-sm border border-negative bg-negative-secondary px-4 py-3 text-sm text-negative"
          data-testid="voucher-consent-server-error"
        >
          {t(serverErrorKey, {
            minutes: Math.ceil((serverState.retryAfter ?? 60) / 60)
          })}
        </p>
      )}

      {ageCheckRequired && (
        <fieldset
          className="flex flex-col gap-3 rounded-sm border border-tertiary p-4"
          data-testid="voucher-consent-guardian-section"
        >
          <legend className="label-md px-1 text-primary">{t('guardian_section_title')}</legend>
          <label className="flex flex-col gap-2">
            <span className="label-md text-primary">{t('label_guardian_email')}</span>
            <input
              type="email"
              autoComplete="email"
              placeholder={t('placeholder_guardian_email')}
              className="min-h-12 rounded-sm border border-primary bg-primary px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-action"
              data-testid="guardian-email-input"
              {...register('guardian_email')}
            />
          </label>
          {errorKey(errors.guardian_email?.message) && (
            <p className="text-sm text-negative">
              {t(errorKey(errors.guardian_email?.message) as string)}
            </p>
          )}
          <label className="flex items-start gap-3 text-sm text-primary">
            <input
              type="checkbox"
              className="mt-1 size-5 rounded-sm border border-primary"
              data-testid="guardian-is-parent-checkbox"
              {...register('guardian_is_parent')}
            />
            <span>{t('label_guardian_is_parent')}</span>
          </label>
          {errorKey(errors.guardian_is_parent?.message) && (
            <p className="text-sm text-negative">
              {t(errorKey(errors.guardian_is_parent?.message) as string)}
            </p>
          )}
          <p
            className="text-sm text-secondary"
            data-testid="guardian-privacy-notice"
          >
            {t('privacy_guardian_email_notice')}
          </p>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">{t('consent_section_title')}</legend>
        <label className="flex items-start gap-3 text-sm text-primary">
          <input
            type="checkbox"
            className="mt-1 size-5 rounded-sm border border-primary"
            data-testid="consent-rodo-checkbox"
            {...register('consent_rodo')}
          />
          <span>{t('label_rodo')}</span>
        </label>
        {errorKey(errors.consent_rodo?.message) && (
          <p className="text-sm text-negative">
            {t(errorKey(errors.consent_rodo?.message) as string)}
          </p>
        )}
        <label className="flex items-start gap-3 text-sm text-primary">
          <input
            type="checkbox"
            className="mt-1 size-5 rounded-sm border border-primary"
            data-testid="consent-service-execution-checkbox"
            {...register('consent_service_execution')}
          />
          <span>{t('label_service_execution')}</span>
        </label>
        {errorKey(errors.consent_service_execution?.message) && (
          <p className="text-sm text-negative">
            {t(errorKey(errors.consent_service_execution?.message) as string)}
          </p>
        )}
        <label className="flex items-start gap-3 text-sm text-primary">
          <input
            type="checkbox"
            className="mt-1 size-5 rounded-sm border border-primary"
            data-testid="consent-marketing-checkbox"
            {...register('consent_marketing')}
          />
          <span>
            {t('label_marketing')} <span className="text-secondary">{t('label_optional')}</span>
          </span>
        </label>
      </fieldset>

      {ageCheckRequired && (
        <div
          className="flex flex-col gap-2"
          data-testid="voucher-consent-captcha"
        >
          {captchaSiteKey ? (
            <>
              <input
                type="hidden"
                {...register('captcha_token')}
              />
              <Script
                src="https://js.hcaptcha.com/1/api.js"
                strategy="afterInteractive"
              />
              <div
                className="h-captcha"
                data-sitekey={captchaSiteKey}
                data-callback="__gpVoucherConsentCaptcha"
              />
            </>
          ) : (
            <label className="flex flex-col gap-2">
              <span className="label-md text-primary">{t('captcha_label')}</span>
              <input
                type="text"
                placeholder={t('captcha_placeholder')}
                className="min-h-12 rounded-sm border border-primary bg-primary px-4 py-3 text-primary focus:outline-none focus:ring-2 focus:ring-action"
                data-testid="captcha-token-input"
                {...register('captcha_token')}
              />
            </label>
          )}
          {errorKey(errors.captcha_token?.message) && (
            <p className="text-sm text-negative">
              {t(errorKey(errors.captcha_token?.message) as string)}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={!submitEnabled}
        aria-disabled={!submitEnabled}
        className="min-h-12 rounded-sm bg-action px-6 py-3 font-medium text-action-on-primary disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="voucher-consent-submit"
      >
        {pending ? t('cta_pending') : t('cta_submit')}
      </button>
    </form>
  );
}
