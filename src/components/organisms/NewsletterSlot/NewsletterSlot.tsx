'use client';

// @chrome-manifest: W6-03
// NewsletterSlot — Wave 6 chrome W6-03. v1.8.0 BonBeauty DS newsletter slot.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/newsletter-slot.yaml
// CSS custom properties consumed: --bb-surface, --bb-surface-strong, --bg-action,
//   --bg-action-hover, --text-primary, --text-secondary, --text-on-action, --cta,
//   --bb-border-soft, --bb-radius-card, --font-body, --font-weight-medium,
//   --space-4, --space-6, --anim-duration-base
// Exposed: --newsletter-slot-bg (var(--bb-surface)), --newsletter-slot-accent (var(--cta))
//
// Warianty (Story 3.1 AC1) przez `variant` prop:
//   inline-body   — embedded w content flow (np. między sekcjami bloga)
//   inline-footer  — kompaktowy pasek w footerze
//   modal-popup    — overlay triggered (exit-intent / timed) z ESC dismiss
//   success        — stan po submit (potwierdzenie)
import { useId, useState, type FormEvent } from 'react';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { cn } from '@/lib/utils';

export type NewsletterSlotVariant = 'inline-body' | 'inline-footer' | 'modal-popup' | 'success';

export interface NewsletterSlotProps {
  variant?: NewsletterSlotVariant;
  locale: string;
  onSubmit?: (email: string) => Promise<void>;
  onDismiss?: () => void;
  className?: string;
}

export function NewsletterSlot({
  variant = 'inline-body',
  locale: _locale,
  onSubmit,
  onDismiss,
  className
}: NewsletterSlotProps) {
  const t = useTranslations('newsletter');
  const inputId = useId();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(variant === 'success');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || pending) return;
    setPending(true);
    try {
      await onSubmit?.(email);
      setSubmitted(true);
    } finally {
      setPending(false);
    }
  }

  const isSuccess = submitted || variant === 'success';
  const isModal = variant === 'modal-popup';
  const isFooter = variant === 'inline-footer';

  const successView = (
    <div
      className="space-y-1 text-center"
      data-testid="newsletter-slot-success"
      data-variant="success"
    >
      <p className="text-base font-[var(--font-weight-medium)] text-[var(--text-primary)]">
        {t('success_title')}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">{t('success_message')}</p>
    </div>
  );

  const formView = (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex flex-col gap-[var(--space-4,16px)]',
        !isFooter && 'sm:flex-row sm:items-start'
      )}
    >
      <div className="flex-1 space-y-2">
        <label
          htmlFor={inputId}
          className="block text-sm font-[var(--font-weight-medium)] text-[var(--text-primary)]"
        >
          {t('headline')}
        </label>
        {!isFooter && <p className="text-sm text-[var(--text-secondary)]">{t('subline')}</p>}
        <input
          id={inputId}
          type="email"
          required
          aria-required="true"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t('email_placeholder')}
          className={cn(
            'w-full rounded-[var(--bb-radius-card,12px)] border border-[var(--bb-border-soft)]',
            'bg-[var(--bb-surface)] px-[var(--space-4,16px)] py-2 text-sm text-[var(--text-primary)]',
            'outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-action)]'
          )}
          data-testid="newsletter-slot-input"
        />
        {/* slot: legal — GDPR consent note (required all placements) */}
        <p
          className="text-xs text-[var(--text-secondary)]"
          data-testid="newsletter-slot-legal"
        >
          {t('legal')}
        </p>
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="shrink-0"
        data-testid="newsletter-slot-submit"
      >
        {t('submit')}
      </Button>
    </form>
  );

  const inner = (
    <section
      aria-label={t('aria_region')}
      data-testid="newsletter-slot"
      data-variant={variant}
      className={cn(
        'w-full',
        !isFooter &&
          'rounded-[var(--bb-radius-card,12px)] border border-[var(--bb-border-soft)] bg-[var(--newsletter-slot-bg,var(--bb-surface))] p-[var(--space-6,24px)]',
        isFooter && 'py-[var(--space-4,16px)]',
        className
      )}
      style={
        {
          '--newsletter-slot-bg': 'var(--bb-surface)',
          '--newsletter-slot-accent': 'var(--cta)'
        } as React.CSSProperties
      }
    >
      {isSuccess ? successView : formView}
    </section>
  );

  if (isModal && !isSuccess) {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-[var(--bb-overlay-backdrop)] p-4"
        role="dialog"
        aria-modal="true"
        aria-label={t('aria_region')}
        onKeyDown={e => {
          if (e.key === 'Escape') onDismiss?.();
        }}
        data-testid="newsletter-slot-modal-overlay"
      >
        <div className="w-full max-w-md">
          <div className="relative">
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('dismiss')}
              className="absolute right-3 top-3 z-10 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              data-testid="newsletter-slot-modal-close"
            >
              ✕
            </button>
            {inner}
          </div>
        </div>
      </div>
    );
  }

  return inner;
}
