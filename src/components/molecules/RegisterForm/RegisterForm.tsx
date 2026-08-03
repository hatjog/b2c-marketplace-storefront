'use client';

import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Container } from '@medusajs/ui';
import Link from 'next/link';
import { FormProvider, useForm, useFormContext, type FieldError } from 'react-hook-form';

import { Button } from '@/components/atoms';
import { LabeledInput } from '@/components/cells';
import { PasswordValidator } from '@/components/cells/PasswordValidator/PasswordValidator';
import { signup } from '@/lib/data/customer';
import { toast } from '@/lib/helpers/toast';

import { createRegisterFormSchema, type RegisterFormData } from './schema';

export const RegisterForm = () => {
  const tValidation = useTranslations('validation');
  const schema = useMemo(() => createRegisterFormSchema(tValidation), [tValidation]);
  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      password: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  );
};

const Form = () => {
  const t = useTranslations('auth');
  const [passwordError, setPasswordError] = useState({
    isValid: false,
    lower: false,
    upper: false,
    '8chars': false,
    symbolOrDigit: false
  });

  const {
    handleSubmit,
    register,
    watch,
    formState: { errors, isSubmitting }
  } = useFormContext<RegisterFormData>();

  const submit = async (data: RegisterFormData) => {
    if (!passwordError.isValid) {
      return;
    }

    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('first_name', data.firstName);
    formData.append('last_name', data.lastName);
    formData.append('phone', data.phone);

    const res = await signup(formData);

    if (res && !res?.id) {
      // Temporary solution. Check also for status code when it's fixed by backend
      const errorMessage = res.toLowerCase().includes('error: identity with email already exists')
        ? t('error_email_exists')
        : res;
      toast.error({ title: errorMessage });
    }
  };

  return (
    <main
      className="container"
      data-testid="register-page"
    >
      <Container
        className="mx-auto mt-8 max-w-xl border p-4"
        data-testid="register-form-container"
      >
        <h1 className="heading-md mb-8 uppercase text-primary">{t('create_account_heading')}</h1>
        <form
          onSubmit={handleSubmit(submit)}
          data-testid="register-form"
        >
          <div className="mb-4 flex flex-col gap-4 md:flex-row">
            <LabeledInput
              className="md:w-1/2"
              label={t('first_name_label')}
              placeholder={t('first_name_placeholder')}
              error={errors.firstName as FieldError}
              data-testid="register-first-name-input"
              {...register('firstName')}
            />
            <LabeledInput
              className="md:w-1/2"
              label={t('last_name_label')}
              placeholder={t('last_name_placeholder')}
              error={errors.lastName as FieldError}
              data-testid="register-last-name-input"
              {...register('lastName')}
            />
          </div>
          <div className="mb-4 flex flex-col gap-4 md:flex-row">
            <LabeledInput
              className="md:w-1/2"
              label={t('email_label')}
              placeholder={t('email_placeholder')}
              error={errors.email as FieldError}
              data-testid="register-email-input"
              {...register('email')}
            />
            <LabeledInput
              className="md:w-1/2"
              label={t('phone_label')}
              placeholder={t('phone_placeholder')}
              error={errors.phone as FieldError}
              data-testid="register-phone-input"
              {...register('phone')}
            />
          </div>
          <div>
            <LabeledInput
              className="mb-4"
              label={t('password_label')}
              placeholder={t('password_placeholder')}
              type="password"
              error={errors.password as FieldError}
              data-testid="register-password-input"
              {...register('password')}
            />
            <PasswordValidator
              password={watch('password')}
              setError={setPasswordError}
            />
          </div>

          <Button
            className="mt-8 flex w-full justify-center uppercase"
            disabled={isSubmitting}
            loading={isSubmitting}
            data-testid="register-submit-button"
          >
            {t('create_account')}
          </Button>
        </form>
      </Container>
      <Container className="mx-auto mt-8 max-w-xl border p-4">
        <h2 className="heading-md mb-8 uppercase text-primary">{t('already_have_account')}</h2>
        <Link
          href="/login"
          data-testid="register-login-link"
        >
          <Button
            variant="tonal"
            className="mt-8 flex w-full justify-center uppercase"
          >
            {t('login_link')}
          </Button>
        </Link>
      </Container>
    </main>
  );
};
