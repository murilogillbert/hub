using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class PartnerService : IPartnerService
{
    private readonly AppDbContext _db;
    public PartnerService(AppDbContext db) => _db = db;

    public async Task<List<ProductDto>> MyProductsAsync(Guid partnerId, CancellationToken ct)
        => (await _db.Products.Include(p => p.Partner)
                .Where(p => p.PartnerId == partnerId)
                .OrderBy(p => p.Title).ToListAsync(ct))
            .Select(p => p.ToDto()).ToList();

    public async Task<ProductDto> CreateProductAsync(Guid partnerId, ProductUpsertRequest req, CancellationToken ct)
    {
        var partner = await _db.Partners.FindAsync([partnerId], ct)
            ?? throw new AppException("Parceiro não encontrado.", 404);
        var p = new Product
        {
            PartnerId = partnerId,
            Title = req.Title,
            Description = req.Description,
            Price = req.Price,
            CashbackPercent = req.CashbackPercent,
            Kind = Mappings.ParseKind(req.Kind),
            ImageUrl = req.ImageUrl,
            Category = req.Category,
            Stock = req.Stock,
            Rating = 5.0,
            Partner = partner,
        };
        _db.Products.Add(p);
        await _db.SaveChangesAsync(ct);
        return p.ToDto();
    }

    public async Task<ProductDto> UpdateProductAsync(Guid partnerId, Guid productId, ProductUpsertRequest req, CancellationToken ct)
    {
        var p = await _db.Products.Include(x => x.Partner)
            .FirstOrDefaultAsync(x => x.Id == productId && x.PartnerId == partnerId, ct)
            ?? throw new AppException("Produto não encontrado.", 404);
        p.Title = req.Title;
        p.Description = req.Description;
        p.Price = req.Price;
        p.CashbackPercent = req.CashbackPercent;
        p.Kind = Mappings.ParseKind(req.Kind);
        p.ImageUrl = req.ImageUrl;
        p.Category = req.Category;
        p.Stock = req.Stock;
        await _db.SaveChangesAsync(ct);
        return p.ToDto();
    }

    public async Task DeleteProductAsync(Guid partnerId, Guid productId, CancellationToken ct)
    {
        var p = await _db.Products
            .FirstOrDefaultAsync(x => x.Id == productId && x.PartnerId == partnerId, ct)
            ?? throw new AppException("Produto não encontrado.", 404);
        p.Active = false; // soft-delete (preserva histórico de pedidos)
        await _db.SaveChangesAsync(ct);
    }

    public async Task<PartnerMetricsDto> MetricsAsync(Guid partnerId, CancellationToken ct)
    {
        var all = await _db.Orders
            .Include(o => o.Product)
            .Where(o => o.PartnerId == partnerId)
            .ToListAsync(ct);
        var partner = await _db.Partners.FindAsync([partnerId], ct);
        var fee = partner?.FeePercent ?? 10m;

        // Receita considera pedidos pagos/resgatados (exclui pendentes e cancelados).
        var valid = all.Where(o => o.Status is OrderStatus.Paid or OrderStatus.Redeemed).ToList();
        var revenue = valid.Sum(o => o.PaidPrice);

        var pendingCount = all.Count(o => o.Status == OrderStatus.PendingPayment);
        var paidCount = all.Count(o => o.Status == OrderStatus.Paid);
        var redeemedCount = all.Count(o => o.Status == OrderStatus.Redeemed);

        // Repasse: líquido dos vouchers já resgatados; "a repassar" = restante da receita.
        var paidTransfer = all.Where(o => o.Status == OrderStatus.Redeemed)
            .Sum(o => CommissionRules.PartnerNet(o.PaidPrice,
                CommissionRules.PlatformFeeFor(o.PaidPrice, fee), o.CashbackEarned));
        var pendingTransfer = all.Where(o => o.Status == OrderStatus.Paid)
            .Sum(o => CommissionRules.PartnerNet(o.PaidPrice,
                CommissionRules.PlatformFeeFor(o.PaidPrice, fee), o.CashbackEarned));

        var avgTicket = valid.Count > 0 ? Math.Round(revenue / valid.Count, 2) : 0m;
        var cashbackGranted = valid.Sum(o => o.CashbackEarned);
        var uniqueCustomers = valid.Select(o => o.CustomerId).Distinct().Count();
        var redemptionRate = paidCount + redeemedCount > 0
            ? Math.Round(100m * redeemedCount / (paidCount + redeemedCount), 1)
            : 0m;

        var byHour = Enumerable.Range(0, 24)
            .Select(h => new SeriesPoint($"{h:00}h",
                valid.Count(o => o.CreatedAt.ToLocalTime().Hour == h)))
            .Where(s => s.Value > 0)
            .ToList();

        var last7 = Enumerable.Range(0, 7)
            .Select(i => DateTime.UtcNow.Date.AddDays(-6 + i))
            .Select(d => new SeriesPoint(
                d.ToString("dd/MM"),
                valid.Where(o => o.CreatedAt.Date == d).Sum(o => o.PaidPrice)))
            .ToList();

        var topProducts = valid
            .GroupBy(o => o.Product?.Title ?? "—")
            .Select(g => new NamedValue(g.Key, g.Sum(o => o.PaidPrice), g.Count()))
            .OrderByDescending(n => n.Value).Take(5).ToList();

        var byCategory = valid
            .GroupBy(o => o.Product?.Category ?? "—")
            .Select(g => new NamedValue(g.Key, g.Sum(o => o.PaidPrice), g.Count()))
            .OrderByDescending(n => n.Value).ToList();

        var byMethod = valid
            .GroupBy(o => MethodLabel(o.PaymentMethod))
            .Select(g => new NamedValue(g.Key, g.Sum(o => o.PaidPrice), g.Count()))
            .OrderByDescending(n => n.Value).ToList();

        return new PartnerMetricsDto(
            Math.Round(revenue, 2), valid.Count,
            Math.Round(pendingTransfer, 2), Math.Round(paidTransfer, 2),
            avgTicket, Math.Round(cashbackGranted, 2), uniqueCustomers,
            pendingCount, paidCount, redeemedCount, redemptionRate,
            byHour, last7, topProducts, byCategory, byMethod);
    }

    private static string MethodLabel(PaymentMethod? m) => m switch
    {
        PaymentMethod.Pix => "Pix",
        PaymentMethod.CreditCard => "Crédito",
        PaymentMethod.DebitCard => "Débito",
        _ => "Outro",
    };

    public async Task<RedeemResult> RedeemAsync(Guid partnerId, Guid actorId, string code, bool confirm, CancellationToken ct)
    {
        var normalized = code.Replace("-", "").Trim().ToUpperInvariant();

        // Validação fora de transação (leitura).
        var preview = await _db.Orders.Include(o => o.Product).Include(o => o.Customer)
            .FirstOrDefaultAsync(o => o.PartnerId == partnerId
                && o.Code.ToUpper() == normalized, ct)
            ?? throw new AppException("Código não encontrado para esta loja.", 404);

        if (preview.Status == OrderStatus.Redeemed)
            throw new AppException("Voucher já resgatado.", 409);
        if (preview.Status != OrderStatus.Paid)
            throw new AppException("Voucher não está pago/liberado.", 409);

        var partner = await _db.Partners.FindAsync([partnerId], ct)
            ?? throw new AppException("Parceiro não encontrado.", 404);
        var fee = partner.FeePercent;
        var platformFee = CommissionRules.PlatformFeeFor(preview.PaidPrice, fee);
        var cashback = preview.CashbackEarned;
        var net = CommissionRules.PartnerNet(preview.PaidPrice, platformFee, cashback);

        if (!confirm)
            return new RedeemResult(preview.Id, preview.Product!.Title,
                preview.Customer!.Name, preview.PaidPrice, fee, platformFee,
                cashback, net, false);

        // Resgate efetivo: transação retriável (compatível com EnableRetryOnFailure).
        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var order = await _db.Orders.Include(o => o.Product).Include(o => o.Customer)
                .FirstOrDefaultAsync(o => o.Id == preview.Id, ct)
                ?? throw new AppException("Pedido não encontrado.", 404);
            if (order.Status == OrderStatus.Redeemed)
                throw new AppException("Voucher já resgatado.", 409);

            order.Status = OrderStatus.Redeemed;
            order.RedeemedAt = DateTime.UtcNow;
            // O cashback já foi creditado na aprovação do pagamento (compra).
            if (order.Product!.Stock > 0) order.Product.Stock -= 1;

            _db.Notifications.Add(new Notification
            {
                UserId = order.CustomerId,
                Title = "Voucher resgatado",
                Message = $"Seu voucher de {order.Product.Title} foi resgatado com sucesso.",
            });
            _db.AuditLogs.Add(new AuditLog
            {
                ActorId = actorId,
                Action = "order.redeem",
                EntityType = "Order",
                EntityId = order.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(new { order.Code, net, cashback }),
            });

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        return new RedeemResult(preview.Id, preview.Product!.Title, preview.Customer!.Name,
            preview.PaidPrice, fee, platformFee, cashback, net, true);
    }
}
