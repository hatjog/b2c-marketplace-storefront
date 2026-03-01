'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition
} from '@headlessui/react';
import type { HttpTypes } from '@medusajs/types';
import { Label } from '@medusajs/ui';
import { useParams, usePathname, useRouter } from 'next/navigation';
import ReactCountryFlag from 'react-country-flag';

import { updateRegionWithValidation } from '@/lib/data/cart';
import { toast } from '@/lib/helpers/toast';

type CountryOption = {
  country: string;
  region: string;
  label: string;
};

type CountrySelectProps = {
  regions: HttpTypes.StoreRegion[];
};

const CountrySelect = ({ regions }: CountrySelectProps) => {
  const [current, setCurrent] = useState<
    { country: string | undefined; region: string; label: string | undefined } | undefined
  >(undefined);

  const { locale: countryCode } = useParams();
  const router = useRouter();
  const currentPath = usePathname().split(`/${countryCode}`)[1];

  const options = useMemo(() => {
    return regions
      ?.map(r => {
        return r.countries?.map(c => ({
          country: c.iso_2,
          region: r.id,
          label: c.display_name
        }));
      })
      .flat()
      .sort((a, b) => (a?.label ?? '').localeCompare(b?.label ?? ''));
  }, [regions]);

  useEffect(() => {
    if (countryCode) {
      const option = options?.find(o => o?.country === countryCode);
      setCurrent(option);
    }
  }, [options, countryCode]);

  const handleChange = async (option: CountryOption) => {
    try {
      const result = await updateRegionWithValidation(option.country, currentPath);

      if (result.removedItems.length > 0) {
        const itemsList = result.removedItems.join(', ');
        toast.info({
          title: 'Cart updated',
          description: `${itemsList} ${result.removedItems.length === 1 ? 'is' : 'are'} not available in ${option.label} and ${result.removedItems.length === 1 ? 'was' : 'were'} removed from your cart.`
        });
      }

      // Navigate to new region
      router.push(result.newPath);
      router.refresh();
    } catch (error: any) {
      toast.error({
        title: 'Error switching region',
        description: error?.message || 'Failed to update region. Please try again.'
      });
    }
  };

  return (
    <div className="relative items-center justify-end gap-2 md:flex">
      <Label className="label-md hidden md:block">Shipping to</Label>
      <div>
        <Listbox
          onChange={handleChange}
          defaultValue={countryCode ? options?.find(o => o?.country === countryCode) : undefined}
        >
          <ListboxButton className="text-base-regular relative flex h-10 w-16 cursor-default items-center justify-between rounded-lg border bg-component-secondary text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300">
            <div className="txt-compact-small mx-auto flex items-start">
              {current && (
                <span className="txt-compact-small flex items-center gap-x-2">
                  {/* @ts-ignore */}
                  <ReactCountryFlag
                    alt={`${current.country?.toUpperCase()} flag`}
                    svg
                    style={{
                      width: '16px',
                      height: '16px'
                    }}
                    countryCode={current.country ?? ''}
                  />
                  {current.country?.toUpperCase()}
                </span>
              )}
            </div>
          </ListboxButton>
          <div className="relative flex w-16">
            <Transition
              as={Fragment}
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <ListboxOptions className="no-scrollbar text-small-regular border-top-0 absolute z-20 max-h-60 overflow-auto rounded-lg border bg-white focus:outline-none sm:text-sm">
                {options?.map((o, index) => {
                  return (
                    <ListboxOption
                      key={index}
                      value={o}
                      className="relative w-16 cursor-pointer select-none border-b py-2 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-x-2 pl-2">
                        {/* @ts-ignore */}
                        <ReactCountryFlag
                          svg
                          style={{
                            width: '16px',
                            height: '16px'
                          }}
                          countryCode={o?.country ?? ''}
                        />{' '}
                        {o?.country?.toUpperCase()}
                      </span>
                    </ListboxOption>
                  );
                })}
              </ListboxOptions>
            </Transition>
          </div>
        </Listbox>
      </div>
    </div>
  );
};

export default CountrySelect;
