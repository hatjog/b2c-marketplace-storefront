'use client';

import { forwardRef, Fragment, useImperativeHandle, useMemo, useRef } from 'react';

import { Listbox, Transition } from '@headlessui/react';
import { ChevronUpDown } from '@medusajs/icons';
import type { HttpTypes } from '@medusajs/types';
import { clx } from '@medusajs/ui';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';

import NativeSelect, {
  type NativeSelectProps
} from '@/components/molecules/NativeSelect/NativeSelect';

const CountrySelect = forwardRef<
  HTMLSelectElement,
  NativeSelectProps & {
    region?: HttpTypes.StoreRegion;
  }
  // `placeholder` intentionally has NO default literal: a default parameter is
  // structurally invisible to the JSX-AST i18n guard, so `placeholder = 'Country'`
  // shipped an untranslated attribute that nothing ever reported.
>(({ placeholder, region, defaultValue, ...props }, ref) => {
  const t = useTranslations('forms');
  const innerRef = useRef<HTMLSelectElement>(null);

  useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
    ref,
    () => innerRef.current
  );

  const countryOptions = useMemo(() => {
    if (!region) {
      return [];
    }

    return region.countries?.map(country => ({
      value: country.iso_2,
      label: country.display_name
    }));
  }, [region]);

  const selectedValue = typeof props.value === 'string' ? props.value : undefined;

  const handleSelect = (value: string) => {
    props.onChange?.({
      target: {
        name: props.name,
        value
      }
    } as React.ChangeEvent<HTMLSelectElement>);
  };

  return (
    <label className="label-md">
      <p className="mb-2">{t('country_label')}</p>
      <Listbox
        onChange={handleSelect}
        value={selectedValue}
      >
        <div className="relative">
          <Listbox.Button
            className={clsx(
              'text-base-regular relative flex h-12 w-full cursor-default items-center justify-between rounded-lg border bg-component-secondary px-4 text-left focus:outline-none focus-visible:border-gray-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-300'
            )}
            data-testid="shipping-address-select"
          >
            {({ open }) => (
              <>
                <span className="block truncate">
                  {countryOptions?.find(country => country.value === selectedValue)?.label ||
                    t('country_placeholder')}
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
              {countryOptions?.map(({ value, label }, index) => (
                <Listbox.Option
                  key={index}
                  value={value}
                  className="relative cursor-default select-none border-b py-4 pl-6 pr-10 hover:bg-gray-50"
                  data-testid="shipping-address-option"
                >
                  {label}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
      <div className="hidden">
        <NativeSelect
          ref={innerRef}
          placeholder={placeholder ?? t('country_label')}
          defaultValue={defaultValue}
          className={clsx('hidden h-12 w-full items-center bg-component-secondary')}
          {...props}
        >
          {countryOptions?.map(({ value, label }, index) => (
            <option
              key={index}
              value={value}
            >
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
    </label>
  );
});

CountrySelect.displayName = 'CountrySelect';

export default CountrySelect;
