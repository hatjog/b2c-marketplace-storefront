import { convertToLocale } from '@/lib/helpers/money';

export const CartItemsFooter = ({
  currency_code,
  price
}: {
  currency_code: string;
  price: number;
}) => {
  return (
    <div className="label-md flex items-center justify-between rounded-sm border p-4">
      <p className="text-secondary">Delivery</p>
      <p>
        {convertToLocale({
          amount: price / 1,
          currency_code
        })}
      </p>
    </div>
  );
};
