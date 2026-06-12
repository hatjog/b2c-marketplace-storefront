import { convertToLocale } from '@/lib/helpers/money';

export const CartItemsFooter = ({
  currency_code,
  price,
  label = 'Delivery'
}: {
  currency_code: string;
  price: number;
  label?: string;
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
