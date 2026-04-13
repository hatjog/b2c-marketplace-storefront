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
    <Checkbox
      checked={checked}
      disabled={disabled}
      onChange={() => (disabled ? null : onCheck(label))}
      label={
        <span
          className={cn(
            'label-md !font-normal',
            checked && '!font-semibold',
            disabled && 'text-disabled'
          )}
        >
          {label} {amount && <span className="label-sm !font-light">({amount})</span>}
        </span>
      }
      {...props}
    />
  );
};
