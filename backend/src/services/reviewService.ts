import type { CreateReviewRequest, ProductReviewsDto, ReviewDto, ReviewEligibilityDto } from '../dtos/reviews.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

export async function listForProduct(productId: string): Promise<ProductReviewsDto> {
  const reviews = await prisma.review.findMany({
    where: { productId },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
  });

  const items: ReviewDto[] = reviews.map((r) => ({
    id: r.id,
    productId: r.productId,
    userId: r.userId,
    userName: r.user?.name ?? 'Cliente',
    userAvatarUrl: r.user?.avatarUrl ?? null,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));

  const avg = reviews.length > 0 ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10 : 0;
  return { average: avg, count: reviews.length, items };
}

async function hasRedeemed(userId: string, productId: string): Promise<boolean> {
  const found = await prisma.orderItem.findFirst({
    where: { productId, redeemedAt: { not: null }, order: { customerId: userId } },
  });
  return found !== null;
}

export async function eligibility(userId: string, productId: string): Promise<ReviewEligibilityDto> {
  const already = (await prisma.review.findFirst({ where: { productId, userId } })) !== null;
  const redeemed = await hasRedeemed(userId, productId);
  return { canReview: redeemed && !already, alreadyReviewed: already };
}

export async function create(userId: string, req: CreateReviewRequest): Promise<ReviewDto> {
  if (req.rating < 1 || req.rating > 5) throw new AppError('A nota deve ser de 1 a 5 estrelas.', 400);

  const product = await prisma.product.findUnique({ where: { id: req.productId } });
  if (!product) throw new AppError('Produto não encontrado.', 404);

  // Elegibilidade: precisa ter um item resgatado deste produto.
  const eligibleItem = await prisma.orderItem.findFirst({
    where: { productId: req.productId, redeemedAt: { not: null }, order: { customerId: userId } },
    orderBy: { redeemedAt: 'desc' },
  });
  if (!eligibleItem) throw new AppError('Você só pode avaliar um produto após resgatá-lo.', 403);

  if (await prisma.review.findFirst({ where: { productId: req.productId, userId } }))
    throw new AppError('Você já avaliou este produto.', 409);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 401);

  const review = await prisma.review.create({
    data: {
      productId: req.productId,
      userId,
      orderId: eligibleItem.orderId,
      rating: req.rating,
      comment: (req.comment ?? '').trim(),
    },
  });

  // Recalcula a nota do produto = média das avaliações (mantém o
  // catálogo/ordenação atuais funcionando com Product.Rating).
  const ratings = await prisma.review.findMany({ where: { productId: req.productId }, select: { rating: true } });
  const avg = ratings.reduce((acc, r) => acc + r.rating, 0) / ratings.length;
  await prisma.product.update({ where: { id: req.productId }, data: { rating: Math.round(avg * 10) / 10 } });

  return {
    id: review.id,
    productId: review.productId,
    userId,
    userName: user.name,
    userAvatarUrl: user.avatarUrl,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}
