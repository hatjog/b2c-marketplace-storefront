'use client';

import Link from 'next/link';
import {
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  Controller,
  useForm,
  type FieldErrors,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import {
  accountActionInitialState,
  createWrittenReview,
  deleteAddressAction,
  deleteWrittenReview,
  submitAddress,
  submitPrivacyRequest,
  submitReturnRequest,
  updateNotificationSettings,
  updatePaymentSettings,
  updateProfileSettings,
  updateSecuritySettings,
  updateWrittenReview,
  type AccountActionState,
} from '@/actions/account-write-surfaces';
import { Button, Checkbox, Input, Textarea } from '@/components/atoms';
import { Alert } from '@/components/atoms/Alert/Alert';
import { Radio } from '@/components/atoms/Radio/Radio';
import { StepProgressBar } from '@/components/cells/StepProgressBar/StepProgressBar';
import { CrossActorHandoff } from '@/components/molecules/CrossActorHandoff/CrossActorHandoff';
import { ModalShell } from '@/components/organisms/ModalShell/ModalShell';
import {
  addressSchema,
  paymentSettingsSchema,
  profileSettingsSchema,
  reviewCreateSchema,
  reviewMutationSchema,
  returnRequestSchema,
  securitySettingsSchema,
  type AddressFormValues,
  type PaymentSettingsFormValues,
  type ProfileSettingsFormValues,
  type ReviewCreateFormValues,
  type ReviewMutationFormValues,
  type ReturnRequestFormValues,
  type SecuritySettingsFormValues,
} from '@/lib/account/account-write-schemas';
import { cn } from '@/lib/utils';

type TranslationFn = ReturnType<typeof useTranslations>;

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

interface AddressRecord {
  id: string;
  address_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address_1?: string | null;
  city?: string | null;
  postal_code?: string | null;
  province?: string | null;
  country_code?: string | null;
  phone?: string | null;
}

interface CountryRecord {
  iso_2: string;
  display_name: string;
}

interface ReviewRecord {
  id: string;
  rating: number;
  customer_note?: string | null;
  updated_at?: string | null;
  seller?: { name?: string | null } | null;
  order_id?: string | null;
}

interface ReviewableOrder {
  id: string;
  displayId: string;
  sellerId: string;
  sellerName: string;
  createdAt?: string | Date | null;
  existingReview?: ReviewRecord | null;
}

interface ReturnReasonRecord {
  value: string;
  label: string;
}

interface ReturnSurfaceProps {
  orderId: string;
  reasons: ReturnReasonRecord[];
}

interface SavedAddressesProps {
  addresses: AddressRecord[];
  countries: CountryRecord[];
  customerEmail: string;
  customerPhone?: string | null;
}

interface ReviewsToWriteProps {
  orders: ReviewableOrder[];
}

interface WrittenReviewsProps {
  reviews: ReviewRecord[];
}

type NotificationSettingsFormValues = {
  emailUpdates: boolean;
  smsUpdates: boolean;
  productNews: boolean;
};

type PrivacySettingsFormValues = {
  requestType: 'export' | 'delete';
};

interface SettingsProps {
  customer: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    locale: string;
  };
}

function SectionCard({ title, description, children, className }: SectionCardProps) {
  return (
    <section className={cn('rounded-3xl border border-[var(--bb-border-soft)] bg-white/90 p-5 shadow-sm', className)}>
      <div className="mb-4 space-y-1">
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
        {description ? <p className="text-sm text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SurfaceHero({
  eyebrow,
  title,
  description,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cta?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] bg-[linear-gradient(135deg,rgba(168,146,121,0.18),rgba(243,241,237,0.96))] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-secondary">{eyebrow}</p>
      <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-primary md:text-3xl">{title}</h2>
          <p className="max-w-2xl text-sm leading-6 text-secondary">{description}</p>
        </div>
        {cta}
      </div>
    </section>
  );
}

function StateLifecycleBadge({ tone, label }: { tone: 'pending' | 'progress' | 'success'; label: string }) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : tone === 'progress'
        ? 'bg-sky-50 text-sky-800 border-sky-200'
        : 'bg-amber-50 text-amber-900 border-amber-200';

  return (
    <span
      className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]', toneClass)}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

function TimelineItem({
  title,
  body,
  tone,
  last = false,
}: {
  title: string;
  body: string;
  tone: 'pending' | 'progress' | 'success';
  last?: boolean;
}) {
  const dotTone =
    tone === 'success' ? 'bg-emerald-500' : tone === 'progress' ? 'bg-sky-500' : 'bg-amber-500';

  return (
    <li className="relative flex gap-4 pl-2">
      <div className="flex flex-col items-center">
        <span className={cn('mt-1 h-3.5 w-3.5 rounded-full', dotTone)} aria-hidden="true" />
        {!last ? <span className="mt-2 h-full w-px bg-[var(--bb-border-soft)]" aria-hidden="true" /> : null}
      </div>
      <div className="pb-6">
        <p className="font-medium text-primary">{title}</p>
        <p className="mt-1 text-sm text-secondary">{body}</p>
      </div>
    </li>
  );
}

function mapServerErrorsToForm<TFieldValues extends FieldValues>(
  state: AccountActionState,
  setError: (
    name: FieldPath<TFieldValues>,
    error: { type: string; message: string }
  ) => void,
  setFocus: (name: FieldPath<TFieldValues>) => void
) {
  const entries = Object.entries(state.fieldErrors ?? {});

  entries.forEach(([field, message], index) => {
    setError(field as FieldPath<TFieldValues>, {
      type: 'server',
      message,
    });
    if (index === 0) {
      setFocus(field as FieldPath<TFieldValues>);
    }
  });
}

