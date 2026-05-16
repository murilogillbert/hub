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
        var product = await _db.Products.Include(p => p.Partner)
            .FirstOrDefaultAsync(p => p.Id == req.ProductId, ct)
            ?? throw new AppException("Produto não encontrado.", 404);
        if (product.Stock <= 0) throw new AppException("Produto sem estoque.", 409);

        var customer = await _db.Users.FindAsync([customerId], ct)
            ?? throw new AppException("Usuário não encontrado.", 401);

        // Cliente pode abater o saldo de cashback no valor a pagar.
        var cashbackUsed = req.UseCashback
            ? Math.Min(Math.Round(customer.CashbackBalance, 2), product.Price)
            : 0m;

        var order = new Order
        {
            Code = GenerateCode(),
            ProductId = product.Id,
            PartnerId = product.PartnerId,
            CustomerId = customerId,
            PaidPrice = product.Price,
            CashbackUsed = cashbackUsed,
            CashbackEarned = CommissionRules.CashbackFor(product.Price, product.CashbackPercent),
            Status = OrderStatus.PendingPayment,
        };
        order.Product = product;
        order.Partner = product.Partner;
        order.Customer = customer;
        _db.Orders.Add(order);
        await _db.SaveChangesAsync(ct);
        return order.ToDto();
    }

    public async Task<List<OrderDto>> MyOrdersAsync(Guid customerId, string? status, CancellationToken ct)
    {
        var query = _db.Orders.Include(o => o.Product).Include(o => o.Partner).Include(o => o.Customer)
            .Where(o => o.CustomerId == customerId);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var st))
            query = query.Where(o => o.Status == st);
        var list = await query.OrderByDescending(o => o.CreatedAt).ToListAsync(ct);
        return list.Select(o => o.ToDto()).ToList();
    }

    public async Task<OrderDto> GetMyOrderAsync(Guid customerId, Guid orderId, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Product).Include(x => x.Partner).Include(x => x.Customer)
            .FirstOrDefaultAsync(x => x.Id == orderId && x.CustomerId == customerId, ct)
            ?? throw new AppException("Pedido não encontrado.", 404);
        return o.ToDto();
    }

    public static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var rnd = Random.Shared;
        return string.Concat(Enumerable.Range(0, 16).Select(_ => chars[rnd.Next(chars.Length)]));
    }
}
