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
import { updateCustomer } from '@/lib/data/customer';

import { createProfileDetailsSchema, type ProfileDetailsFormData } from './schema';

interface Props {
  defaultValues?: ProfileDetailsFormData;
  handleClose?: () => void;
}

export const ProfileDetailsForm: FC<Props> = ({ defaultValues, ...props }) => {
  const tValidation = useTranslations('validation');
  const schema = useMemo(() => createProfileDetailsSchema(tValidation), [tValidation]);
  const methods = useForm<ProfileDetailsFormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues || {
      firstName: '',
      lastName: '',
      phone: '',
      email: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form {...props} />
    </FormProvider>
  );
};

const Form: React.FC<Props> = ({ handleClose }) => {
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [error, setError] = useState<string>();
  const {
    handleSubmit,
    register,
    formState: { errors }
  } = useFormContext();

  const submit = async (data: FieldValues) => {
    const body = {
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone
    };
    try {
      await updateCustomer(body as HttpTypes.StoreUpdateCustomer);
    } catch (err) {
      setError((err as Error).message);
      return;
    }

    setError('');
    handleClose && handleClose();
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      data-testid="profile-details-form"
    >
      <div className="space-y-4 px-4">
        <div className="items-top mb-4 grid max-w-full grid-cols-2 gap-4">
          <LabeledInput
            label={tAuth('first_name_label')}
            placeholder={tAuth('profile_first_name_placeholder')}
            error={errors.firstName as FieldError}
            data-testid="profile-details-form-first-name-input"
            {...register('firstName')}
          />
          <LabeledInput
            label={tAuth('last_name_label')}
            placeholder={tAuth('profile_last_name_placeholder')}
            error={errors.lastName as FieldError}
            data-testid="profile-details-form-last-name-input"
            {...register('lastName')}
          />
          <LabeledInput
            label={tAuth('phone_label')}
            placeholder={tAuth('profile_phone_placeholder')}
            error={errors.phone as FieldError}
            data-testid="profile-details-form-phone-input"
            {...register('phone')}
          />
          <LabeledInput
            label={tAuth('email_label')}
            disabled
            data-testid="profile-details-form-email-input"
            {...register('email')}
          />
        </div>
        {error && (
          <p
            className="label-md text-negative"
            data-testid="profile-details-form-error"
          >
            {error}
          </p>
        )}
        <Button
          className="w-full"
          data-testid="profile-details-form-submit-button"
        >
          {tCommon('save')}
        </Button>
      </div>
    </form>
  );
};