function FieldErrorMessage({
  messageKey,
  t,
}: {
  messageKey?: string;
  t: TranslationFn;
}) {
  if (!messageKey) return null;

  return <p className="mt-1 text-sm text-negative">{t(messageKey as never)}</p>;
}

function BlurSuccess({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  if (!active) return null;

  return <p className="mt-1 text-xs font-medium text-emerald-700">{label}</p>;
}

function useBlurSuccessState<TFieldValues extends FieldValues>() {
  const [blurred, setBlurred] = useState<Record<string, boolean>>({});

  function registerBlur(name: FieldPath<TFieldValues>) {
    return () => {
      setBlurred((current) => ({ ...current, [name]: true }));
    };
  }

  return {
    blurred,
    registerBlur,
  };
}

function renderAddressLine(address: AddressRecord, countries: CountryRecord[]) {
  const countryLabel =
    countries.find((country) => country.iso_2 === address.country_code)?.display_name ??
    address.country_code?.toUpperCase() ??
    '';

  return [
    address.address_1,
    [address.postal_code, address.city].filter(Boolean).join(' '),
    address.province,
    countryLabel,
  ]
    .filter(Boolean)
    .join(', ');
}

function WrittenReviewForm({
  review,
  open,
  onClose,
}: {
  review: ReviewRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('account_write');
  const [state, action, pending] = useActionState(updateWrittenReview, accountActionInitialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { blurred, registerBlur } = useBlurSuccessState<ReviewMutationFormValues>();

  const form = useForm<ReviewMutationFormValues>({
    resolver: zodResolver(reviewMutationSchema),
    defaultValues: {
      reviewId: review?.id ?? '',
      orderId: review?.order_id ?? '',
      rating: review?.rating ?? 5,
      note: review?.customer_note ?? '',
    },
  });

  useEffect(() => {
    form.reset({
      reviewId: review?.id ?? '',
      orderId: review?.order_id ?? '',
      rating: review?.rating ?? 5,
      note: review?.customer_note ?? '',
    });
  }, [form, review]);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      mapServerErrorsToForm<ReviewMutationFormValues>(state, form.setError, form.setFocus);
    }
  }, [form, state]);

  useEffect(() => {
    if (state.status === 'success') {
      onClose();
    }
  }, [onClose, state.status]);

  if (!review) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('written_reviews.form.title')}
      body={
        <form
          ref={formRef}
          className="space-y-4"
          onSubmit={form.handleSubmit(() => {
            if (!formRef.current) return;
            action(new FormData(formRef.current));
          })}
        >
          <input type="hidden" {...form.register('reviewId')} />
          <input type="hidden" {...form.register('orderId')} />
          <input type="hidden" {...form.register('rating')} />
          <div className="space-y-2">
            <label className="text-sm font-medium text-primary">{t('written_reviews.form.rating_label')}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => {
                    form.setValue('rating', rating, { shouldDirty: true, shouldValidate: true });
                  }}
                  className={cn(
                    'min-h-[44px] min-w-[44px] rounded-full border text-sm font-semibold',
                    form.watch('rating') >= rating
                      ? 'border-[var(--accent,#A89279)] bg-[var(--bb-tint-accent-18)] text-primary'
                      : 'border-[var(--bb-border-soft)] text-secondary'
                  )}
                >
                  {rating}
                </button>
              ))}
            </div>
            <FieldErrorMessage messageKey={form.formState.errors.rating?.message} t={t} />
            <BlurSuccess
              active={blurred.rating && !form.formState.errors.rating}
              label={t('common.inline_success')}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-primary" htmlFor="written-review-note">
              {t('written_reviews.form.note_label')}
            </label>
            <Textarea
              id="written-review-note"
              rows={5}
              {...form.register('note', {
                onBlur: registerBlur('note'),
              })}
            />
            <FieldErrorMessage messageKey={form.formState.errors.note?.message} t={t} />
            <BlurSuccess
              active={blurred.note && !form.formState.errors.note}
              label={t('common.inline_success')}
            />
          </div>

          {state.messageKey && state.status === 'error' ? <Alert variant="negative">{t(state.messageKey as never)}</Alert> : null}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      }
      actions={[
        {
          id: 'cancel',
          label: t('common.cancel'),
          onClick: onClose,
          variant: 'tonal',
        },
        {
          id: 'save',
          label: pending ? t('common.saving') : t('common.save'),
          onClick: () => formRef.current?.requestSubmit(),
        },
      ]}
    />
  );
}

function DeleteReviewDialog({
  review,
  open,
  onClose,
}: {
  review: ReviewRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('account_write');
  const [state, action, pending] = useActionState(deleteWrittenReview, accountActionInitialState);

  useEffect(() => {
    if (state.status === 'success') {
      onClose();
    }
  }, [onClose, state.status]);

  if (!review) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      variant="confirm-destructive"
      title={t('written_reviews.delete.title')}
      body={
        <div className="space-y-4">
          <p>{t('written_reviews.delete.description')}</p>
          {state.messageKey && state.status === 'error' ? <Alert variant="negative">{t(state.messageKey as never)}</Alert> : null}
        </div>
      }
      actions={[
        {
          id: 'cancel',
          label: t('common.cancel'),
          onClick: onClose,
          variant: 'tonal',
        },
        {
          id: 'confirm',
          label: pending ? t('common.deleting') : t('common.delete'),
          onClick: () => {
            const formData = new FormData();
            formData.set('reviewId', review.id);
            action(formData);
          },
          destructive: true,
        },
      ]}
    />
  );
}

