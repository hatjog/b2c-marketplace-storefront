'use client';

import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type FC } from 'react';

import { Listbox, Transition } from '@headlessui/react';
import { CheckCircleSolid, ChevronUpDown, Loader } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import { clx, Heading, Text } from '@medusajs/ui';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Button } from '@/components/atoms';
import ErrorMessage from '@/components/molecules/ErrorMessage/ErrorMessage';
import { removeShippingMethod, setShippingMethod } from '@/lib/data/cart';
import { calculatePriceForShippingOption } from '@/lib/data/fulfillment';
import { convertToLocale } from '@/lib/helpers/money';

import { CartShippingMethodRow } from './CartShippingMethodRow';

// Extended cart item product type to include seller
type ExtendedStoreProduct = HttpTypes.StoreProduct & {
  seller?: {
    id: string;
    name: string;
  };
};

// Cart item type definition
type CartItem = {
  product?: ExtendedStoreProduct;
  // Include other cart item properties as needed
};

export type StoreCardShippingMethod = HttpTypes.StoreCartShippingOption & {
  seller?: {
    id: string;
    name: string;
  };
  seller_id?: string;
  seller_name?: string;
  service_zone?: {
    fulfillment_set: {
      type: string;
    };
  };
};

type ShippingOptionRule = {
  attribute?: string;
  value?: unknown;
} & Record<string, unknown>;

export type AvailableShippingMethod = StoreCardShippingMethod & {
  rules?: ShippingOptionRule[]; // upstream: Medusa shipping option rules schema is open-ended
  price_type: string;
  id: string;
  amount?: number;
};

type ShippingProps = {
  cart: Omit<HttpTypes.StoreCart, 'items'> & {
    items?: CartItem[];
  };
  availableShippingMethods: AvailableShippingMethod[] | null;
};

function normalizeAvailableShippingMethods(value: unknown): AvailableShippingMethod[] {
  if (Array.isArray(value)) {
    return value as AvailableShippingMethod[];
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const flattenSellerMap = (candidate: unknown): AvailableShippingMethod[] | null => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return null;
    }

    const values = Object.values(candidate as Record<string, unknown>);
    if (values.length === 0 || !values.every(Array.isArray)) {
      return null;
    }

    return values.flat() as AvailableShippingMethod[];
  };

  const outer = (value as { shipping_options?: unknown }).shipping_options;
  if (Array.isArray(outer)) {
    return outer as AvailableShippingMethod[];
  }

  const outerSellerMap = flattenSellerMap(outer);
  if (outerSellerMap) {
    return outerSellerMap;
  }

  if (!outer || typeof outer !== 'object') {
    return [];
  }

  const inner = (outer as { shipping_options?: unknown }).shipping_options;
  const innerSellerMap = flattenSellerMap(inner);
  if (innerSellerMap) {
    return innerSellerMap;
  }

  return Array.isArray(inner) ? (inner as AvailableShippingMethod[]) : [];
}

