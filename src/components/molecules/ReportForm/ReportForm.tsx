'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Textarea } from '@/components/atoms';
import { cn } from '@/lib/utils';

import { SelectField } from '../SelectField/SelectField';

/**
 * Shared body of the seller/listing abuse report forms.
 *
 * `ReportSellerForm` and `ReportListingForm` were byte-identical apart from the
 * submit label. Localising them separately would have created two editable
 * sources of the same copy, which SPEC.md forbids — so the body lives here once
 * and the wrappers differ only by `submitLabelKey`.
 *
 * Validation messages are i18n KEYS resolved at render time, matching the
 * precedent in `src/lib/account/account-write-schemas.ts`. zod resolves schema
 * messages outside React, so it can never hold the translated string itself.
 */
export const REPORT_FORM_ERRORS = {
  reasonRequired: 'report.errors.reason_required',
  commentRequired: 'report.errors.comment_required',
} as const;

const formSchema = z.object({
  reason: z.string().nonempty(REPORT_FORM_ERRORS.reasonRequired),
  comment: z.string().nonempty(REPORT_FORM_ERRORS.commentRequired),
});

type FormData = z.infer<typeof formSchema>;

type ReportFormProps = {
  onClose: () => void;
  /** Key under the `forms` namespace, e.g. `report.submit_seller`. Required so
   *  TypeScript covers every call site rather than a default hiding one. */
  submitLabelKey: string;
};

export const ReportForm = ({ onClose, submitLabelKey }: ReportFormProps) => {
  const t = useTranslations('forms');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    setValue,
    clearErrors,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reason: '',
      comment: '',
    },
  });

  const reasonOptions = [
    { label: '', value: '', hidden: true },
    {
      label: t('report.reason_dmca'),
      value: 'Trademark, Copyright or DMCA Violation',
    },
  ];

  const onSubmit = (_data: FormData) => {};

  return (
    <div>
      {!isSubmitted ? (
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="px-4 pb-5">
            <label className="label-sm">
              <p className={cn(errors?.reason && 'text-negative')}>{t('report.reason_label')}</p>
              <SelectField
                options={reasonOptions}
                {...register('reason')}
                selectOption={value => {
                  setValue('reason', value);
                  clearErrors('reason');
                }}
                className={cn(errors?.reason && 'border-negative')}
              />
              {errors?.reason?.message && (
                <p className="label-sm text-negative">{t(errors.reason.message)}</p>
              )}
            </label>

            <label className="label-sm">
              <p className={cn('mt-5', errors?.comment && 'text-negative')}>
                {t('report.comment_label')}
              </p>
              <Textarea
                rows={5}
                {...register('comment')}
                className={cn(errors.comment && 'border-negative')}
              />
              {errors?.comment?.message && (
                <p className="label-sm text-negative">{t(errors.comment.message)}</p>
              )}
            </label>
          </div>

          <div className="border-t px-4 pt-5">
            <Button
              type="submit"
              className="w-full py-3 uppercase"
            >
              {t(submitLabelKey)}
            </Button>
          </div>
        </form>
      ) : (
        <div className="text-center">
          <div className="px-4 pb-5">
            <h4 className="heading-lg uppercase">{t('report.success_heading')}</h4>
            <p className="mx-auto mt-4 max-w-[466px] text-lg text-secondary">
              {t('report.success_body')}
            </p>
          </div>

          <div className="border-t px-4 pt-5">
            <Button
              className="w-full py-3 uppercase"
              onClick={onClose}
            >
              {t('report.success_ack')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
