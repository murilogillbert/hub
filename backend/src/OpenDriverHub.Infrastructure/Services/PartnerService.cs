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
        var partner = await _db.Partners.FindAsync([partnerId], ct);
        var fee = partner?.FeePercent ?? 10m;

        // Itens deste parceiro (pedido multi-parceiro: agregamos por item).
        var items = await _db.OrderItems
            .Include(i => i.Order)
            .Where(i => i.PartnerId == partnerId)
            .ToListAsync(ct);

        bool IsValid(OrderItem i) =>
            i.Order!.Status is OrderStatus.Paid or OrderStatus.Redeemed;
        var valid = items.Where(IsValid).ToList();
        var revenue = valid.Sum(i => i.LineTotal);

        decimal NetOf(OrderItem i) => CommissionRules.PartnerNet(
            i.LineTotal, CommissionRules.PlatformFeeFor(i.LineTotal, fee),
            i.CashbackEarned);

        // Repasse REAL: "Recebido" = soma dos repasses lançados pelo admin.
        // "A receber" = líquido já resgatado ainda não repassado.
        var earnedNet = valid.Where(i => i.RedeemedAt != null).Sum(NetOf);
        var paidTransfer = await _db.PartnerPayouts
            .Where(p => p.PartnerId == partnerId)
            .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;
        var pendingTransfer = Math.Max(0m, earnedNet - paidTransfer);

        // Pedidos (distintos) que contêm itens deste parceiro.
        var orders = items.Select(i => i.Order!).DistinctBy(o => o.Id).ToList();
        var pendingCount = orders.Count(o => o.Status == OrderStatus.PendingPayment);
        var paidOrders = orders.Where(o => o.Status is OrderStatus.Paid or OrderStatus.Redeemed)
            .ToList();
        // "Resgatado" = pedido em que todos os itens deste parceiro foram resgatados.
        var redeemedCount = paidOrders.Count(o =>
            items.Where(i => i.OrderId == o.Id).All(i => i.RedeemedAt != null));
        var paidCount = paidOrders.Count - redeemedCount;

        var validOrderCount = paidOrders.Count;
        var avgTicket = validOrderCount > 0 ? Math.Round(revenue / validOrderCount, 2) : 0m;
        var cashbackGranted = valid.Sum(i => i.CashbackEarned);
        var uniqueCustomers = valid.Select(i => i.Order!.CustomerId).Distinct().Count();
        var redemptionRate = paidCount + redeemedCount > 0
            ? Math.Round(100m * redeemedCount / (paidCount + redeemedCount), 1)
            : 0m;

        var byHour = Enumerable.Range(0, 24)
            .Select(h => new SeriesPoint($"{h:00}h",
                valid.Count(i => i.Order!.CreatedAt.ToLocalTime().Hour == h)))
            .Where(s => s.Value > 0)
            .ToList();

        var last7 = Enumerable.Range(0, 7)
            .Select(i => DateTime.UtcNow.Date.AddDays(-6 + i))
            .Select(d => new SeriesPoint(
                d.ToString("dd/MM"),
                valid.Where(i => i.Order!.CreatedAt.Date == d).Sum(i => i.LineTotal)))
            .ToList();

        var topProducts = valid
            .GroupBy(i => i.ProductTitle.Length == 0 ? "—" : i.ProductTitle)
            .Select(g => new NamedValue(g.Key, g.Sum(i => i.LineTotal),
                g.Sum(i => i.Quantity)))
            .OrderByDescending(n => n.Value).Take(5).ToList();

        var byCategory = valid
            .GroupBy(i => i.Category.Length == 0 ? "—" : i.Category)
            .Select(g => new NamedValue(g.Key, g.Sum(i => i.LineTotal),
                g.Sum(i => i.Quantity)))
            .OrderByDescending(n => n.Value).ToList();

        var byMethod = valid
            .GroupBy(i => MethodLabel(i.Order!.PaymentMethod))
            .Select(g => new NamedValue(g.Key, g.Sum(i => i.LineTotal), g.Count()))
            .OrderByDescending(n => n.Value).ToList();

        return new PartnerMetricsDto(
            Math.Round(revenue, 2), validOrderCount,
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

        var order = await _db.Orders
                .Include(o => o.Customer)
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Code.ToUpper() == normalized, ct)
            ?? throw new AppException("Código não encontrado.", 404);

        if (order.Status == OrderStatus.PendingPayment)
            throw new AppException("Voucher não está pago/liberado.", 409);
        if (order.Status == OrderStatus.Cancelled)
            throw new AppException("Pedido cancelado.", 409);

        // Só os itens DESTA loja (pedido pode ter vários parceiros).
        var myItems = order.Items.Where(i => i.PartnerId == partnerId).ToList();
        if (myItems.Count == 0)
            throw new AppException(
                "Este voucher não contém itens da sua loja.", 409);
        var pending = myItems.Where(i => i.RedeemedAt == null).ToList();
        if (pending.Count == 0)
            throw new AppException(
                "Os itens da sua loja neste voucher já foram resgatados.", 409);

        var partner = await _db.Partners.FindAsync([partnerId], ct)
            ?? throw new AppException("Parceiro não encontrado.", 404);
        var fee = partner.FeePercent;
        var subtotal = pending.Sum(i => i.LineTotal);
        var cashback = pending.Sum(i => i.CashbackEarned);
        var platformFee = CommissionRules.PlatformFeeFor(subtotal, fee);
        var net = CommissionRules.PartnerNet(subtotal, platformFee, cashback);
        var title = string.Join(", ",
            pending.Select(i => $"{i.Quantity}x {i.ProductTitle}"));

        if (!confirm)
            return new RedeemResult(order.Id, title, order.Customer!.Name,
                subtotal, fee, platformFee, cashback, net, false);

        var strategy = _db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var fresh = await _db.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == order.Id, ct)
                ?? throw new AppException("Pedido não encontrado.", 404);

            var freshPending = fresh.Items
                .Where(i => i.PartnerId == partnerId && i.RedeemedAt == null)
                .ToList();
            if (freshPending.Count == 0)
                throw new AppException(
                    "Os itens da sua loja neste voucher já foram resgatados.", 409);

            var now = DateTime.UtcNow;
            foreach (var item in freshPending)
            {
                item.RedeemedAt = now;
                var product = await _db.Products.FindAsync([item.ProductId], ct);
                if (product is not null && product.Stock >= item.Quantity)
                    product.Stock -= item.Quantity;
            }

            // Pedido só fica "Resgatado" quando TODOS os itens forem resgatados.
            if (fresh.Items.All(i => i.RedeemedAt != null))
            {
                fresh.Status = OrderStatus.Redeemed;
                fresh.RedeemedAt = now;
            }

            _db.Notifications.Add(new Notification
            {
                UserId = fresh.CustomerId,
                Title = "Voucher resgatado",
                Message =
                    $"Itens de {partner.Name} no pedido {fresh.Code} resgatados.",
            });
            _db.AuditLogs.Add(new AuditLog
            {
                ActorId = actorId,
                Action = "order.redeem",
                EntityType = "Order",
                EntityId = fresh.Id.ToString(),
                PayloadJson = JsonSerializer.Serialize(
                    new { fresh.Code, partnerId, net, cashback, subtotal }),
            });

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        });

        return new RedeemResult(order.Id, title, order.Customer!.Name,
            subtotal, fee, platformFee, cashback, net, true);
    }
}
