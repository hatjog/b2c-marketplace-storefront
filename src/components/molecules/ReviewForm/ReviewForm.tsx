'use client';

import { useMemo, useState, type FC } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  FormProvider,
  useForm,
  useFormContext,
  type FieldError,
  type FieldValues
} from 'react-hook-form';

import { Button } from '@/components/atoms';
import { InteractiveStarRating } from '@/components/atoms/InteractiveStarRating/InteractiveStarRating';
import { createReview } from '@/lib/data/reviews';
import type { Order } from '@/lib/data/reviews.shared';
import { cn } from '@/lib/utils';

import { createReviewSchema, type ReviewFormData } from './schema';

interface Props {
  handleClose?: () => void;
  seller: Order;
}

export const ReviewForm: React.FC<Props> = ({ ...props }) => {
  const tValidation = useTranslations('validation');
  const schema = useMemo(() => createReviewSchema(tValidation), [tValidation]);
  const methods = useForm<ReviewFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      sellerId: '',
      rating: 0,
      opinion: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <Form {...props} />
    </FormProvider>
  );
};

const Form: FC<Props> = ({ handleClose, seller }) => {
  const t = useTranslations('reviews');
  const [error, setError] = useState<string>();
  const {
    watch,
    handleSubmit,
    register,
    setValue,
    formState: { errors }
  } = useFormContext();

  const submit = async (data: FieldValues) => {
    const body = {
      order_id: seller.id,
      rating: data.rating,
      reference: 'seller',
      reference_id: seller.seller.id,
      customer_note: data.opinion
    };

    const response = await createReview(body);

    if (response.error) {
      setError(t('generic_error'));
      return;
    }

    setError('');
    handleClose && handleClose();
  };

  const lettersCount = watch('opinion')?.length;
  const rating = watch('rating');

  return (
    <form
      onSubmit={handleSubmit(submit)}
      data-testid="review-form"
    >
      <div className="space-y-4 px-4">
        <div className="items-top mb-4 grid max-w-full grid-cols-1 gap-4">
          <div>
            <label
              className="label-sm mb-2 block"
              data-testid="review-form-rating-label"
            >
              {t('rating_label')}
            </label>
            <InteractiveStarRating
              value={rating}
              onChange={value => setValue('rating', value)}
              error={!!errors.rating}
              data-testid="review-form-rating-input"
            />
            {errors.rating?.message && (
              <p
                className="label-sm mt-1 text-negative"
                data-testid="review-form-rating-error"
              >
                {(errors.rating as FieldError).message}
              </p>
            )}
          </div>

          <label className={cn('label-sm relative block')}>
            <p
              className={cn(error && 'text-negative')}
              data-testid="review-form-opinion-label"
            >
              {t('opinion_label')}
            </p>
            <textarea
              className={cn(
                'relative h-32 w-full rounded-sm border bg-component-secondary px-4 py-3 focus:border-primary focus:outline-none focus:ring-0',
                error && 'border-negative focus:border-negative'
              )}
              placeholder={t('opinion_placeholder')}
              data-testid="review-form-opinion-input"
              {...register('opinion')}
            />
            <div
              className={cn(
                'label-medium absolute right-4 text-secondary',
                errors.opinion?.message ? 'bottom-8' : 'bottom-3'
              )}
              data-testid="review-form-character-count"
            >
              {t('char_count', { count: lettersCount })}
            </div>
            {errors.opinion?.message && (
              <p
                className="label-sm text-negative"
                data-testid="review-form-opinion-error"
              >
                {(errors.opinion as FieldError).message}
              </p>
            )}
          </label>
        </div>
        {error && (
          <p
            className="label-md text-negative"
            data-testid="review-form-error"
          >
            {error}
          </p>
        )}
        <Button
          className="w-full"
          data-testid="review-form-submit-button"
        >
          {t('submit_button')}
        </Button>
      </div>
    </form>
  );
};
