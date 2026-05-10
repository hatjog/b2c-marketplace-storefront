/**
 * Chip — BonBeauty DS foundational atom.
 *
 * v1.7.0 Story 2.1: Replaced raw hover:bg-gray-200 with token-bound
 * hover:bg-component-secondary (--bg-component-secondary via colors.css).
 * All hover/active/disabled states now use design token vars.
 *
 * v1.7.0 Story 2.1 review-2 fix (HIGH/1, WCAG SC 2.1.1): added keyboard
 *   activation handler (Enter / Space) so a Chip rendered with role="button"
 *   can be activated by keyboard users, not only by pointer. Previously the
 *   element was focusable via tabIndex=0 but had no onKeyDown — keyboard
 *   users would land on it and be stuck.
 * v1.7.0 Story 2.1 review-2 fix (MEDIUM/3): when `color={true}` the inline
 *   backgroundColor is sourced ONLY from a string `value` (CSS color literal).
 *   Non-string values silently produced `[object Object]` as a CSS color.
 *
 * ARCH-007: BonBeauty DS customer-facing storefront only.
 */
import { cn } from '@/lib/utils';

interface ChipProps {
  value?: React.ReactNode | string;
  selected?: boolean;
  disabled?: boolean;
  color?: boolean;
  onSelect?: () => void;
  className?: string;
  'data-testid'?: string;
}

export function Chip({
  value,
  selected,
  disabled,
  color,
  onSelect,
  className,
  'data-testid': dataTestId
}: ChipProps) {
  const baseClasses = 'chip-wrapper';
  const selectedClasses = selected ? 'border-primary' : '';
  // v1.7.0: replaced raw hover:bg-gray-200 → token-bound bg-component-secondary-hover
  const hoverClasses = !disabled && !selected ? 'hover:bg-component-secondary' : '';
  const disabledClasses = disabled
    ? 'bg-component border-disabled/50 hover:bg-component cursor-not-allowed text-disabled'
    : 'cursor-pointer';
  const colorClasses = color ? 'w-[40px] h-[40px] border' : '';

  // v1.7.0 Story 2.1 review-2 fix (HIGH/1): keyboard activation contract for
  // role="button" — Enter and Space must invoke onSelect (Space also needs
  // preventDefault so it does not scroll the page).
  const handleKeyDown = !disabled && onSelect
    ? (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          onSelect();
        }
      }
    : undefined;

  // v1.7.0 Story 2.1 review-2 fix (MEDIUM/3): only honour `value` for the swatch
  // background when it is a string (CSS color literal). Non-string ReactNodes
  // would produce `[object Object]` as a CSS color which silently breaks the
  // swatch render.
  const swatchBackground = typeof value === 'string' ? value : undefined;

  return (
    <div
      data-disabled={disabled}
      className={cn(
        baseClasses,
        colorClasses,
        selectedClasses,
        hoverClasses,
        disabledClasses,
        className
      )}
      onClick={!disabled ? onSelect : undefined}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected ? true : undefined}
      aria-disabled={disabled || undefined}
      data-testid={dataTestId ?? 'chip'}
    >
      {color ? (
        <span
          className={cn(
            'absolute left-[3px] top-[3px] h-[32px] w-[32px] rounded-xs bg-action',
            disabled && 'bg-disabled'
          )}
          style={swatchBackground ? { backgroundColor: swatchBackground } : undefined}
        />
      ) : (
        value
      )}
    </div>
  );
}