function CreateReviewForm({
  order,
  open,
  onClose,
}: {
  order: ReviewableOrder | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('account_write');
  const [state, action, pending] = useActionState(createWrittenReview, accountActionInitialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { blurred, registerBlur } = useBlurSuccessState<ReviewCreateFormValues>();

  const form = useForm<ReviewCreateFormValues>({
    resolver: zodResolver(reviewCreateSchema),
    defaultValues: {
      orderId: order?.id ?? '',
      sellerId: order?.sellerId ?? '',
      rating: 5,
      note: '',
    },
  });

  useEffect(() => {
    form.reset({
      orderId: order?.id ?? '',
      sellerId: order?.sellerId ?? '',
      rating: 5,
      note: '',
    });
  }, [form, order]);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      mapServerErrorsToForm<ReviewCreateFormValues>(state, form.setError, form.setFocus);
    }
  }, [form, state]);

  useEffect(() => {
    if (state.status === 'success') {
      onClose();
    }
  }, [onClose, state.status]);

  if (!order) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={t('written_reviews.form.create_title')}
      body={
        <form
          ref={formRef}
          className="space-y-4"
          onSubmit={form.handleSubmit(() => {
            if (!formRef.current) return;
            action(new FormData(formRef.current));
          })}
        >
          <input type="hidden" {...form.register('orderId')} />
          <input type="hidden" {...form.register('sellerId')} />
          <input type="hidden" {...form.register('rating')} />
          <div className="space-y-2">
            <p className="text-sm text-secondary">
              {t('reviews_to_write.list.order_label', { id: order.displayId })}
            </p>
            <label className="text-sm font-medium text-primary">{t('written_reviews.form.rating_label')}</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => {
                    form.setValue('rating', rating, { shouldDirty: true, shouldValidate: true });
                  }}
                  className={cn(
                    'min-h-[44px] min-w-[44px] rounded-full border text-sm font-semibold',
                    form.watch('rating') >= rating
                      ? 'border-[var(--accent,#A89279)] bg-[var(--bb-tint-accent-18)] text-primary'
                      : 'border-[var(--bb-border-soft)] text-secondary'
                  )}
                >
                  {rating}
                </button>
              ))}
            </div>
            <FieldErrorMessage messageKey={form.formState.errors.rating?.message} t={t} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-primary" htmlFor="new-review-note">
              {t('written_reviews.form.note_label')}
            </label>
            <Textarea
              id="new-review-note"
              rows={5}
              {...form.register('note', {
                onBlur: registerBlur('note'),
              })}
            />
            <FieldErrorMessage messageKey={form.formState.errors.note?.message} t={t} />
            <BlurSuccess
              active={blurred.note && !form.formState.errors.note}
              label={t('common.inline_success')}
            />
          </div>

          {state.messageKey && state.status === 'error' ? <Alert variant="negative">{t(state.messageKey as never)}</Alert> : null}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      }
      actions={[
        {
          id: 'cancel',
          label: t('common.cancel'),
          onClick: onClose,
          variant: 'tonal',
        },
        {
          id: 'save',
          label: pending ? t('common.saving') : t('common.save'),
          onClick: () => formRef.current?.requestSubmit(),
        },
      ]}
    />
  );
}

