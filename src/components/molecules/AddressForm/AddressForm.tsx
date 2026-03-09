'use client';

import { useMemo, useState, type FC } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import type { HttpTypes } from '@medusajs/types';
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldError,
  type FieldValues
} from 'react-hook-form';

import { Button } from '@/components/atoms';
import { LabeledInput } from '@/components/cells';
import CountrySelect from '@/components/cells/CountrySelect/CountrySelect';
import { addCustomerAddress, updateCustomerAddress } from '@/lib/data/customer';

import { createAddressSchema, type AddressFormData } from './schema';

interface Props {
  defaultValues?: AddressFormData;

  regions: HttpTypes.StoreRegion[];
  handleClose?: () => void;
}

export const emptyDefaultAddressValues = {
  addressName: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  countryCode: '',
  postalCode: '',
  company: '',
  province: '',
  phone: '',
  metadata: {}
};

export const AddressForm: FC<Props> = ({ defaultValues, ...props }) => {
  const tValidation = useTranslations('validation');
  const schema = useMemo(() => createAddressSchema(tValidation), [tValidation]);
  const methods = useForm<AddressFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || emptyDefaultAddressValues
  });

  return (
    <FormProvider {...methods}>
      <Form {...props} />
    </FormProvider>
  );
};

const Form: FC<Props> = ({ regions, handleClose }) => {
  const t = useTranslations('forms');
  const [error, setError] = useState<string>();
  const {
    handleSubmit,
    register,
    formState: { errors },
    watch
  } = useFormContext();

  const region = {
    countries: regions.flatMap(region => region.countries)
  };

  const submit = async (data: FieldValues) => {
    const formData = new FormData();
    formData.append('addressId', data.addressId || '');
    formData.append('address_name', data.addressName);
    formData.append('first_name', data.firstName);
    formData.append('last_name', data.lastName);
    formData.append('address_1', data.address);
    formData.append('address_2', '');
    formData.append('province', data.province);
    formData.append('city', data.city);
    formData.append('country_code', data.countryCode);
    formData.append('postal_code', data.postalCode);
    formData.append('company', data.company);
    formData.append('phone', data.phone);

    const res = data.addressId
      ? await updateCustomerAddress(formData)
      : await addCustomerAddress(formData);

    if (!res.success) {
      setError(res.error);
      return;
    }

    setError('');
    handleClose && handleClose();
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      data-testid="address-form"
    >
      <div className="space-y-4 px-4">
        <div className="items-top mb-4 grid max-w-full grid-cols-2 gap-4">
          <LabeledInput
            label={t('address_name_label')}
            placeholder={t('address_name_placeholder')}
            className="col-span-2"
            error={errors.firstName as FieldError}
            data-testid="address-form-address-name-input"
            {...register('addressName')}
          />
          <LabeledInput
            label={t('first_name_label')}
            placeholder={t('first_name_placeholder')}
            error={errors.firstName as FieldError}
            data-testid="address-form-first-name-input"
            {...register('firstName')}
          />
          <LabeledInput
            label={t('last_name_label')}
            placeholder={t('last_name_placeholder')}
            error={errors.firstName as FieldError}
            data-testid="address-form-last-name-input"
            {...register('lastName')}
          />
          <LabeledInput
            label={t('company_label')}
            placeholder={t('company_placeholder')}
            error={errors.company as FieldError}
            data-testid="address-form-company-input"
            {...register('company')}
          />
          <LabeledInput
            label={t('address_label')}
            placeholder={t('address_placeholder')}
            error={errors.address as FieldError}
            data-testid="address-form-address-input"
            {...register('address')}
          />
          <LabeledInput
            label={t('city_label')}
            placeholder={t('city_placeholder')}
            error={errors.city as FieldError}
            data-testid="address-form-city-input"
            {...register('city')}
          />
          <LabeledInput
            label={t('postal_code_label')}
            placeholder={t('postal_code_placeholder')}
            error={errors.postalCode as FieldError}
            data-testid="address-form-postal-code-input"
            {...register('postalCode')}
          />
          <LabeledInput
            label={t('state_province_label')}
            placeholder={t('state_province_placeholder')}
            error={errors.province as FieldError}
            data-testid="address-form-province-input"
            {...register('province')}
          />
          <div>
            <CountrySelect
              region={region as HttpTypes.StoreRegion}
              {...register('countryCode')}
              value={watch('countryCode')}
              className="h-12"
              data-testid="address-form-country-select"
            />
            {errors.countryCode && (
              <p
                className="label-sm text-negative"
                data-testid="address-form-country-error"
              >
                {(errors.countryCode as FieldError).message}
              </p>
            )}
          </div>

          <LabeledInput
            label={t('phone_label')}
            placeholder={t('phone_placeholder')}
            error={errors.phone as FieldError}
            data-testid="address-form-phone-input"
            {...register('phone')}
          />
        </div>
        {error && (
          <p
            className="label-md text-negative"
            data-testid="address-form-error"
          >
            {error}
          </p>
        )}
        <Button
          className="w-full"
          data-testid="address-form-submit-button"
        >
          {t('save_address_button')}
        </Button>
      </div>
    </form>
  );
};
