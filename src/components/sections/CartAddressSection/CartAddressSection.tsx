'use client';

import { useActionState, useEffect, useTransition, type FormEvent } from 'react';

import type { HttpTypes } from '@medusajs/types';
import { Heading, Text, useToggleState } from '@medusajs/ui';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import LocalizedClientLink from '@/components/molecules/LocalizedLink/LocalizedLink';
import ShippingAddress from '@/components/organisms/ShippingAddress/ShippingAddress';
import Spinner from '@/icons/spinner';
import {
  checkoutAddressPayloadFromFormData,
  type CheckoutAddressPayload
} from '@/lib/checkout/address-payload';
import { setAddresses } from '@/lib/data/cart';
import compareAddresses from '@/lib/helpers/compare-addresses';

export const CartAddressSection = ({
  cart,
  customer,
  forceExpanded = false,
  locked = false
}: {
  cart: HttpTypes.StoreCart | null;
  customer: HttpTypes.StoreCustomer | null;
  /** Story checkout-flow (Robert): render every section expanded at once instead of the
   *  one-at-a-time `?step=` accordion. Additive — defaults to the legacy behaviour. */
  forceExpanded?: boolean;
  /** Section's prerequisite not met yet → shown but greyed-out + non-interactive. */
  locked?: boolean;
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('seller.checkout');

  const isAddress = Boolean(
    cart?.shipping_address &&
    cart?.shipping_address.first_name &&
    cart?.shipping_address.last_name &&
    cart?.shipping_address.address_1 &&
    cart?.shipping_address.city &&
    cart?.shipping_address.postal_code &&
    cart?.shipping_address.country_code
  );
  const isOpen = forceExpanded || searchParams.get('step') === 'address' || !isAddress;

  const { state: sameAsBilling, toggle: toggleSameAsBilling } = useToggleState(
    cart?.shipping_address && cart?.billing_address
      ? compareAddresses(cart?.shipping_address, cart?.billing_address)
      : true
  );

  const [isPending, startTransition] = useTransition();
  const [message, formAction] = useActionState<string | null, CheckoutAddressPayload>(
    setAddresses,
    null
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = checkoutAddressPayloadFromFormData(new FormData(event.currentTarget));
    payload.same_as_billing = sameAsBilling;
    startTransition(() => {
      formAction(payload);
    });
  };

  // Build a checkout-step URL that PRESERVES existing query params (e.g. ?mode=gift
  // from the purchase-mode toggle). Hardcoding `pathname + '?step=address'` dropped
  // every other param, clobbering the toggle's ?mode= write (race → toggle "nie reaguje").
  const buildStepUrl = (step: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', step);
    return `${pathname}?${params.toString()}`;
  };

  useEffect(() => {
    if (!isAddress && message !== 'success') {
      router.replace(buildStepUrl('address'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddress, message, pathname, router, searchParams]);

  useEffect(() => {
    if (message === 'success') {
      router.replace(buildStepUrl('delivery'));
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message, pathname, router, searchParams]);

  const handleEdit = () => {
    router.replace(buildStepUrl('address'));
  };

  return (
    <div
      className="bb-section-shell"
      data-testid="checkout-step-address"
      data-locked={locked || undefined}
      aria-disabled={locked || undefined}
    >
      <div className={`step-head mb-6 flex flex-row items-center justify-between ${!isOpen && isAddress ? 'is-done' : ''}`}>
        <Heading
          level="h2"
          className="flex flex-row items-center gap-x-3"
        >
          <span className="step-num">{!isOpen && isAddress ? '✓' : '1'}</span>
          <span>{t('checkout_step_contact')}</span>
        </Heading>
        {!isOpen && isAddress && (
          <Text>
            <Button
              onClick={handleEdit}
              variant="tonal"
              data-testid="checkout-address-edit-button"
            >
              {t('address_edit_cta')}
            </Button>
          </Text>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        {isOpen ? (
          <div className="pb-8">
            <ShippingAddress
              customer={customer}
              checked={sameAsBilling}
              onChange={toggleSameAsBilling}
              cart={cart}
            />
            <Button
              type="submit"
              className="mt-6 rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
              data-testid="submit-address-button"
              variant="tonal"
              disabled={isPending}
            >
              {t('address_save_cta')}
            </Button>
            <ErrorMessage
              error={message && message !== 'success' ? message : null}
              data-testid="address-error-message"
            />
          </div>
        ) : (
          <div>
            <div className="text-small-regular">
              {cart && cart.shipping_address ? (
                <div className="flex items-start gap-x-8">
                  <div className="flex w-full items-start gap-x-1">
                    <div>
                      <Text className="txt-medium-plus font-bold">
                        {cart.shipping_address.first_name} {cart.shipping_address.last_name}
                      </Text>
                      <Text>
                        {cart.shipping_address.address_1} {cart.shipping_address.address_2},{' '}
                        {cart.shipping_address.postal_code} {cart.shipping_address.city},{' '}
                        {cart.shipping_address.country_code?.toUpperCase()}
                      </Text>
                      <Text>
                        {cart.email}, {cart.shipping_address.phone}
                      </Text>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Spinner />
                </div>
              )}
            </div>
          </div>
        )}
        {isAddress && !searchParams.get('step') && (
          <LocalizedClientLink href="/checkout?step=delivery">
            <Button
              className="mt-6 rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
              variant="tonal"
            >
              {t('continue_to_delivery_cta')}
            </Button>
          </LocalizedClientLink>
        )}
      </form>
    </div>
  );
};