export function ReturnRequestSurface({ orderId, reasons }: ReturnSurfaceProps) {
  const t = useTranslations('account_write');
  const [state, action, pending] = useActionState(submitReturnRequest, accountActionInitialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { blurred, registerBlur } = useBlurSuccessState<ReturnRequestFormValues>();

  const form = useForm<ReturnRequestFormValues>({
    resolver: zodResolver(returnRequestSchema),
    defaultValues: {
      orderId,
      reasonId: '',
      comment: '',
    },
  });

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      mapServerErrorsToForm<ReturnRequestFormValues>(state, form.setError, form.setFocus);
    }
  }, [form, state]);

  return (
    <div className="space-y-6" data-testid="return-request-form-page">
      <SurfaceHero
        eyebrow={t('return_request.hero.eyebrow')}
        title={t('return_request.hero.title')}
        description={t('return_request.hero.description')}
      />

      <SectionCard
        title={t('return_request.progress.title')}
        description={t('return_request.progress.description')}
      >
        <StepProgressBar
          steps={[
            t('return_request.progress.step_reason'),
            t('return_request.progress.step_evidence'),
            t('return_request.progress.step_submit'),
          ]}
          currentStep={state.status === 'success' ? 2 : 1}
        />
      </SectionCard>

      <SectionCard title={t('return_request.form.title')} description={t('return_request.form.description')}>
        <form
          ref={formRef}
          className="space-y-6"
          onSubmit={form.handleSubmit(() => {
            if (!formRef.current) return;
            action(new FormData(formRef.current));
          })}
        >
          <input type="hidden" value={orderId} {...form.register('orderId')} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">{t('return_request.form.reason_label')}</p>
            <Controller
              control={form.control}
              name="reasonId"
              render={({ field }) => (
                <div className="grid gap-3 md:grid-cols-2">
                  {reasons.map((reason) => (
                    <label
                      key={reason.value}
                      className={cn(
                        'flex min-h-[44px] items-start gap-3 rounded-2xl border p-4',
                        field.value === reason.value
                          ? 'border-[var(--accent,#A89279)] bg-[var(--bb-tint-accent-12)]'
                          : 'border-[var(--bb-border-soft)]'
                      )}
                    >
                      <span className="mt-0.5">
                        <input
                          ref={field.ref}
                          type="radio"
                          name={field.name}
                          value={reason.value}
                          checked={field.value === reason.value}
                          onBlur={field.onBlur}
                          onChange={() => {
                            field.onChange(reason.value);
                          }}
                          className="sr-only"
                        />
                        <Radio checked={field.value === reason.value} />
                      </span>
                      <span className="text-sm text-primary">{reason.label}</span>
                    </label>
                  ))}
                </div>
              )}
            />
            <FieldErrorMessage messageKey={form.formState.errors.reasonId?.message} t={t} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-primary" htmlFor="return-photos">
              {t('return_request.form.photos_label')}
            </label>
            <Input
              id="return-photos"
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="min-h-[44px]"
              {...form.register('photos' as never)}
            />
            <p className="text-xs text-secondary">{t('return_request.form.photos_help')}</p>
            <FieldErrorMessage messageKey={(form.formState.errors as FieldErrors<{ photos: string }>).photos?.message as string | undefined} t={t} />
            <FieldErrorMessage messageKey={state.fieldErrors?.photos} t={t} />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-primary" htmlFor="return-comment">
              {t('return_request.form.comment_label')}
            </label>
            <Textarea
              id="return-comment"
              rows={5}
              {...form.register('comment', {
                onBlur: registerBlur('comment'),
              })}
            />
            <FieldErrorMessage messageKey={form.formState.errors.comment?.message} t={t} />
            <BlurSuccess
              active={blurred.comment && !form.formState.errors.comment}
              label={t('common.inline_success')}
            />
          </div>

          <Alert variant="neutral">{t('return_request.handoff_message')}</Alert>

          {state.status === 'success' ? (
            <Alert variant="positive">
              <div className="space-y-2">
                <p>{t('return_request.success.submitted')}</p>
                {state.redirectPath ? (
                  <Link href={state.redirectPath} className="text-sm font-medium underline">
                    {t('return_request.success.go_to_summary')}
                  </Link>
                ) : null}
              </div>
            </Alert>
          ) : null}

          {state.status === 'error' && state.messageKey ? <Alert variant="negative">{t(state.messageKey as never)}</Alert> : null}

          <Button type="submit" loading={pending} disabled={pending}>
            {pending ? t('common.submitting') : t('return_request.form.submit')}
          </Button>
        </form>
      </SectionCard>
    </div>
  );
}

function AddressEditor({
  open,
  onClose,
  countries,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  countries: CountryRecord[];
  initialValues?: AddressFormValues;
}) {
  const t = useTranslations('account_write');
  const [state, action, pending] = useActionState(submitAddress, accountActionInitialState);
  const formRef = useRef<HTMLFormElement | null>(null);
  const { blurred, registerBlur } = useBlurSuccessState<AddressFormValues>();

  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues:
      initialValues ?? {
        addressId: '',
        addressName: '',
        firstName: '',
        lastName: '',
        company: '',
        address1: '',
        city: '',
        countryCode: countries[0]?.iso_2 ?? 'pl',
        postalCode: '',
        province: '',
        phone: '',
      },
  });

  useEffect(() => {
    form.reset(
      initialValues ?? {
        addressId: '',
        addressName: '',
        firstName: '',
        lastName: '',
        company: '',
        address1: '',
        city: '',
        countryCode: countries[0]?.iso_2 ?? 'pl',
        postalCode: '',
        province: '',
        phone: '',
      }
    );
  }, [countries, form, initialValues]);

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      mapServerErrorsToForm<AddressFormValues>(state, form.setError, form.setFocus);
    }
  }, [form, state]);

  useEffect(() => {
    if (state.status === 'success') {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={
        initialValues?.addressId
          ? t('addresses.form.edit_title')
          : t('addresses.form.create_title')
      }
      body={
        <form
          ref={formRef}
          className="grid gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit(() => {
            if (!formRef.current) return;
            action(new FormData(formRef.current));
          })}
        >
          <input type="hidden" {...form.register('addressId')} />

          {[
            ['addressName', t('addresses.form.address_name')],
            ['firstName', t('addresses.form.first_name')],
            ['lastName', t('addresses.form.last_name')],
            ['company', t('addresses.form.company')],
            ['address1', t('addresses.form.address_line')],
            ['city', t('addresses.form.city')],
            ['postalCode', t('addresses.form.postal_code')],
            ['province', t('addresses.form.province')],
            ['phone', t('addresses.form.phone')],
          ].map(([name, label]) => (
            <div key={name} className={name === 'address1' ? 'md:col-span-2' : undefined}>
              <label className="mb-2 block text-sm font-medium text-primary" htmlFor={`address-${name}`}>
                {label}
              </label>
              <Input
                id={`address-${name}`}
                {...form.register(name as FieldPath<AddressFormValues>, {
                  onBlur: registerBlur(name as FieldPath<AddressFormValues>),
                })}
              />
              <FieldErrorMessage
                messageKey={form.formState.errors[name as keyof AddressFormValues]?.message as string | undefined}
                t={t}
              />
              <BlurSuccess
                active={
                  Boolean(blurred[name]) &&
                  !form.formState.errors[name as keyof AddressFormValues]
                }
                label={t('common.inline_success')}
              />
            </div>
          ))}

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-primary" htmlFor="address-country">
              {t('addresses.form.country')}
            </label>
            <select
              id="address-country"
              className="min-h-[44px] w-full rounded-sm border border-[var(--bb-border-soft)] px-3 py-2"
              {...form.register('countryCode')}
            >
              {countries.map((country) => (
                <option key={country.iso_2} value={country.iso_2}>
                  {country.display_name}
                </option>
              ))}
            </select>
            <FieldErrorMessage messageKey={form.formState.errors.countryCode?.message} t={t} />
          </div>

          {state.status === 'error' && state.messageKey ? (
            <div className="md:col-span-2">
              <Alert variant="negative">{t(state.messageKey as never)}</Alert>
            </div>
          ) : null}
          <button type="submit" className="hidden" aria-hidden="true" />
        </form>
      }
      actions={[
        {
          id: 'cancel',
          label: t('common.cancel'),
          onClick: onClose,
          variant: 'tonal',
        },
        {
          id: 'submit',
          label: pending ? t('common.saving') : t('common.save'),
          onClick: () => formRef.current?.requestSubmit(),
        },
      ]}
    />
  );
}

