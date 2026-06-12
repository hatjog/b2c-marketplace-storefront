type CheckoutCartReadinessLike = {
  shipping_address?: unknown;
  billing_address?: unknown;
  email?: unknown;
} | null;

type CheckoutPaymentReadinessInput = {
  cart: CheckoutCartReadinessLike;
  shippingComplete: boolean;
};

export function isCheckoutPaymentReady({
  cart,
  shippingComplete
}: CheckoutPaymentReadinessInput): boolean {
  return Boolean(
    cart &&
      cart.shipping_address &&
      cart.billing_address &&
      cart.email &&
      shippingComplete
  );
}
