import { z } from 'zod';

export const createReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
export type CreateReviewRequest = z.infer<typeof createReviewSchema>;

export interface ReviewDto {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface ProductReviewsDto {
  average: number;
  count: number;
  items: ReviewDto[];
}

export interface ReviewEligibilityDto {
  canReview: boolean;
  alreadyReviewed: boolean;
}
