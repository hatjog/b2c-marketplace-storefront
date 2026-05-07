'use client';

import React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { grantConsent } from '@/actions/voucher-consent';
import type { ConsentActionResult } from '@/actions/voucher-consent';

/**
 * <ConsentMomentInline> — UX-DR4 voucher PII consent moment.
 *
 * AC mappings:
 *   AC-VPII-2.1-01 — native <dialog> + role/aria-modal/aria-describedby + ESC + active opt-in
 *   AC-VPII-2.1-02 — no-JS fallback via <form action> (Server Action handles both paths)
 *   AC-VPII-2.1-03 — every visible string from next-intl `voucher.consent.*` keys
 *   AC-VPII-2.1-04 — Server Action `grantConsent` returns ConsentActionResult
 *
 * Implementation notes:
 *   - Native React 19 <dialog> with `showModal()` for focus trap + ESC handling
 *     (D-66 zero-deps choice — NIE Radix / Headless UI).
 *   - Checkbox is NOT pre-checked. CTA disabled until checkbox checked.
 *   - "Skip without consent" CTA shares min-h-12 min-w-12 px-6 py-3 with grant
 *     CTA (NFR-A11Y-5 visual parity ±10%; UX-DR23).
 *   - sessionStorage NEVER receives PII; consent moment carries `token` only.
 */

export interface ConsentMomentInlineProps {
  token: string;
  locale: string;
  privacyPolicyHref: string;
  /** When true, dialog opens via showModal on mount (JS path). */
  autoOpen?: boolean;
  onSkip?: () => void;
  onResult?: (result: ConsentActionResult) => void;
}

export function ConsentMomentInline({
  token,
  locale,
  privacyPolicyHref,
  autoOpen = true,
  onSkip,
  onResult
}: ConsentMomentInlineProps): React.ReactElement {
  const t = useTranslations('voucher.consent');
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const purposeId = useId();
  const tooltipId = useId();
  const errorId = useId();

  const [consentChecked, setConsentChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!autoOpen) return;
    const node = dialogRef.current;
    if (!node) return;
    if (typeof node.showModal === 'function' && !node.open) {
      try {
        node.showModal();
      } catch {
        /* showModal can throw if already open — non-fatal */
      }
    }
  }, [autoOpen]);

  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    setErrorMessage(null);
    formData.set('surface', 'js');
    const result = await grantConsent(formData);
    setPending(false);
    if (!result.ok) {
      setErrorMessage(t('error_audit_failed'));
    } else if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onResult?.(result);
  }

  function handleSkip(): void {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onSkip?.();
  }

  return (
    <dialog
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-describedby={purposeId}
      aria-labelledby={`${purposeId}-heading`}
      data-testid="consent-moment-dialog"
      className="m-auto max-w-[560px] rounded-md bg-primary p-6 shadow-lg backdrop:bg-tertiary/60"
    >
      <h2
        id={`${purposeId}-heading`}
        className="heading-md mb-4 uppercase"
      >
        {t('heading')}
      </h2>
      <p
        id={purposeId}
        data-testid="consent-purpose"
        className="mb-4 text-base leading-relaxed"
      >
        {t('purpose')}{' '}
        <a
          href={privacyPolicyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          aria-label={t('privacy_link_aria')}
        >
          {t('privacy_link')}
        </a>
      </p>

      {errorMessage ? (
        <p
          id={errorId}
          role="alert"
          className="mb-4 rounded-sm bg-red-50 p-3 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <form
        action={handleSubmit}
        className="flex flex-col gap-4"
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
        {/* Surface defaults to no-js for the no-JS fallback; JS path overrides via handleSubmit. */}
        <input
          type="hidden"
          name="surface"
          value="no-js"
        />

        <label className="flex items-start gap-3 text-base">
          <input
            type="checkbox"
            name="consent"
            value="on"
            checked={consentChecked}
            onChange={(event) => setConsentChecked(event.target.checked)}
            aria-describedby={purposeId}
            aria-label={t('checkbox_aria')}
            data-testid="consent-checkbox"
            className="mt-1 size-5"
            required
          />
          <span>{t('checkbox_label')}</span>
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleSkip}
            data-testid="consent-skip-cta"
            className="min-h-12 min-w-12 rounded-sm border border-tertiary px-6 py-3 text-base font-medium hover:bg-tertiary/10"
          >
            {t('skip_cta')}
          </button>
          <button
            type="submit"
            disabled={!consentChecked || pending}
            aria-describedby={!consentChecked ? tooltipId : undefined}
            data-testid="consent-grant-cta"
            className="min-h-12 min-w-12 rounded-sm bg-action px-6 py-3 text-base font-medium text-action-on-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t('pending_cta') : t('grant_cta')}
          </button>
        </div>
        {!consentChecked ? (
          <p
            id={tooltipId}
            data-testid="consent-tooltip"
            className="text-sm text-tertiary"
          >
            {t('tooltip_required')}
          </p>
        ) : null}
      </form>
    </dialog>
  );
}
