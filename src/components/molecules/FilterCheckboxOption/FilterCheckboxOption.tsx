import { Checkbox } from '@/components/atoms';
import { cn } from '@/lib/utils';

export const FilterCheckboxOption = ({
  label,
  amount,
  checked = false,
  onCheck = () => null,
  disabled = false,
  ...props
}: {
  label: string;
  amount?: number;
  checked?: boolean;
  onCheck?: (option: string) => void;
  disabled?: boolean;
  'data-testid'?: string;
}) => {
  return (
    <label
      className={cn('flex cursor-pointer items-center gap-4', disabled && '!cursor-default')}
      onClick={() => (disabled ? null : onCheck(label))}
      {...props}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
      />
      <p
        className={cn(
          'label-md !font-normal',
          checked && '!font-semibold',
          disabled && 'text-disabled'
        )}
      >
        {label} {amount && <span className="label-sm !font-light">({amount})</span>}
      </p>
    </label>
  );
};
