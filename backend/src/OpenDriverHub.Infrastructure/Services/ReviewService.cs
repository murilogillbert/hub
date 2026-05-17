using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class ReviewService : IReviewService
{
    private readonly AppDbContext _db;
    public ReviewService(AppDbContext db) => _db = db;

    public async Task<ProductReviewsDto> ListForProductAsync(Guid productId, CancellationToken ct)
    {
        var reviews = await _db.Reviews
            .Include(r => r.User)
            .Where(r => r.ProductId == productId)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        var items = reviews.Select(r => new ReviewDto(
            r.Id, r.ProductId, r.UserId, r.User?.Name ?? "Cliente",
            r.User?.AvatarUrl, r.Rating, r.Comment, r.CreatedAt)).ToList();

        var avg = reviews.Count > 0
            ? Math.Round(reviews.Average(r => r.Rating), 1)
            : 0d;
        return new ProductReviewsDto(avg, reviews.Count, items);
    }

    public async Task<ReviewEligibilityDto> EligibilityAsync(
        Guid userId, Guid productId, CancellationToken ct)
    {
        var already = await _db.Reviews
            .AnyAsync(r => r.ProductId == productId && r.UserId == userId, ct);
        var redeemed = await HasRedeemedAsync(userId, productId, ct);
        return new ReviewEligibilityDto(redeemed && !already, already);
    }

    public async Task<ReviewDto> CreateAsync(
        Guid userId, CreateReviewRequest req, CancellationToken ct)
    {
        if (req.Rating is < 1 or > 5)
            throw new AppException("A nota deve ser de 1 a 5 estrelas.", 400);

        var product = await _db.Products.FindAsync([req.ProductId], ct)
            ?? throw new AppException("Produto não encontrado.", 404);

        // Elegibilidade: precisa ter um item resgatado deste produto.
        var orderId = await _db.OrderItems
            .Where(i => i.ProductId == req.ProductId
                && i.RedeemedAt != null
                && i.Order!.CustomerId == userId)
            .OrderByDescending(i => i.RedeemedAt)
            .Select(i => (Guid?)i.OrderId)
            .FirstOrDefaultAsync(ct)
            ?? throw new AppException(
                "Você só pode avaliar um produto após resgatá-lo.", 403);

        if (await _db.Reviews.AnyAsync(
                r => r.ProductId == req.ProductId && r.UserId == userId, ct))
            throw new AppException("Você já avaliou este produto.", 409);

        var user = await _db.Users.FindAsync([userId], ct)
            ?? throw new AppException("Usuário não encontrado.", 401);

        var review = new Review
        {
            ProductId = req.ProductId,
            UserId = userId,
            OrderId = orderId,
            Rating = req.Rating,
            Comment = (req.Comment ?? "").Trim(),
        };
        _db.Reviews.Add(review);

        // Recalcula a nota do produto = média das avaliações (mantém o
        // catálogo/ordenação atuais funcionando com Product.Rating).
        var ratings = await _db.Reviews
            .Where(r => r.ProductId == req.ProductId)
            .Select(r => r.Rating)
            .ToListAsync(ct);
        ratings.Add(req.Rating);
        product.Rating = Math.Round(ratings.Average(), 1);

        await _db.SaveChangesAsync(ct);

        return new ReviewDto(
            review.Id, review.ProductId, userId, user.Name, user.AvatarUrl,
            review.Rating, review.Comment, review.CreatedAt);
    }

    private Task<bool> HasRedeemedAsync(Guid userId, Guid productId, CancellationToken ct)
        => _db.OrderItems.AnyAsync(i => i.ProductId == productId
            && i.RedeemedAt != null
            && i.Order!.CustomerId == userId, ct);
}
