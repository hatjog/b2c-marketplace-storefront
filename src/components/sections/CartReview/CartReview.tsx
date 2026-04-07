'use client';

import { useTranslations } from 'next-intl';

import { CartSummary } from '@/components/organisms';
import { PromoCode } from '@/components/organisms/PromoCode/PromoCode';

import { CartItems } from './CartItems';
import PaymentButton from './PaymentButton';

const Review = ({ cart }: { cart: any }) => {
  const t = useTranslations('checkout');
  const paidByGiftcard = cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0;

  const previousStepsCompleted =
    cart.shipping_address &&
    cart.shipping_methods.length > 0 &&
    (cart.payment_collection || paidByGiftcard);

  return (
    <div className="space-y-4">
      <div className="mb-6 w-full">
        <CartItems cart={cart} />
      </div>

      <div className={'mb-6'}>
        <PromoCode cart={cart} />
      </div>

      <div className="bb-section-shell bb-section-shell-strong mb-6 w-full">
        <CartSummary
          item_total={cart?.item_subtotal || 0}
          shipping_total={cart?.shipping_subtotal || 0}
          total={cart?.total || 0}
          currency_code={cart?.currency_code || ''}
          tax={cart?.tax_total || 0}
          discount_total={cart?.discount_total || 0}
        />
      </div>

      {previousStepsCompleted && (
        <>
          <p className="label-sm mb-3 text-center text-secondary">
            {t('payment_obligation_notice')}
          </p>
          <PaymentButton
            cart={cart}
            data-testid="submit-order-button"
          />
        </>
      )}
    </div>
  );
};

export default Review;
