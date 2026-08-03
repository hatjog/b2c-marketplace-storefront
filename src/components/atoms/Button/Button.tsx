'use client';

/**
 * Button — BonBeauty DS foundational atom.
 *
 * v1.7.0 Story 2.1: Token-bound states via BonBeauty CSS var chain.
 * All state treatments (hover/focus/active/disabled/loading/unavailable)
 * resolve through --bg-action-*, --content-action-*, --bg-disabled tokens
 * from src/styles/tokens/bb-surfaces.css + public/themes/bonbeauty.css.
 *
 * UX-PAT-4 full-state coverage:
 *   default, hover, focus-visible, active, disabled, loading, unavailable
 * WCAG 2.1 AA: min-h-[44px] touch target, focus-visible ring via globals.css :focus-visible.
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 */
import Spinner from '@/icons/spinner';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type ButtonVariant = 'filled' | 'tonal' | 'text' | 'destructive' | 'unavailable';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'small' | 'large';
  loading?: boolean;
  /** unavailable: item exists but cannot be acted on (sold-out, out-of-stock, etc.)
   *  Visually and semantically distinct from disabled (no action performed vs
   *  item not available for selection). aria-disabled + muted surface. */
  unavailable?: boolean;
  'data-testid'?: string;
}

export function Button({
  children,
  variant = 'filled',
  size = 'small',
  loading = false,
  disabled = false,
  unavailable = false,
  className,
  'data-testid': dataTestId,
  ...props
}: ButtonProps) {
  const t = useTranslations('common');
  // Unavailable overrides variant — item is not accessible, not just disabled
  const effectiveVariant: ButtonVariant = unavailable ? 'unavailable' : variant;

  const baseClasses =
    'text-md button-text rounded-sm min-h-[44px] transition-colors duration-150 ' +
    // Disabled via HTML disabled attr
    'disabled:bg-disabled disabled:text-disabled disabled:cursor-not-allowed ' +
    // Dark mode (admin/vendor usage — operational surfaces use Inter, not Funnel Display)
    'dark:bg-action-tertiary dark:hover:bg-action-tertiary-hover ' +
    'dark:active:bg-action-tertiary-pressed dark:disabled:bg-disabled';

  const variantClasses: Record<ButtonVariant, string> = {
    filled: [
      'bg-action text-action-on-primary',
      'hover:bg-action-hover',
      'active:bg-action-pressed',
      loading ? 'button-text-filled' : '',
    ].filter(Boolean).join(' '),

    tonal: [
      'bg-action-secondary text-action-on-secondary',
      'hover:bg-action-secondary-hover',
      'active:bg-action-secondary-pressed',
    ].join(' '),

    text: [
      'bg-primary text-primary',
      'dark:bg-primary',
      'hover:bg-action-secondary-hover',
      'active:bg-action-secondary-pressed',
    ].join(' '),

    destructive: [
      'text-negative-on-primary bg-negative',
      'hover:bg-negative-hover',
      'active:bg-negative-pressed',
      loading ? 'button-text-filled' : '',
    ].filter(Boolean).join(' '),

    /** unavailable: distinct amber/warning channel surface — item exists but is
     *  not actionable right now (e.g., sold-out CTA). v1.7.0 Story 2.1 review fix
     *  (HIGH/3): visually + semantically separated from `disabled` per Story 0.9
     *  contract — uses warning channel (matching StateCard `unavailable` for
     *  cross-component coherence) and dashed border as a non-color signal.
     *  Keeps element focusable (no pointer-events-none) so SR users can land on
     *  it and read aria-disabled / aria-describedby state. The visible click
     *  block is enforced via onClick guard at the consumer level — this primitive
     *  intentionally does NOT trap pointer events so focus and SR semantics work. */
    unavailable: [
      'bg-warning-secondary text-warning border border-warning border-dashed',
      'cursor-not-allowed',
    ].join(' '),
  };

  const sizeClasses: Record<'small' | 'large', string> = {
    small: 'px-[16px] py-[8px]',
    large: 'px-[24px] py-[8px]'
  };

  const isEffectivelyUnavailable = effectiveVariant === 'unavailable';
  // When marked unavailable, do NOT also set HTML `disabled` — aria-disabled is the
  // correct semantic per Story 0.9 ("item exists, just not actionable") and HTML
  // disabled removes the element from the tab order, defeating SR announcement.
  const htmlDisabled = unavailable ? false : disabled;
  // Block synthetic clicks while keeping keyboard focus — replaces the previous
  // `pointer-events-none` heuristic (which broke focus on some browsers).
  const { onClick: userOnClick, ...restProps } = props;
  const onClickGuarded = isEffectivelyUnavailable
    ? (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
      }
    : userOnClick;

  return (
    <button
      disabled={htmlDisabled}
      aria-disabled={isEffectivelyUnavailable || disabled || undefined}
      aria-busy={loading || undefined}
      data-state={isEffectivelyUnavailable ? 'unavailable' : disabled ? 'disabled' : undefined}
      className={cn(variantClasses[effectiveVariant], sizeClasses[size], baseClasses, className)}
      data-testid={dataTestId ?? `button-${effectiveVariant}-${size}`}
      onClick={onClickGuarded}
      {...restProps}
    >
      {loading ? <Spinner aria-label={t('loading')} role="status" /> : children}
    </button>
  );
}
