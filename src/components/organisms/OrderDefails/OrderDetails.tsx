import type { HttpTypes } from '@medusajs/types';
import { Text } from '@medusajs/ui';
import { format } from 'date-fns';

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder;
  showStatus?: boolean;
};

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const _formatStatus = (str: string) => {
    const formatted = str.split('_').join(' ');

    return formatted.slice(0, 1).toUpperCase() + formatted.slice(1);
  };

  return (
    <div className="bg-ui-bg-subtle grid rounded-sm border p-4 lg:grid-cols-2">
      <Text className="mt-2">
        <span className="block font-bold">Order date</span>
        <span>{format(order.created_at, 'dd-MM-yyyy')}</span>
      </Text>
      <Text className="text-ui-fg-interactive mt-2">
        <span className="block font-bold">Order number</span> #<span>{order.display_id}</span>
      </Text>
      {showStatus && (
        <div className="text-compact-small mt-4 flex items-center gap-x-4 lg:col-span-2">
          <>
            <Text>
              Order status:{' '}
              <span
                className="text-ui-fg-subtle"
                data-testid="order-status"
              >
                {/* order.fulfillment_status (HttpTypes.StoreOrder) is the source;
                    display deferred — showStatus prop controls visibility but
                    rendering is intentionally blank until UX copy is finalised. */}
                {/* {_formatStatus(order.fulfillment_status)} */}
              </span>
            </Text>
            <Text>
              Payment status:{' '}
              <span
                className="text-ui-fg-subtle"
                sata-testid="order-payment-status"
              >
                {/* {_formatStatus(order.payment_status)} */}
              </span>
            </Text>
          </>
        </div>
      )}
    </div>
  );
};

export default OrderDetails;
