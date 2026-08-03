'use client';

import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldError,
  type FieldValues
} from 'react-hook-form';

import { Button } from '@/components/atoms';
import { Alert } from '@/components/atoms/Alert/Alert';
import { LabeledInput } from '@/components/cells';
import { login } from '@/lib/data/customer';
import { toast } from '@/lib/helpers/toast';

import { createLoginFormSchema, type LoginFormData } from './schema';

export const LoginForm = () => {
  const tValidation = useTranslations('validation');
  const schema = useMemo(() => createLoginFormSchema(tValidation), [tValidation]);
  const methods = useForm<LoginFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
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
  const [isAuthError, setIsAuthError] = useState(false);
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting }
  } = useFormContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSessionExpired = searchParams.get('sessionExpired') === 'true';
  const isSessionRequired = searchParams.get('sessionRequired') === 'true';

  const submit = async (data: FieldValues) => {
    const formData = new FormData();
    formData.append('email', data.email);
    formData.append('password', data.password);

    const res = await login(formData);
    if (res) {
      // Temporary solution. API returns 200 code in case of auth error. To change when API is updated.
      const isCredentialsError =
        res.toLowerCase().includes('invalid email or password') ||
        res.toLowerCase().includes('unauthorized') ||
        res.toLowerCase().includes('incorrect') ||
        res.toLowerCase().includes('credentials');

      setIsAuthError(isCredentialsError);

      const errorMessage = isCredentialsError ? t('error_incorrect_credentials') : res;

      toast.error({ title: errorMessage || t('error_generic') });
      return;
    }
    setIsAuthError(false);
    router.push('/user');
  };

  const clearApiError = () => {
    isAuthError && setIsAuthError(false);
  };

  const getAuthMessage = () => {
    if (isSessionExpired) {
      return t('session_expired');
    }
    if (isSessionRequired) {
      return t('session_required');
    }
    return null;
  };

  const authMessage = getAuthMessage();

  return (
    <main
      className="container"
      data-testid="login-page"
    >
      <div className="mx-auto mt-6 w-full max-w-xl space-y-4">
        {authMessage && (
          <Alert
            title={authMessage}
            className="w-full"
            icon
            data-testid="login-auth-alert"
          />
        )}
        <div
          className="rounded-sm border p-4"
          data-testid="login-form-container"
        >
          <h1 className="heading-md mb-8 uppercase text-primary">{t('login_heading')}</h1>
          <form
            onSubmit={handleSubmit(submit)}
            data-testid="login-form"
          >
            <div className="space-y-4">
              <LabeledInput
                label={t('email_label')}
                placeholder={t('email_placeholder')}
                error={
                  (errors.email as FieldError) ||
                  (isAuthError ? ({ message: '' } as FieldError) : undefined)
                }
                data-testid="login-email-input"
                {...register('email', {
                  onChange: clearApiError
                })}
              />
              <LabeledInput
                label={t('password_label')}
                placeholder={t('password_placeholder')}
                type="password"
                error={
                  (errors.password as FieldError) ||
                  (isAuthError ? ({ message: '' } as FieldError) : undefined)
                }
                data-testid="login-password-input"
                {...register('password', {
                  onChange: clearApiError
                })}
              />
            </div>

            <Link
              href="/forgot-password"
              className="label-md mt-4 block text-right uppercase text-action-on-secondary"
              data-testid="login-forgot-password-link"
            >
              {t('forgot_password')}
            </Link>

            <Button
              className="mt-8 w-full uppercase"
              disabled={isSubmitting}
              data-testid="login-submit-button"
            >
              {t('login_button')}
            </Button>
          </form>
        </div>

        <div className="rounded-sm border p-4">
          <h2 className="heading-md mb-4 uppercase text-primary">
            {t('no_account')}
          </h2>
          <Link
            href="/register"
            data-testid="login-register-link"
          >
            <Button
              variant="tonal"
              className="mt-8 flex w-full justify-center uppercase"
            >
              {t('create_account')}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
};
