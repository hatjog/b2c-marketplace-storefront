'use client';

// @chrome-manifest: W6-05
// ModalShell — Wave 6 chrome W6-05. v1.8.0 BonBeauty DS modal patterns shell.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/modal-patterns.yaml
// CSS custom properties consumed: --bb-surface, --bb-surface-strong, --bb-shadow-lift,
//   --bb-border-soft, --bg-action, --bg-action-hover, --color-error, --text-primary,
//   --text-secondary, --text-on-action, --bb-radius-panel, --font-body, --font-display,
//   --font-weight-medium, --font-weight-bold, --space-4, --space-6, --space-8,
//   --anim-duration-base, --anim-ease-emphasized
// Exposed: --modal-z (300), --modal-max-width (520px), --modal-overlay-bg (var(--bb-overlay-backdrop))
//
// 5 use cases (Story 3.1 AC3) przez `variant` prop:
//   auth-required / age-verify / consent / confirm-destructive / detailed-info
// Composable shell props: title / body / actions
// a11y: focus trap + ESC close + scroll lock + aria-modal

import { useId, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { cn } from '@/lib/utils';

export type ModalVariant =
  | 'auth-required'
  | 'age-verify'
  | 'consent'
  | 'confirm-destructive'
  | 'detailed-info';

export interface ModalAction {
  id: string;
  label: string;
  onClick: () => void;
  variant?: 'filled' | 'tonal';
  destructive?: boolean;
}

export interface ModalShellProps {
  open: boolean;
  variant?: ModalVariant;
  title: string;
  body: ReactNode;
  actions?: ModalAction[];
  onClose: () => void;
  className?: string;
}

export function ModalShell({
  open,
  variant = 'detailed-info',
  title,
  body,
  actions = [],
  onClose,
  className,
}: ModalShellProps) {
  const t = useTranslations('modal');
  const titleId = useId();
  const bodyId = useId();
  const containerRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
    lockScroll: true,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--modal-z,300)] flex items-end justify-center sm:items-center"
      style={
        {
          '--modal-z': '300',
          '--modal-max-width': '520px',
          '--modal-overlay-bg': 'var(--bb-overlay-backdrop)',
        } as React.CSSProperties
      }
      data-testid="modal-shell-overlay"
    >
      <div
        className="absolute inset-0 bg-[var(--modal-overlay-bg,var(--bb-overlay-backdrop))]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        tabIndex={-1}
        data-testid="modal-shell"
        data-variant={variant}
        className={cn(
          'relative z-10 flex max-h-[85vh] w-full flex-col',
          'sm:max-w-[var(--modal-max-width,520px)]',
          'rounded-t-[var(--bb-radius-panel,16px)] sm:rounded-[var(--bb-radius-panel,16px)]',
          'border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] shadow-[var(--bb-shadow-lift)]',
          className
        )}
      >
        {/* slot: header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--bb-border-soft)] p-[var(--space-6,24px)]">
          <h2
            id={titleId}
            className={cn(
              'text-lg font-[var(--font-weight-bold)] text-[var(--text-primary)]',
              variant === 'confirm-destructive' && 'text-[var(--color-error)]'
            )}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            data-testid="modal-shell-close"
          >
            ✕
          </button>
        </div>

        {/* slot: body */}
        <div
          id={bodyId}
          className="flex-1 overflow-y-auto p-[var(--space-6,24px)] text-sm text-[var(--text-secondary)]"
        >
          {body}
        </div>

        {/* slot: actions */}
        {actions.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[var(--bb-border-soft)] p-[var(--space-6,24px)] sm:flex-row sm:justify-end">
            {actions.map((action) => (
              <Button
                key={action.id}
                variant={action.variant ?? (action.destructive ? 'tonal' : 'filled')}
                onClick={action.onClick}
                className={cn(
                  action.destructive &&
                    'border border-[var(--color-error)] text-[var(--color-error)]'
                )}
                data-testid={`modal-shell-action-${action.id}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