const CartShippingMethodsSection: FC<ShippingProps> = ({ cart, availableShippingMethods }) => {
  const t = useTranslations('checkout');
  const tCommon = useTranslations('common');
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);
  const [calculatedPricesMap, setCalculatedPricesMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPendingDeleteRow, startTransitionDeleteRow] = useTransition();
  // Optimistic flag: enables the "continue to payment" button the moment a
  // shipping method is selected. router.refresh() does NOT reliably re-render
  // this section with the updated `cart` prop after setShippingMethod, so the
  // button stayed `disabled` even though the method persisted on the backend —
  // stranding the user on the delivery step. The backend cart IS updated, so
  // the next step's SSR sees the method; this flag only bridges the in-place
  // re-enable. One-directional sync below never resets it from a stale prop.
  const [hasShippingMethod, setHasShippingMethod] = useState(
    (cart.shipping_methods?.length ?? 0) > 0
  );

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const isOpen = searchParams.get('step') === 'delivery';

  const fallbackSeller = (() => {
    const sellers = Array.from(
      new Map(
        (cart.items ?? []).flatMap(item =>
          item.product?.seller ? [[item.product.seller.id, item.product.seller.name]] : []
        )
      ).entries()
    );

    if (sellers.length !== 1) {
      return null;
    }

    const [id, name] = sellers[0];
    return { id, name };
  })();

  const normalizedShippingMethods = normalizeAvailableShippingMethods(availableShippingMethods);

  const _shippingMethods = normalizedShippingMethods.filter(
    sm => sm.rules?.find(rule => rule.attribute === 'is_return')?.value !== 'true'
  );

  // Per-seller shipping coverage (orphaned-charge guard). Mercur completes one
  // order per seller and `/store/carts/:id/complete` requires a shipping method
  // for EVERY seller; gate "continue to payment" on full per-seller coverage,
  // not just `length >= 1` (a multi-seller cart with one method otherwise
  // advanced, got charged, then failed completion → orphaned charge).
  const optionToSeller = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of _shippingMethods) {
      const sellerId = m.seller?.id ?? m.seller_id ?? fallbackSeller?.id;
      if (m.id && sellerId) {
        map.set(m.id, sellerId);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedShippingMethods, fallbackSeller?.id]);

  const requiredSellerIds = useMemo(
    () => Array.from(new Set(optionToSeller.values())),
    [optionToSeller]
  );

  // Optimistically track selected option ids (seeded from cart). Mirrors the
  // `hasShippingMethod` optimism: router.refresh() does not reliably re-render
  // this section with the updated `cart` prop, so we add on select / drop on
  // remove and only ever MERGE (never reset) from the eventual fresh prop.
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(
    () =>
      new Set(
        (cart.shipping_methods ?? [])
          .map((m: { shipping_option_id?: string | null }) => m?.shipping_option_id)
          .filter((id: unknown): id is string => typeof id === 'string')
      )
  );

  const coveredSellerIds = useMemo(() => {
    const set = new Set<string>();
    for (const optionId of selectedOptionIds) {
      const sellerId = optionToSeller.get(optionId);
      if (sellerId) set.add(sellerId);
    }
    return set;
  }, [selectedOptionIds, optionToSeller]);

  const isShippingComplete =
    requiredSellerIds.length === 0
      ? hasShippingMethod
      : requiredSellerIds.every(id => coveredSellerIds.has(id));

  useEffect(() => {
    if (_shippingMethods?.length) {
      const promises = _shippingMethods
        .filter(sm => sm.price_type === 'calculated')
        .map(sm => calculatePriceForShippingOption(sm.id, cart.id));

      if (promises.length) {
        Promise.allSettled(promises).then(res => {
          const pricesMap: Record<string, number> = {};
          res
            .filter(r => r.status === 'fulfilled')
            .forEach(p => (pricesMap[p.value?.id || ''] = p.value?.amount!));

          setCalculatedPricesMap(pricesMap);
          setIsLoadingPrices(false);
        });
      }
    }
  }, [normalizedShippingMethods, _shippingMethods, cart.id]);

  // Advance to the given step, preserving existing params (e.g. ?mode=gift).
  // Uses a full navigation (window.location) on purpose: client-side soft nav
  // to a ?step= change is swallowed in this checkout (router.push never reaches
  // history; a <button> nested in next/link's <a> eats the click). The target
  // step is fully SSR-rendered, so a hard nav lands correctly and reliably.
  const goToStep = (step: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', step);
    window.location.assign(`${pathname}?${params.toString()}`);
  };

  const handleSubmit = () => {
    goToStep('payment');
  };

  const handleSetShippingMethod = async (id: string | null) => {
    if (!id) {
      return;
    }

    try {
      setError(null);
      setIsLoadingPrices(true);
      const res = await setShippingMethod({
        cartId: cart.id,
        shippingMethodId: id
      });
      if (!res.ok) {
        return setError(res.error?.message);
      }
      setHasShippingMethod(true);
      setSelectedOptionIds(prev => new Set(prev).add(id));
    } catch (error: any) {
      setError(error?.message?.replace('Error setting up the request: ', '') || t('error_generic'));
    } finally {
      setIsLoadingPrices(false);
      router.refresh();
    }
  };

  const handleRemoveShippingMethod = (methodId: string) => {
    setHasShippingMethod(false);
    // Drop the removed option from the optimistic set so per-seller coverage
    // reflects the removal immediately (map the cart method id → option id).
    const removedOptionId = (cart.shipping_methods ?? []).find(
      (m: { id?: string; shipping_option_id?: string | null }) => m?.id === methodId
    )?.shipping_option_id;
    if (removedOptionId) {
      setSelectedOptionIds(prev => {
        const next = new Set(prev);
        next.delete(removedOptionId);
        return next;
      });
    }
    startTransitionDeleteRow(async () => {
      await removeShippingMethod(methodId);
    });
    router.refresh();
  };

  useEffect(() => {
    setError(null);
  }, [isOpen]);

  // One-directional sync: when the (eventually) refreshed cart prop carries a
  // method, keep the flag true. Never reset to false here — a stale prop would
  // otherwise undo the optimistic enable. Removal flips it false explicitly.
  useEffect(() => {
    if ((cart.shipping_methods?.length ?? 0) > 0) {
      setHasShippingMethod(true);
    }
  }, [cart.shipping_methods?.length]);

  // One-directional MERGE of the (eventually) fresh cart's selected option ids
  // into the optimistic set, so a re-entered/SSR-fresh delivery step seeds
  // per-seller coverage. Never resets here — explicit removal handles drops.
  useEffect(() => {
    const ids = (cart.shipping_methods ?? [])
      .map((m: { shipping_option_id?: string | null }) => m?.shipping_option_id)
      .filter((id: unknown): id is string => typeof id === 'string');
    if (ids.length) {
      setSelectedOptionIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => next.add(id));
        return next;
      });
    }
  }, [cart.shipping_methods]);

  // Auto-select the sole available delivery option. A single-option checkout
  // (the BonBeauty case) otherwise strands the user: the Listbox requires an
  // explicit pick, and until one is made `cart.shipping_methods` is empty, so
  // the "continue to payment" button stays `disabled` and clicking it does
  // nothing. Guarded by a ref so it fires once per mount; once the cart carries
  // a method the guard short-circuits (and multi-option groups are untouched —
  // the user must choose).
  const autoSelectedShippingRef = useRef(false);
  useEffect(() => {
    if (autoSelectedShippingRef.current) return;
    if (!isOpen) return;
    if ((cart.shipping_methods?.length ?? 0) > 0) return;
    if (_shippingMethods.length !== 1) return;
    autoSelectedShippingRef.current = true;
    handleSetShippingMethod(_shippingMethods[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cart.shipping_methods?.length, _shippingMethods.length]);

  const groupedBySellerId = _shippingMethods?.reduce((acc: any, method) => {
    const sellerId = method.seller?.id ?? method.seller_id ?? fallbackSeller?.id ?? 'market';
    const sellerName =
      method.seller?.name ?? method.seller_name ?? fallbackSeller?.name ?? t('delivery_heading');

    if (!acc[sellerId]) {
      acc[sellerId] = [];
    }

    const amount = Number(
      method.price_type === 'flat' ? method.amount : calculatedPricesMap[method.id]
    );

    if (!isNaN(amount)) {
      acc[sellerId]?.push({
        ...method,
        seller_name: sellerName
      });
    }

    return acc;
  }, {});

  const handleEdit = () => {
    router.replace(pathname + '?step=delivery');
  };
  const isEditEnabled = !isOpen && !!cart?.shipping_methods?.length;

  const filteredGroupedBySellerId = Object.keys(groupedBySellerId || {}).filter(
    key => groupedBySellerId?.[key]?.[0]?.seller_name
  );

  return (
    <div className="bb-section-shell">
      <div className="mb-6 flex flex-row items-center justify-between">
        <Heading
          level="h2"
          className="text-3xl-regular flex flex-row items-baseline gap-x-2"
        >
          {!isOpen && (cart.shipping_methods?.length ?? 0) > 0 && <CheckCircleSolid />}
          {t('delivery_heading')}
        </Heading>
        {isEditEnabled && (
          <Text>
            <Button
              onClick={handleEdit}
              variant="tonal"
            >
              {tCommon('edit')}
            </Button>
          </Text>
        )}
      </div>
      {isOpen ? (
        <>
          <div className="grid">
            <div data-testid="delivery-options-container">
              <div className="pb-8 pt-2 md:pt-0">
                {filteredGroupedBySellerId.length === 0
                  ? t('no_shipping_options')
                  : filteredGroupedBySellerId.map(key => (
                      <div
                        key={key}
                        className="mb-4"
                      >
                        <Heading
                          level="h3"
                          className="mb-2"
                        >
                          {groupedBySellerId[key][0].seller_name}
                        </Heading>
                        <Listbox
                          value={cart.shipping_methods?.[0]?.id}
                          onChange={value => {
                            handleSetShippingMethod(value);
                          }}
                        >
                          <div className="relative">
                            <Listbox.Button
                              className={clsx(
                                'text-base-regular relative flex h-12 w-full cursor-default items-center justify-between rounded-lg border bg-component-secondary px-4 text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300'
                              )}
                            >
                              {({ open }) => (
                                <>
                                  <span className="block truncate">
                                    {t('choose_delivery_option')}
                                  </span>
                                  <ChevronUpDown
                                    className={clx('transition-rotate duration-200', {
                                      'rotate-180 transform': open
                                    })}
                                  />
                                </>
                              )}
                            </Listbox.Button>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                            >
                              <Listbox.Options
                                className="text-small-regular border-top-0 absolute z-20 max-h-60 w-full overflow-auto rounded-lg border bg-white focus:outline-none sm:text-sm"
                                data-testid="shipping-address-options"
                              >
                                {groupedBySellerId[key].map((option: any) => (
                                  <Listbox.Option
                                    className="relative cursor-pointer select-none border-b py-4 pl-6 pr-10 hover:bg-gray-50"
                                    value={option.id}
                                    key={option.id}
                                  >
                                    {option.name}
                                    {' - '}
                                    {option.price_type === 'flat' ? (
                                      convertToLocale({
                                        amount: option.amount ?? 0,
                                        currency_code: cart?.currency_code
                                      })
                                    ) : calculatedPricesMap[option.id] ? (
                                      convertToLocale({
                                        amount: calculatedPricesMap[option.id],
                                        currency_code: cart?.currency_code
                                      })
                                    ) : isLoadingPrices ? (
                                      <Loader />
                                    ) : (
                                      '-'
                                    )}
                                  </Listbox.Option>
                                ))}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        </Listbox>
                      </div>
                    ))}
                {!!cart?.shipping_methods?.length && (
                  <div className="flex flex-col">
                    {cart.shipping_methods?.map(method => (
                      <CartShippingMethodRow
                        key={method.id}
                        method={method}
                        currency_code={cart.currency_code}
                        onRemoveShippingMethod={handleRemoveShippingMethod}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div>
            <ErrorMessage
              error={error}
              data-testid="delivery-option-error-message"
            />
            {!isShippingComplete && requiredSellerIds.length > 1 && (
              <Text
                className="label-sm mb-2 text-[var(--text-secondary)]"
                data-testid="delivery-incomplete-hint"
                role="status"
              >
                {t('shipping_select_each_salon')}
              </Text>
            )}
            <Button
              onClick={handleSubmit}
              variant="tonal"
              disabled={!isShippingComplete || isPendingDeleteRow}
              loading={isLoadingPrices}
              className="rounded-full bg-[var(--cta)] text-white hover:bg-[var(--cta-hover)]"
            >
              {t('continue_to_payment')}
            </Button>
          </div>
        </>
      ) : (
        <div>
          <div className="text-small-regular">
            {cart && (cart.shipping_methods?.length ?? 0) > 0 && (
              <div className="flex flex-col">
                {cart.shipping_methods?.map(method => (
                  <div
                    key={method.id}
                    className="mb-4 rounded-md border p-4"
                  >
                    <Text className="txt-medium-plus text-ui-fg-base mb-1">{t('method_label')}</Text>
                    <Text className="txt-medium text-ui-fg-subtle">
                      {method.name}{' '}
                      {convertToLocale({
                        amount: method.amount ?? 0,
                        currency_code: cart?.currency_code
                      })}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CartShippingMethodsSection;
