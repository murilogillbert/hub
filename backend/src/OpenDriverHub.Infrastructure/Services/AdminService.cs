using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly AppDbContext _db;
    public AdminService(AppDbContext db) => _db = db;

    public async Task<AdminMetricsDto> MetricsAsync(CancellationToken ct)
    {
        var all = await _db.Orders
            .Include(o => o.Partner)
            .Include(o => o.Product)
            .ToListAsync(ct);

        var valid = all.Where(o => o.Status is OrderStatus.Paid or OrderStatus.Redeemed).ToList();
        var gmv = valid.Sum(o => o.PaidPrice);
        var net = valid.Sum(o =>
            CommissionRules.PlatformFeeFor(o.PaidPrice, o.Partner?.FeePercent ?? 10m)
            - o.CashbackEarned);

        var customers = await _db.Users.CountAsync(u => u.Role == UserRole.Client, ct);
        var partnersTotal = await _db.Partners.CountAsync(ct);
        var partnersActive = await _db.Partners.CountAsync(p => p.Active, ct);
        var cashbackOutstanding = await _db.Users
            .Where(u => u.Role == UserRole.Client)
            .SumAsync(u => u.CashbackBalance, ct);

        var today = DateTime.UtcNow.Date;
        var since30 = DateTime.UtcNow.AddDays(-30);
        var ordersToday = all.Count(o => o.CreatedAt.Date == today);
        var newCustomers30 = await _db.Users
            .CountAsync(u => u.Role == UserRole.Client && u.CreatedAt >= since30, ct);

        var pendingCount = all.Count(o => o.Status == OrderStatus.PendingPayment);
        var paidCount = all.Count(o => o.Status == OrderStatus.Paid);
        var redeemedCount = all.Count(o => o.Status == OrderStatus.Redeemed);
        var cancelledCount = all.Count(o => o.Status == OrderStatus.Cancelled);

        var paymentDenom = paidCount + redeemedCount + cancelledCount;
        var paymentConversion = paymentDenom > 0
            ? Math.Round(100m * (paidCount + redeemedCount) / paymentDenom, 1)
            : 0m;
        var redemptionRate = paidCount + redeemedCount > 0
            ? Math.Round(100m * redeemedCount / (paidCount + redeemedCount), 1)
            : 0m;
        var avgTicket = valid.Count > 0 ? Math.Round(gmv / valid.Count, 2) : 0m;

        var byMonth = valid.GroupBy(o => new { o.CreatedAt.Year, o.CreatedAt.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .Select(g => new SeriesPoint(
                new DateTime(g.Key.Year, g.Key.Month, 1).ToString("MMM/yy"),
                g.Sum(o => o.PaidPrice))).ToList();

        var top = valid.GroupBy(o => new { o.PartnerId, Name = o.Partner?.Name ?? "" })
            .Select(g => new TopPartner(g.Key.PartnerId, g.Key.Name, g.Sum(o => o.PaidPrice)))
            .OrderByDescending(t => t.Revenue).Take(5).ToList();

        var byCategory = valid
            .GroupBy(o => o.Product?.Category ?? "—")
            .Select(g => new NamedValue(g.Key, g.Sum(o => o.PaidPrice), g.Count()))
            .OrderByDescending(n => n.Value).ToList();

        var byMethod = valid
            .GroupBy(o => o.PaymentMethod switch
            {
                PaymentMethod.Pix => "Pix",
                PaymentMethod.CreditCard => "Crédito",
                PaymentMethod.DebitCard => "Débito",
                _ => "Outro",
            })
            .Select(g => new NamedValue(g.Key, g.Sum(o => o.PaidPrice), g.Count()))
            .OrderByDescending(n => n.Value).ToList();

        var leads = await _db.Leads.ToListAsync(ct);
        var leadsByTemp = new[]
            {
                (LeadTemperature.Quente, "Quente"),
                (LeadTemperature.Morno, "Morno"),
                (LeadTemperature.Frio, "Frio"),
            }
            .Select(t => new NamedValue(
                t.Item2,
                leads.Where(l => l.Temperature == t.Item1).Sum(l => (decimal)l.Score),
                leads.Count(l => l.Temperature == t.Item1)))
            .ToList();

        return new AdminMetricsDto(
            Math.Round(gmv, 2), Math.Round(net, 2), customers,
            partnersTotal, partnersActive, ordersToday,
            avgTicket, Math.Round(cashbackOutstanding, 2), newCustomers30,
            pendingCount, paidCount, redeemedCount, cancelledCount,
            paymentConversion, redemptionRate,
            byMonth, top, byCategory, byMethod, leadsByTemp);
    }

    public async Task<List<OrderDto>> SalesAsync(Guid? partnerId, string? status, string? q, CancellationToken ct)
    {
        var query = _db.Orders.Include(o => o.Product).Include(o => o.Partner).Include(o => o.Customer)
            .AsQueryable();
        if (partnerId is { } pid) query = query.Where(o => o.PartnerId == pid);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var st))
            query = query.Where(o => o.Status == st);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(o => o.Customer!.Name.Contains(q)
                || o.Product!.Title.Contains(q) || o.Code.Contains(q));
        var list = await query.OrderByDescending(o => o.CreatedAt).Take(300).ToListAsync(ct);
        return list.Select(o => o.ToDto()).ToList();
    }

    public async Task<List<PartnerDto>> PartnersAsync(CancellationToken ct)
        => (await _db.Partners.OrderBy(p => p.Name).ToListAsync(ct))
            .Select(p => p.ToDto()).ToList();

    public async Task<PartnerDto> CreatePartnerAsync(PartnerUpsertRequest req, CancellationToken ct)
    {
        var p = new Partner
        {
            Name = req.Name,
            Segment = req.Segment,
            LogoUrl = string.IsNullOrWhiteSpace(req.LogoUrl)
                ? $"https://api.dicebear.com/9.x/icons/svg?seed={Uri.EscapeDataString(req.Name)}"
                : req.LogoUrl,
            FeePercent = req.FeePercent,
            Active = req.Active,
        };
        _db.Partners.Add(p);
        await _db.SaveChangesAsync(ct);
        return p.ToDto();
    }

    public async Task<PartnerDto> UpdatePartnerAsync(Guid id, PartnerUpsertRequest req, CancellationToken ct)
    {
        var p = await _db.Partners.FindAsync([id], ct)
            ?? throw new AppException("Parceiro não encontrado.", 404);
        p.Name = req.Name;
        p.Segment = req.Segment;
        p.LogoUrl = req.LogoUrl;
        p.FeePercent = req.FeePercent;
        p.Active = req.Active;
        await _db.SaveChangesAsync(ct);
        return p.ToDto();
    }

    public async Task DeletePartnerAsync(Guid id, CancellationToken ct)
    {
        var p = await _db.Partners.FindAsync([id], ct)
            ?? throw new AppException("Parceiro não encontrado.", 404);
        p.Active = false;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<UserDto>> UsersAsync(string? q, CancellationToken ct)
    {
        var query = _db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(u => u.Name.Contains(q) || u.Email.Contains(q));
        var list = await query.OrderBy(u => u.Name).Take(300).ToListAsync(ct);
        return list.Select(u => u.ToDto()).ToList();
    }
}
