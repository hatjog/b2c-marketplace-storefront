import { Card, Checkbox } from '@/components/atoms';
import type { ReturnShippingOption } from '@/lib/data/orders';

export const ReturnMethodsTab = ({
  shippingMethods,
  handleSetReturnMethod,
  returnMethod,
  seller
}: {
  shippingMethods: ReturnShippingOption[];
  handleSetReturnMethod: (methodId: string) => void;
  returnMethod: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  seller: any; // upstream: seller shape from Mercur order not fully typed here
}) => {
  const noShippingMethods = !shippingMethods?.length || false;

  return (
    <>
      <div className="mb-8">
        <Card className="bg-secondary p-4">
          <p className="label-lg uppercase">Return methods</p>
        </Card>
        <Card className="flex items-center justify-between p-4">
          {noShippingMethods ? (
            <div className="heading-md w-full py-4 text-center font-bold">
              No shipping methods available
            </div>
          ) : (
            <ul>
              {shippingMethods.map(method => (
                <li
                  key={method.id}
                  onClick={() => handleSetReturnMethod(method.id)}
                  className="my-2 flex cursor-pointer items-center gap-4"
                >
                  <Checkbox checked={returnMethod === method.id} />
                  <span className="label-lg">{method.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <div>
        <Card className="bg-secondary p-4">
          <p className="label-lg uppercase">Shipping address</p>
        </Card>
        <Card className="p-4">
          <p className="label-lg">{seller.name}</p>
          <p className="label-md">{seller.address_line}</p>
          <p className="label-md">
            {seller.city}, {seller.state}
          </p>
          <p className="label-md">
            {seller.postal_code}, {seller.country_code}
          </p>
          <p className="label-md">
            {seller.email}, {seller.phone}
          </p>
        </Card>
      </div>
    </>
  );
};
