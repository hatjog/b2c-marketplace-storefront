import { z } from 'zod';

export const createReviewSchema = (t: (key: string) => string) =>
  z.object({
    sellerId: z.string(),
    rating: z.number().min(1, t('rating_required')).max(5),
    opinion: z.string().max(300, t('opinion_max')).optional()
  });

export type ReviewFormData = z.infer<ReturnType<typeof createReviewSchema>>;
