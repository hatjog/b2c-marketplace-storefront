import { convertToLocale } from '@/lib/helpers/money';

// `label` is required and has NO literal default: a default parameter renders
// exactly like a written attribute, so a literal here ships untranslated copy.
export const CartItemsFooter = ({
  currency_code,
  price,
  label
}: {
  currency_code: string;
  price: number;
  label: string;
}) => {
  return (
    <div className="label-md flex items-center justify-between rounded-[var(--bb-radius-card)] border border-[var(--bb-border-soft)] bg-[var(--bb-surface)] p-4">
      <p className="text-secondary">{label}</p>
      <p>
        {convertToLocale({
          amount: price / 1,
          currency_code
        })}
      </p>
    </div>
  );
};
