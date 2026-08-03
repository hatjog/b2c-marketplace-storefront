'use client';

import { Fragment, useMemo } from 'react';

import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDown } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import { clx } from '@medusajs/ui';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';

import compareAddresses from '@/lib/helpers/compare-addresses';

type AddressSelectProps = {
  addresses: HttpTypes.StoreCustomerAddress[];
  addressInput: HttpTypes.StoreCartAddress | null;
  onSelect: (address: HttpTypes.StoreCartAddress | undefined, email?: string) => void;
};

const AddressSelect = ({ addresses, addressInput, onSelect }: AddressSelectProps) => {
  const t = useTranslations('forms');

  const handleSelect = (id: string) => {
    const savedAddress = addresses.find(a => a.id === id);
    if (savedAddress) {
      onSelect(savedAddress as HttpTypes.StoreCartAddress);
    }
  };

  const selectedAddress = useMemo(() => {
    return addresses.find(a => compareAddresses(a, addressInput));
  }, [addresses, addressInput]);

  return (
    <Listbox
      onChange={handleSelect}
      value={selectedAddress?.id}
    >
      <div className="relative">
        <Listbox.Button
          className={clsx(
            'text-base-regular relative flex w-full cursor-default items-center justify-between rounded-lg border bg-component-secondary px-4 py-[10px] text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300'
          )}
          data-testid="shipping-address-select"
        >
          {({ open }) => (
            <>
              <span className="block truncate">
                {selectedAddress ? selectedAddress.address_name : t('address_select_placeholder')}
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
            {addresses.map(address => {
              return (
                <Listbox.Option
                  key={address.id}
                  value={address.id}
                  className="relative cursor-default select-none border-b py-4 pl-6 pr-10 hover:bg-gray-50"
                  data-testid="shipping-address-option"
                >
                  <span className="font-semibold">{address.address_name}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-base-semi block text-left">
                        {address.first_name} {address.last_name}
                      </span>
                      {address.company && (
                        <span className="text-small-regular text-ui-fg-base">
                          {address.company}
                        </span>
                      )}
                    </div>
                    <div className="text-base-regular flex flex-col text-left">
                      <span>
                        {address.address_1}
                        {address.address_2 && <span>, {address.address_2}</span>}
                      </span>
                      <span>
                        {address.postal_code}, {address.city}
                      </span>
                      <span>
                        {address.province && `${address.province}, `}
                        {address.country_code?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </Listbox.Option>
              );
            })}
          </Listbox.Options>
        </Transition>
      </div>
    </Listbox>
  );
};

export default AddressSelect;
