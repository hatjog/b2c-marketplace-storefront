import type { HttpTypes } from '@medusajs/types';
import { Heading, Text } from '@medusajs/ui';

export const OrderConfirmedSection = ({ order }: { order: HttpTypes.StoreOrder }) => {
  return (
    <div className="py-6">
      <div className="content-container mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center gap-y-10">
        <div
          className="flex h-full w-full max-w-4xl flex-col gap-4 bg-white py-10"
          data-testid="order-complete-container"
        >
          <div className="w-full text-center">
            <Heading
              level="h1"
              className="text-ui-fg-base mb-4 flex flex-col gap-y-3 text-3xl"
            >
              <span>Thank you!</span>
              <span>Your order was placed successfully.</span>
            </Heading>

            <Text>
              We have sent the order confirmation details to{' '}
              <span
                className="text-ui-fg-medium-plus font-semibold"
                data-testid="order-email"
              >
                {order.email}
              </span>
              .
            </Text>
          </div>
          {/* <OrderDetails order={order} />
          <OrderItems order={order} />
          <OrderTotals totals={order} />
          <OrderShipping order={order} /> */}
          {/*<PaymentDetails order={order} />
          <Help /> */}
        </div>
      </div>
    </div>
  );
};
