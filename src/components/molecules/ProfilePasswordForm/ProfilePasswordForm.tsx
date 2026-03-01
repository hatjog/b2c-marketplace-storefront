'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Heading, toast } from '@medusajs/ui';
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldError,
  type FieldValues,
  type UseFormReturn
} from 'react-hook-form';

import { Button } from '@/components/atoms';
import { LabeledInput } from '@/components/cells';
import { PasswordValidator } from '@/components/cells/PasswordValidator/PasswordValidator';
import { updateCustomerPassword } from '@/lib/data/customer';

import LocalizedClientLink from '../LocalizedLink/LocalizedLink';
import { profilePasswordSchema, type ProfilePasswordFormData } from './schema';

export const ProfilePasswordForm = ({ token }: { token?: string }) => {
  const form = useForm<ProfilePasswordFormData>({
    resolver: zodResolver(profilePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  return (
    <FormProvider {...form}>
      <Form
        form={form}
        token={token}
      />
    </FormProvider>
  );
};

const Form = ({
  form,
  token
}: {
  form: UseFormReturn<ProfilePasswordFormData>;
  token?: string;
}) => {
  const [success, setSuccess] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState<FieldError | undefined>(
    undefined
  );
  const [newPasswordError, setNewPasswordError] = useState({
    isValid: false,
    lower: false,
    upper: false,
    '8chars': false,
    symbolOrDigit: false
  });

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useFormContext();

  const updatePassword = async (data: FieldValues) => {
    if (form.getValues('confirmPassword') !== form.getValues('newPassword')) {
      setConfirmPasswordError({
        message: 'New password and old password cannot be identical',
        type: 'custom'
      } as FieldError);
      return;
    }

    setConfirmPasswordError(undefined);

    if (newPasswordError.isValid) {
      try {
        const res = await updateCustomerPassword(data.newPassword, token!);
        if (res.success) {
          toast.success('Password updated');
          setSuccess(true);
        } else {
          toast.error(res.error || 'Something went wrong');
        }
      } catch (err) {
        console.log(err);
        return;
      }
    }
  };

  return success ? (
    <div className="p-4">
      <Heading
        level="h1"
        className="heading-md text-center uppercase text-primary"
      >
        Password updated
      </Heading>
      <p className="my-8 text-center">
        Your password has been updated. You can now login with your new password.
      </p>
      <LocalizedClientLink href="/user">
        <Button
          className="w-full px-6 py-3 !font-semibold uppercase"
          size="large"
        >
          Go to user page
        </Button>
      </LocalizedClientLink>
    </div>
  ) : (
    <form
      className="flex flex-col gap-4 px-4"
      onSubmit={handleSubmit(updatePassword)}
    >
      <LabeledInput
        label="Current password"
        type="password"
        error={errors.currentPassword as FieldError}
        {...register('currentPassword')}
      />
      <LabeledInput
        label="New password"
        type="password"
        error={errors.newPassword as FieldError}
        {...register('newPassword')}
      />
      <PasswordValidator
        password={form.watch('newPassword')}
        setError={setNewPasswordError}
      />
      <LabeledInput
        label="Confirm new password"
        type="password"
        error={confirmPasswordError as FieldError}
        {...register('confirmPassword')}
      />
      <Button className="my-4 w-full">Change password</Button>
    </form>
  );
};
