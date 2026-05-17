'use client';

// @chrome-manifest: W6-06
// ToastAlert — Wave 6 chrome W6-06. v1.8.0 BonBeauty DS toast/alert system.
// Consumes Wave 6 contract: specs/design-system/bonbeauty/components/toast-alert-system.yaml
// CSS custom properties consumed: --bb-surface, --bb-surface-strong, --bb-shadow-lift,
//   --color-trust, --color-error, --color-warning, --color-success-bg, --color-error-bg,
//   --color-warning-bg, --text-primary, --text-on-action, --bb-radius-card,
//   --bb-border-soft, --font-body, --font-weight-medium, --space-4, --space-6,
//   --anim-duration-fast, --anim-duration-base, --anim-ease-standard
// Exposed: --toast-z (400), --toast-max-width (400px)
//
// 4 variants (Story 3.1 AC4): info / success / warning / error
// Placement (responsive): top-right desktop / top-full-width mobile
// ToastProvider queue context + auto-dismiss + aria-live (error → role=alert)

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';
export type ToastPlacement = 'top-right' | 'top-full-width';

export interface Toast {
  id: string;
  variant: ToastVariant;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  info: 'bg-[var(--bb-surface)] border-[var(--bb-border-soft)] text-[var(--text-primary)]',
  success:
    'bg-[var(--color-success-bg)] border-[var(--color-trust)] text-[var(--text-primary)]',
  warning:
    'bg-[var(--color-warning-bg)] border-[var(--color-warning)] text-[var(--text-primary)]',
  error:
    'bg-[var(--color-error-bg)] border-[var(--color-error)] text-[var(--text-primary)]',
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠️',
  error: '✕',
};

export interface ToastProviderProps {
  children: ReactNode;
  placement?: ToastPlacement;
  duration?: number;
}

export function ToastProvider({
  children,
  placement = 'top-right',
  duration = 5000,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss, duration]
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ toasts, push, dismiss }),
    [toasts, push, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport
        toasts={toasts}
        placement={placement}
        onDismiss={dismiss}
      />
    </ToastContext.Provider>
  );
}

interface ToastViewportProps {
  toasts: Toast[];
  placement: ToastPlacement;
  onDismiss: (id: string) => void;
}

export function ToastViewport({
  toasts,
  placement,
  onDismiss,
}: ToastViewportProps) {
  const t = useTranslations('toast');

  return (
    <div
      // aria-live region: polite for the stack, individual error toasts
      // upgrade to role=alert (assertive) per W6-06 a11y contract.
      role="log"
      aria-live="polite"
      aria-atomic="true"
      aria-label={t('aria_region')}
      data-testid="toast-viewport"
      data-placement={placement}
      className={cn(
        'pointer-events-none fixed z-[var(--toast-z,400)] flex flex-col gap-2',
        // top-full-width mobile / top-right desktop (responsive)
        'inset-x-0 top-0 p-[var(--space-4,16px)]',
        placement === 'top-right' &&
          'sm:inset-x-auto sm:right-0 sm:items-end sm:p-[var(--space-6,24px)]'
      )}
      style={{ '--toast-z': '400', '--toast-max-width': '400px' } as React.CSSProperties}
    >
      {toasts.map((toast) => {
        const isError = toast.variant === 'error';
        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            data-testid={`toast-${toast.variant}`}
            data-variant={toast.variant}
            className={cn(
              'pointer-events-auto flex w-full items-start gap-3 border p-[var(--space-4,16px)]',
              'rounded-[var(--bb-radius-card,12px)] shadow-[var(--bb-shadow-lift)]',
              'sm:max-w-[var(--toast-max-width,400px)]',
              'transition-transform duration-[var(--anim-duration-fast,150ms)]',
              VARIANT_STYLES[toast.variant]
            )}
          >
            <span aria-hidden="true" className="text-base leading-none">
              {VARIANT_ICON[toast.variant]}
            </span>
            <p className="flex-1 text-sm">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="text-sm font-[var(--font-weight-medium)] underline"
                data-testid={`toast-action-${toast.id}`}
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={t('dismiss')}
              className="shrink-0 text-[var(--text-primary)] opacity-60 hover:opacity-100"
              data-testid={`toast-dismiss-${toast.id}`}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
