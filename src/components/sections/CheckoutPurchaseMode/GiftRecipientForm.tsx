'use client';

import { useMemo, useState, type ReactElement } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/atoms';
import { updateGiftRecipientCartItems } from '@/lib/data/cart';
import {
  buildGiftRecipientIssueMetadata,
  GIFT_RECIPIENT_MESSAGE_MAX,
  todayISODate,
  validateGiftRecipientForm,
  type GiftRecipientFormData,
  type GiftRecipientIssueMetadata,
  type GiftRecipientSendTiming,
  type GiftRecipientValidationErrors
} from '@/lib/voucher/gift-recipient';

type GiftRecipientFormProps = {
  lineItemIds: string[];
  initialValue?: GiftRecipientIssueMetadata | null;
};

function toInitialFormData(
  initialValue?: GiftRecipientIssueMetadata | null
): GiftRecipientFormData {
  return {
    recipientEmail: initialValue?.gift_recipient_email ?? '',
    message: initialValue?.gift_recipient_message ?? '',
    sendTiming: initialValue?.gift_recipient_send_timing ?? 'now',
    sendDate: initialValue?.gift_recipient_send_date ?? null
  };
}

export function GiftRecipientForm({
  lineItemIds,
  initialValue
}: GiftRecipientFormProps): ReactElement {
  const t = useTranslations('seller.checkout.gift_recipient');
  const router = useRouter();
  const [formData, setFormData] = useState<GiftRecipientFormData>(() =>
    toInitialFormData(initialValue)
  );
  const [errors, setErrors] = useState<GiftRecipientValidationErrors>({});
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [isSaving, setIsSaving] = useState(false);

  const messageLength = formData.message.length;
  const remaining = GIFT_RECIPIENT_MESSAGE_MAX - messageLength;
  const hasLineItems = lineItemIds.length > 0;

  const isValid = useMemo(
    () => Object.keys(validateGiftRecipientForm(formData)).length === 0,
    [formData]
  );

  const setField = <K extends keyof GiftRecipientFormData>(
    field: K,
    value: GiftRecipientFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setStatus('idle');
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleTimingChange = (value: GiftRecipientSendTiming) => {
    setFormData(prev => ({
      ...prev,
      sendTiming: value,
      sendDate: value === 'now' ? null : prev.sendDate
    }));
    setStatus('idle');
    setErrors(prev => ({ ...prev, sendDate: undefined }));
  };

  const handleSave = async () => {
    const nextErrors = validateGiftRecipientForm(formData);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0 || !hasLineItems) {
      setStatus('error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = buildGiftRecipientIssueMetadata(formData);
      await updateGiftRecipientCartItems({ lineItemIds, payload });
      setStatus('saved');
      router.refresh();
    } catch {
      setStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="rounded-[var(--bb-radius-panel)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface-muted)] p-4"
      data-testid="gift-recipient-form"
    >
      <div className="space-y-1">
        <h3 className="text-base font-medium text-[var(--text-primary)]">{t('heading')}</h3>
        <p className="text-sm text-[var(--text-secondary)]">{t('privacy_copy')}</p>
      </div>

      <div className="mt-4 grid gap-4">
        <label className="grid gap-2 text-sm font-medium text-[var(--text-primary)]">
          {t('email_label')}
          <input
            type="email"
            name="gift_recipient_email"
            autoComplete="email"
            value={formData.recipientEmail}
            onChange={event => setField('recipientEmail', event.target.value)}
            aria-invalid={errors.recipientEmail ? 'true' : undefined}
            className="rounded-[var(--bb-radius-input)] border border-[var(--bb-border-soft)] bg-white px-3 py-2 text-sm text-[var(--text-primary)]"
            data-testid="gift-recipient-email"
          />
          {errors.recipientEmail && (
            <span className="text-xs text-[var(--color-error)]">{t('email_error')}</span>
          )}
        </label>

        <label className="grid gap-2 text-sm font-medium text-[var(--text-primary)]">
          {t('message_label')}
          <textarea
            name="gift_recipient_message"
            value={formData.message}
            maxLength={GIFT_RECIPIENT_MESSAGE_MAX}
            onChange={event => setField('message', event.target.value)}
            aria-invalid={errors.message ? 'true' : undefined}
            className="min-h-24 rounded-[var(--bb-radius-input)] border border-[var(--bb-border-soft)] bg-white px-3 py-2 text-sm text-[var(--text-primary)]"
            data-testid="gift-recipient-message"
          />
          <span
            className="flex justify-between text-xs text-[var(--text-secondary)]"
            data-testid="gift-recipient-message-counter"
          >
            <span>{errors.message ? t('message_error') : t('message_hint')}</span>
            <span>
              {messageLength}/{GIFT_RECIPIENT_MESSAGE_MAX} ({remaining})
            </span>
          </span>
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium text-[var(--text-primary)]">
            {t('send_date_label')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {(['now', 'scheduled'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => handleTimingChange(option)}
                className={`rounded-full border px-3 py-2 text-sm ${
                  formData.sendTiming === option
                    ? 'border-[var(--bb-border-strong)] bg-[var(--cta)] text-white'
                    : 'border-[var(--bb-border-soft)] bg-white text-[var(--text-primary)]'
                }`}
                aria-pressed={formData.sendTiming === option}
                data-testid={`gift-recipient-send-${option}`}
              >
                {t(option === 'now' ? 'send_now' : 'send_scheduled')}
              </button>
            ))}
          </div>
          {formData.sendTiming === 'scheduled' && (
            <label className="grid gap-2 text-sm text-[var(--text-primary)]">
              {t('scheduled_date_label')}
              <input
                type="date"
                name="gift_recipient_send_date"
                value={formData.sendDate ?? ''}
                min={todayISODate()}
                onChange={event => setField('sendDate', event.target.value)}
                aria-invalid={errors.sendDate ? 'true' : undefined}
                className="w-fit rounded-[var(--bb-radius-input)] border border-[var(--bb-border-soft)] bg-white px-3 py-2 text-sm"
                data-testid="gift-recipient-send-date"
              />
              {errors.sendDate && (
                <span className="text-xs text-[var(--color-error)]">{t('send_date_error')}</span>
              )}
            </label>
          )}
        </fieldset>

        {/*
         * Test-only signal: this hidden input is NOT part of a native form
         * submit (binding is done via the updateGiftRecipientCartItems server
         * action). It exists solely as a queryable test hook so that unit /
         * integration tests can assert the form's binding-ready state without
         * mocking the server action.  The input carries no functional effect
         * in production.
         */}
        <input
          type="hidden"
          name="gift_recipient_bound_to_voucher_issue"
          value={isValid && hasLineItems ? 'true' : 'false'}
          data-testid="gift-recipient-issue-binding"
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="tonal"
            onClick={handleSave}
            loading={isSaving}
            disabled={!hasLineItems}
            data-testid="gift-recipient-save"
          >
            {t('save_cta')}
          </Button>
          {status === 'saved' && (
            <span
              className="text-sm text-[var(--text-secondary)]"
              data-testid="gift-recipient-save-status"
            >
              {t('saved_status')}
            </span>
          )}
          {status === 'error' && (
            <span
              role="alert"
              className="text-sm text-[var(--color-error)]"
              data-testid="gift-recipient-error-status"
            >
              {hasLineItems ? t('error_status') : t('missing_line_item_status')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