export function SavedAddressesSurface({
  addresses,
  countries,
  customerEmail,
  customerPhone,
}: SavedAddressesProps) {
  const t = useTranslations('account_write');
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AddressRecord | null>(null);
  const [editing, setEditing] = useState<AddressFormValues | undefined>(undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAddressAction, accountActionInitialState);

  const empty = addresses.length === 0;

  const normalizedInitialValues = useMemo<AddressFormValues | undefined>(() => {
    if (!editing) return undefined;
    return editing;
  }, [editing]);

  useEffect(() => {
    if (deleteState.status === 'success') {
      setDeleteTarget(null);
    }
  }, [deleteState.status]);

  return (
    <div className="space-y-6" data-testid="saved-addresses-page">
      <SurfaceHero
        eyebrow={t('addresses.hero.eyebrow')}
        title={t('addresses.hero.title')}
        description={t('addresses.hero.description')}
        cta={
          <Button
            type="button"
            onClick={() => {
              setEditing(undefined);
              setEditorOpen(true);
            }}
          >
            {t('addresses.actions.add')}
          </Button>
        }
      />

      {empty ? (
        <SectionCard title={t('addresses.empty.title')} description={t('addresses.empty.description')}>
          <div className="space-y-4 text-sm text-secondary">
            <p>{t('addresses.empty.body')}</p>
            <Button
              type="button"
              onClick={() => {
                setEditing(undefined);
                setEditorOpen(true);
              }}
            >
              {t('addresses.actions.add')}
            </Button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title={t('addresses.list.title')} description={t('addresses.list.description')}>
          <div className="space-y-4">
            {addresses.map((address) => (
              <article
                key={address.id}
                className="rounded-2xl border border-[var(--bb-border-soft)] bg-[var(--bb-surface-3-60)] p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1 text-sm text-secondary">
                    <p className="font-semibold text-primary">{address.address_name || t('addresses.list.default_label')}</p>
                    <p>{[address.first_name, address.last_name].filter(Boolean).join(' ')}</p>
                    {address.company ? <p>{address.company}</p> : null}
                    <p>{renderAddressLine(address, countries)}</p>
                    <p>{customerEmail}</p>
                    <p>{address.phone || customerPhone || t('addresses.list.no_phone')}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="tonal"
                      onClick={() => {
                        setEditing({
                          addressId: address.id,
                          addressName: address.address_name ?? '',
                          firstName: address.first_name ?? '',
                          lastName: address.last_name ?? '',
                          company: address.company ?? '',
                          address1: address.address_1 ?? '',
                          city: address.city ?? '',
                          countryCode: address.country_code ?? countries[0]?.iso_2 ?? 'pl',
                          postalCode: address.postal_code ?? '',
                          province: address.province ?? '',
                          phone: address.phone ?? customerPhone ?? '',
                        });
                        setEditorOpen(true);
                      }}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button type="button" variant="tonal" onClick={() => setDeleteTarget(address)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      )}

      <AddressEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        countries={countries}
        initialValues={normalizedInitialValues}
      />

      <ModalShell
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        variant="confirm-destructive"
        title={t('addresses.delete.title')}
        body={
          <div className="space-y-4">
            <p>{t('addresses.delete.description')}</p>
            {deleteState.status === 'error' && deleteState.messageKey ? (
              <Alert variant="negative">{t(deleteState.messageKey as never)}</Alert>
            ) : null}
          </div>
        }
        actions={[
          {
            id: 'cancel',
            label: t('common.cancel'),
            onClick: () => setDeleteTarget(null),
            variant: 'tonal',
          },
          {
            id: 'confirm',
            label: deletePending ? t('common.deleting') : t('common.delete'),
            onClick: () => {
              if (!deleteTarget) return;
              const formData = new FormData();
              formData.set('addressId', deleteTarget.id);
              deleteAction(formData);
            },
            destructive: true,
          },
        ]}
      />
    </div>
  );
}

export function ReviewsToWriteSurface({ orders }: ReviewsToWriteProps) {
  const t = useTranslations('account_write');
  const [creating, setCreating] = useState<ReviewableOrder | null>(null);

  return (
    <div className="space-y-6" data-testid="reviews-to-write-page">
      <SurfaceHero
        eyebrow={t('reviews_to_write.hero.eyebrow')}
        title={t('reviews_to_write.hero.title')}
        description={t('reviews_to_write.hero.description')}
      />

      {orders.length === 0 ? (
        <SectionCard title={t('reviews_to_write.empty.title')} description={t('reviews_to_write.empty.description')}>
          <div className="space-y-4 text-sm text-secondary">
            <p>{t('reviews_to_write.empty.body')}</p>
            <Link href="/user/reviews/written" className="inline-flex min-h-[44px] items-center text-sm font-medium underline">
              {t('reviews_to_write.empty.cta')}
            </Link>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title={t('reviews_to_write.list.title')} description={t('reviews_to_write.list.description')}>
          <div className="space-y-4">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-[var(--bb-border-soft)] bg-[var(--bb-surface-3-60)] p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-primary">{order.sellerName}</p>
                    <p className="text-sm text-secondary">{t('reviews_to_write.list.order_label', { id: order.displayId })}</p>
                    {order.createdAt ? (
                      <p className="text-sm text-secondary">
                        {typeof order.createdAt === 'string'
                          ? order.createdAt
                          : order.createdAt.toISOString()}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" onClick={() => setCreating(order)}>
                      {t('reviews_to_write.actions.write')}
                    </Button>
                    <Link
                      href={`/user/reviews/written`}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-sm border border-[var(--bb-border-soft)] px-4 py-2 text-sm font-medium text-primary"
                    >
                      {t('reviews_to_write.actions.compare')}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      )}

      <CreateReviewForm order={creating} open={Boolean(creating)} onClose={() => setCreating(null)} />
    </div>
  );
}

export function WrittenReviewsSurface({ reviews }: WrittenReviewsProps) {
  const t = useTranslations('account_write');
  const [editing, setEditing] = useState<ReviewRecord | null>(null);
  const [deleting, setDeleting] = useState<ReviewRecord | null>(null);

  return (
    <div className="space-y-6" data-testid="written-reviews-page">
      <SurfaceHero
        eyebrow={t('written_reviews.hero.eyebrow')}
        title={t('written_reviews.hero.title')}
        description={t('written_reviews.hero.description')}
      />

      {reviews.length === 0 ? (
        <SectionCard title={t('written_reviews.empty.title')} description={t('written_reviews.empty.description')}>
          <p className="text-sm text-secondary">{t('written_reviews.empty.body')}</p>
        </SectionCard>
      ) : (
        <SectionCard title={t('written_reviews.list.title')} description={t('written_reviews.list.description')}>
          <div className="space-y-4">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-[var(--bb-border-soft)] bg-[var(--bb-surface-3-60)] p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-primary">{review.seller?.name || t('written_reviews.list.unknown_seller')}</p>
                      <span className="rounded-full bg-[var(--bb-tint-accent-18)] px-3 py-1 text-xs font-semibold text-primary">
                        {t('written_reviews.list.rating', { rating: review.rating })}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-secondary">
                      {review.customer_note || t('written_reviews.list.no_note')}
                    </p>
                    {review.updated_at ? (
                      <p className="text-xs text-secondary">{t('written_reviews.list.updated_at', { date: review.updated_at })}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" variant="tonal" onClick={() => setEditing(review)}>
                      {t('common.edit')}
                    </Button>
                    <Button type="button" variant="tonal" onClick={() => setDeleting(review)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      )}

      <WrittenReviewForm review={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
      <DeleteReviewDialog review={deleting} open={Boolean(deleting)} onClose={() => setDeleting(null)} />
    </div>
  );
}

function SettingsFormShell<TValues extends FieldValues>({
  title,
  description,
  form,
  actionHook,
  renderFields,
}: {
  title: string;
  description: string;
  form: ReturnType<typeof useForm<TValues>>;
  actionHook: [AccountActionState, (payload: FormData) => void, boolean];
  renderFields: (helpers: {
    t: TranslationFn;
    blurred: Record<string, boolean>;
    registerBlur: (name: FieldPath<TValues>) => () => void;
  }) => ReactNode;
}) {
  const t = useTranslations('account_write');
  const [state, action, pending] = actionHook;
  const formRef = useRef<HTMLFormElement | null>(null);
  const { blurred, registerBlur } = useBlurSuccessState<TValues>();

  useEffect(() => {
    if (state.status === 'error' && state.fieldErrors) {
      mapServerErrorsToForm<TValues>(state, form.setError, form.setFocus);
    }
  }, [form, state]);

  return (
    <SectionCard title={title} description={description}>
      <form
        ref={formRef}
        className="space-y-4"
        onSubmit={form.handleSubmit(() => {
          if (!formRef.current) return;
          action(new FormData(formRef.current));
        })}
      >
        {renderFields({ t, blurred, registerBlur })}
        {state.messageKey && state.status === 'error' ? <Alert variant="negative">{t(state.messageKey as never)}</Alert> : null}
        {state.messageKey && state.status === 'success' ? <Alert variant="positive">{t(state.messageKey as never)}</Alert> : null}
        <Button type="submit" loading={pending} disabled={pending}>
          {pending ? t('common.saving') : t('common.save')}
        </Button>
      </form>
    </SectionCard>
  );
}

export function ReturnRequestSuccessSurface({ orderId }: { orderId: string }) {
  const t = useTranslations('account_write');

  return (
    <div className="space-y-6" data-testid="return-request-success-page">
      <SurfaceHero
        eyebrow={t('return_success.hero.eyebrow')}
        title={t('return_success.hero.title')}
        description={t('return_success.hero.description', { orderId })}
        cta={<StateLifecycleBadge tone="pending" label={t('return_success.badge.pending')} />}
      />

      <SectionCard title={t('return_success.timeline.title')} description={t('return_success.timeline.description')}>
        <ol className="space-y-0">
          <TimelineItem
            title={t('return_success.timeline.submitted.title')}
            body={t('return_success.timeline.submitted.body')}
            tone="success"
          />
          <TimelineItem
            title={t('return_success.timeline.vendor_review.title')}
            body={t('return_success.timeline.vendor_review.body')}
            tone="pending"
          />
          <TimelineItem
            title={t('return_success.timeline.payout.title')}
            body={t('return_success.timeline.payout.body')}
            tone="progress"
            last
          />
        </ol>
      </SectionCard>

      <SectionCard title={t('return_success.handoff.title')} description={t('return_success.handoff.description')}>
        <div className="space-y-4">
          <CrossActorHandoff
            labelForYou={t('return_success.handoff.for_customer_label')}
            labelForUs={t('return_success.handoff.for_vendor_label')}
            forYou={t('return_success.handoff.for_customer')}
            forUs={t('return_success.handoff.for_vendor')}
          />
          <CrossActorHandoff
            labelForYou={t('return_success.handoff.for_support_label')}
            labelForUs={t('return_success.handoff.for_platform_label')}
            forYou={t('return_success.handoff.for_support')}
            forUs={t('return_success.handoff.for_platform')}
            data-testid="cross-actor-handoff-support"
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function AccountSettingsSurface({ customer }: SettingsProps) {
  const t = useTranslations('account_write');

  const profileForm = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      email: customer.email,
      locale: customer.locale,
    },
  });

  const securityForm = useForm<SecuritySettingsFormValues>({
    resolver: zodResolver(securitySettingsSchema),
    defaultValues: {
      email: customer.email,
      password: '',
      confirmPassword: '',
    },
  });

  const notificationForm = useForm<NotificationSettingsFormValues>({
    defaultValues: {
      emailUpdates: true,
      smsUpdates: false,
      productNews: true,
    },
  });

  const paymentForm = useForm<PaymentSettingsFormValues>({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues: {
      defaultCard: 'ending-4242',
      invoicesByEmail: 'on',
    },
  });

  const privacyForm = useForm<PrivacySettingsFormValues>({
    defaultValues: {
      requestType: 'export',
    },
  });

  return (
    <div className="space-y-6" data-testid="account-settings-page">
      <SurfaceHero
        eyebrow={t('settings.hero.eyebrow')}
        title={t('settings.hero.title')}
        description={t('settings.hero.description')}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[260px_minmax(0,1fr)]">
        <SectionCard
          title={t('settings.nav.title')}
          description={t('settings.nav.description')}
          className="h-fit xl:sticky xl:top-20"
        >
          <div className="flex gap-2 overflow-x-auto pb-2 xl:flex-col xl:overflow-visible">
            {['profile', 'security', 'notifications', 'payments', 'privacy'].map((item) => (
              <a
                key={item}
                href={`#settings-${item}`}
                className="inline-flex min-h-[44px] min-w-max items-center rounded-full border border-[var(--bb-border-soft)] px-4 py-2 text-sm text-primary"
              >
                {t(`settings.sections.${item}` as never)}
              </a>
            ))}
          </div>
        </SectionCard>

        <div className="space-y-4">
          <div id="settings-profile">
            <SettingsFormShell
              title={t('settings.profile.title')}
              description={t('settings.profile.description')}
              form={profileForm}
              actionHook={useActionState(updateProfileSettings, accountActionInitialState)}
              renderFields={({ t, blurred, registerBlur }) => (
                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    ['firstName', t('settings.profile.first_name')],
                    ['lastName', t('settings.profile.last_name')],
                    ['phone', t('settings.profile.phone')],
                    ['email', t('settings.profile.email')],
                  ].map(([name, label]) => (
                    <div key={name}>
                      <label className="mb-2 block text-sm font-medium text-primary" htmlFor={`profile-${name}`}>
                        {label}
                      </label>
                      <Input
                        id={`profile-${name}`}
                        readOnly={name === 'email'}
                        aria-readonly={name === 'email' ? 'true' : undefined}
                        {...profileForm.register(name as FieldPath<ProfileSettingsFormValues>, {
                          onBlur: registerBlur(name as FieldPath<ProfileSettingsFormValues>),
                        })}
                      />
                      <FieldErrorMessage
                        messageKey={profileForm.formState.errors[name as keyof ProfileSettingsFormValues]?.message as string | undefined}
                        t={t}
                      />
                      <BlurSuccess active={Boolean(blurred[name]) && !profileForm.formState.errors[name as keyof ProfileSettingsFormValues]} label={t('common.inline_success')} />
                    </div>
                  ))}
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-primary" htmlFor="profile-locale">
                      {t('settings.profile.locale')}
                    </label>
                    <select
                      id="profile-locale"
                      className="min-h-[44px] w-full rounded-sm border border-[var(--bb-border-soft)] px-3 py-2"
                      {...profileForm.register('locale')}
                    >
                      {['pl', 'en', 'ua', 'de'].map((locale) => (
                        <option key={locale} value={locale}>
                          {locale.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            />
          </div>

          <div id="settings-security">
            <SettingsFormShell
              title={t('settings.security.title')}
              description={t('settings.security.description')}
              form={securityForm}
              actionHook={useActionState(updateSecuritySettings, accountActionInitialState)}
              renderFields={({ t, blurred, registerBlur }) => (
                <div className="grid gap-4 md:grid-cols-2">
                  <input type="hidden" {...securityForm.register('email')} />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-primary" htmlFor="security-password">
                      {t('settings.security.new_password')}
                    </label>
                    <Input
                      id="security-password"
                      type="password"
                      {...securityForm.register('password', {
                        onBlur: registerBlur('password'),
                      })}
                    />
                    <FieldErrorMessage messageKey={securityForm.formState.errors.password?.message} t={t} />
                    <BlurSuccess active={Boolean(blurred.password) && !securityForm.formState.errors.password} label={t('common.inline_success')} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-primary" htmlFor="security-confirm-password">
                      {t('settings.security.confirm_password')}
                    </label>
                    <Input
                      id="security-confirm-password"
                      type="password"
                      {...securityForm.register('confirmPassword', {
                        onBlur: registerBlur('confirmPassword'),
                      })}
                    />
                    <FieldErrorMessage messageKey={securityForm.formState.errors.confirmPassword?.message} t={t} />
                    <BlurSuccess active={Boolean(blurred.confirmPassword) && !securityForm.formState.errors.confirmPassword} label={t('common.inline_success')} />
                  </div>
                </div>
              )}
            />
          </div>

          <div id="settings-notifications">
            <SettingsFormShell
              title={t('settings.notifications.title')}
              description={t('settings.notifications.description')}
              form={notificationForm}
              actionHook={useActionState(updateNotificationSettings, accountActionInitialState)}
              renderFields={() => (
                <div className="space-y-3">
                  {[
                    ['emailUpdates', t('settings.notifications.email_updates')],
                    ['smsUpdates', t('settings.notifications.sms_updates')],
                    ['productNews', t('settings.notifications.product_news')],
                  ].map(([name, label]) => (
                    <label key={name} className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-[var(--bb-border-soft)] px-4 py-3">
                      <input
                        type="hidden"
                        name={name}
                        value={notificationForm.watch(name as keyof NotificationSettingsFormValues) ? 'on' : 'off'}
                      />
                      <Controller
                        control={notificationForm.control}
                        name={name as keyof NotificationSettingsFormValues}
                        render={({ field }) => (
                          <Checkbox
                            checked={Boolean(field.value)}
                            onChange={(event) => field.onChange(event.currentTarget.checked)}
                          />
                        )}
                      />
                      <span className="text-sm text-primary">{label}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </div>

          <div id="settings-payments">
            <SettingsFormShell
              title={t('settings.payments.title')}
              description={t('settings.payments.description')}
              form={paymentForm}
              actionHook={useActionState(updatePaymentSettings, accountActionInitialState)}
              renderFields={() => (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-primary" htmlFor="payment-card">
                    {t('settings.payments.default_card')}
                  </label>
                  {/* PCI guard: last-4 card token only; full PAN/CVV rejected at server schema. */}
                  <Input
                    id="payment-card"
                    maxLength={10}
                    inputMode="text"
                    autoComplete="off"
                    pattern="(ending-)?\d{2,4}"
                    aria-describedby="payment-card-help"
                    placeholder="ending-4242"
                    {...paymentForm.register('defaultCard')}
                  />
                  <p id="payment-card-help" className="text-xs text-secondary">
                    {t('settings.payments.default_card_help')}
                  </p>
                  <FieldErrorMessage messageKey={paymentForm.formState.errors.defaultCard?.message} t={t} />
                  <label className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-[var(--bb-border-soft)] px-4 py-3">
                    <input
                      type="hidden"
                      name="invoicesByEmail"
                      value={paymentForm.watch('invoicesByEmail') === 'on' ? 'on' : 'off'}
                    />
                    <Controller
                      control={paymentForm.control}
                      name="invoicesByEmail"
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value === 'on'}
                          onChange={(event) => field.onChange(event.currentTarget.checked ? 'on' : 'off')}
                        />
                      )}
                    />
                    <span className="text-sm text-primary">{t('settings.payments.invoices_by_email')}</span>
                  </label>
                </div>
              )}
            />
          </div>

          <div id="settings-privacy">
            <SettingsFormShell
              title={t('settings.privacy.title')}
              description={t('settings.privacy.description')}
              form={privacyForm}
              actionHook={useActionState(submitPrivacyRequest, accountActionInitialState)}
              renderFields={() => (
                <div className="space-y-4">
                  <Alert variant="neutral">{t('settings.privacy.request_intake_notice')}</Alert>
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      ['export', t('settings.privacy.export_request')],
                      ['delete', t('settings.privacy.delete_request')],
                    ].map(([value, label]) => (
                      <label
                        key={value}
                        className={cn(
                          'flex min-h-[44px] items-start gap-3 rounded-2xl border p-4',
                          privacyForm.watch('requestType') === value
                            ? 'border-[var(--accent,#A89279)] bg-[var(--bb-tint-accent-12)]'
                            : 'border-[var(--bb-border-soft)]'
                        )}
                      >
                        <span className="mt-0.5">
                          <input
                            type="radio"
                            value={value}
                            className="sr-only"
                            {...privacyForm.register('requestType')}
                          />
                          <Radio checked={privacyForm.watch('requestType') === value} />
                        </span>
                        <span className="text-sm text-primary">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
