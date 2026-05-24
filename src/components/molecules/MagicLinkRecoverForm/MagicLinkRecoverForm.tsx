'use client';

/**
 * MagicLinkRecoverForm — W3-05 request-a-recovery-link form (Story 5.3).
 *
 * v1.9.0 Wave F7 hardening (Epic-5-Review CRITICAL P0):
 *   - Single email field, neutral success copy (anti-enumeration).
 *   - Reuses useActionState pattern for inline server-action feedback.
 *   - Pre-fills email from optional initialEmail prop.
 *   - 7-day TTL helper text overrides Story 2.6 30-day mockup drift
 *     (Story 5.3 AC4).
 */

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';

import {
  requestMagicLinkRecover,
  type RequestMagicLinkRecoverState
} from '@/actions/recover-magic-link';

interface Props {
  locale: string;
  initialEmail?: string;
}

const INITIAL_STATE: RequestMagicLinkRecoverState = { status: 'idle' };

export function MagicLinkRecoverForm({ locale, initialEmail = '' }: Props) {
  const t = useTranslations('auth.magic_link_recover');
  const [state, formAction, pending] = useActionState(
    requestMagicLinkRecover,
    INITIAL_STATE
  );

  return (
    <form
      action={formAction}
      className="flex w-full flex-col gap-4"
      noValidate
      data-testid="magic-link-recover-form"
      aria-describedby="magic-link-recover-helper"
    >
      <input
        type="hidden"
        name="locale"
        value={locale}
      />
      <label
        htmlFor="magic-link-recover-email"
        className="text-sm font-medium text-[var(--text-primary)]"
      >
        {t('email_label')}
      </label>
      <input
        id="magic-link-recover-email"
        type="email"
        name="email"
        autoComplete="email"
        defaultValue={initialEmail}
        required
        placeholder={t('email_placeholder')}
        className="min-h-12 rounded-[16px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] px-4 py-3 text-base text-[var(--text-primary)] focus:border-[var(--color-focus-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]"
        aria-invalid={state.status === 'invalid' ? 'true' : undefined}
        data-testid="magic-link-recover-email"
      />
      <p
        id="magic-link-recover-helper"
        className="text-xs text-[var(--text-secondary)]"
      >
        {t('ttl_helper')}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-full bg-[var(--bg-action)] px-6 py-3 font-medium text-[var(--text-on-action)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="magic-link-recover-submit"
      >
        {pending ? t('submit_pending') : t('submit')}
      </button>

      {state.status === 'submitted' ? (
        <p
          role="status"
          className="rounded-[16px] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-3 text-sm text-[var(--text-primary)]"
          data-testid="magic-link-recover-success"
        >
          {t('success_body')}
        </p>
      ) : null}

      {state.status === 'invalid' ? (
        <p
          role="alert"
          className="text-sm text-[var(--color-error-700)]"
          data-testid="magic-link-recover-invalid"
        >
          {t('invalid_email')}
        </p>
      ) : null}

      {state.status === 'network_error' ? (
        <p
          role="alert"
          className="text-sm text-[var(--color-error-700)]"
          data-testid="magic-link-recover-network-error"
        >
          {t('network_error')}
        </p>
      ) : null}
    </form>
  );
}
