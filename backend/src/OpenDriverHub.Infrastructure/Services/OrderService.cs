using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class OrderService : IOrderService
{
    private readonly AppDbContext _db;
    public OrderService(AppDbContext db) => _db = db;

    public async Task<OrderDto> CreateAsync(Guid customerId, CreateOrderRequest req, CancellationToken ct)
    {
        // Compat: aceita 1 produto OU uma lista de itens (carrinho).
        var requested = (req.Items is { Count: > 0 }
            ? req.Items
            : req.ProductId is { } pid
                ? new List<CartItemInput> { new(pid, 1) }
                : new List<CartItemInput>())
            // Junta linhas repetidas do mesmo produto.
            .GroupBy(i => i.ProductId)
            .Select(g => new CartItemInput(g.Key, Math.Max(1, g.Sum(x => x.Quantity))))
            .ToList();
        if (requested.Count == 0)
            throw new AppException("Carrinho vazio.", 400);

        var customer = await _db.Users.FindAsync([customerId], ct)
            ?? throw new AppException("Usuário não encontrado.", 401);

        var order = new Order
        {
            Code = GenerateCode(),
            CustomerId = customerId,
            Customer = customer,
            Status = OrderStatus.PendingPayment,
        };

        decimal paidPrice = 0m, cashbackEarned = 0m;
        foreach (var ci in requested)
        {
            var product = await _db.Products.Include(p => p.Partner)
                .FirstOrDefaultAsync(p => p.Id == ci.ProductId, ct)
                ?? throw new AppException("Produto não encontrado.", 404);
            if (!product.Active)
                throw new AppException($"Produto indisponível: {product.Title}.", 409);
            var qty = Math.Max(1, ci.Quantity);
            if (product.Stock < qty)
                throw new AppException(
                    $"Estoque insuficiente para {product.Title}.", 409);

            var lineTotal = product.Price * qty;
            var lineCashback =
                CommissionRules.CashbackFor(lineTotal, product.CashbackPercent);
            order.Items.Add(new OrderItem
            {
                ProductId = product.Id,
                Product = product,
                PartnerId = product.PartnerId,
                Partner = product.Partner,
                ProductTitle = product.Title,
                ImageUrl = product.ImageUrl,
                Category = product.Category,
                UnitPrice = product.Price,
                Quantity = qty,
                CashbackPercent = product.CashbackPercent,
                LineTotal = lineTotal,
                CashbackEarned = lineCashback,
            });
            paidPrice += lineTotal;
            cashbackEarned += lineCashback;
        }

        order.PaidPrice = paidPrice;
        order.CashbackEarned = cashbackEarned;
        order.CashbackUsed = req.UseCashback
            ? Math.Min(Math.Round(customer.CashbackBalance, 2), paidPrice)
            : 0m;

        _db.Orders.Add(order);
        await _db.SaveChangesAsync(ct);
        return order.ToDto();
    }

    private IQueryable<Order> OrdersWithItems()
        => _db.Orders
            .Include(o => o.Customer)
            .Include(o => o.Items).ThenInclude(i => i.Partner);

    public async Task<List<OrderDto>> MyOrdersAsync(Guid customerId, string? status, CancellationToken ct)
    {
        var query = OrdersWithItems().Where(o => o.CustomerId == customerId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var st))
            query = query.Where(o => o.Status == st);
        var list = await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        return list.Select(o => o.ToDto()).ToList();
    }

    public async Task<OrderDto> GetMyOrderAsync(Guid customerId, Guid orderId, CancellationToken ct)
    {
        var o = await OrdersWithItems()
            .FirstOrDefaultAsync(x => x.Id == orderId && x.CustomerId == customerId, ct)
            ?? throw new AppException("Pedido não encontrado.", 404);
        return o.ToDto();
    }

    public async Task<List<CashbackEntryDto>> CashbackEntriesAsync(Guid customerId, CancellationToken ct)
    {
        var entries = await _db.CashbackEntries
            .Include(e => e.Order)
            .Where(e => e.UserId == customerId)
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync(ct);
        return entries.Select(e => e.ToDto()).ToList();
    }

    public static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var rnd = Random.Shared;
        return string.Concat(Enumerable.Range(0, 16).Select(_ => chars[rnd.Next(chars.Length)]));
    }
}
