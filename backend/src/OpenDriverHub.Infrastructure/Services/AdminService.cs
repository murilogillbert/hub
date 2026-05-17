using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class AdminService : IAdminService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;
    public AdminService(AppDbContext db, IPasswordHasher hasher)
    {
        _db = db; _hasher = hasher;
    }

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

    public async Task<PagedResult<OrderDto>> SalesAsync(
        Guid? partnerId, string? status, string? q, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.Orders.Include(o => o.Product).Include(o => o.Partner).Include(o => o.Customer)
            .AsQueryable();
        if (partnerId is { } pid) query = query.Where(o => o.PartnerId == pid);
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<OrderStatus>(status, true, out var st))
            query = query.Where(o => o.Status == st);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(o => o.Customer!.Name.Contains(q)
                || o.Product!.Title.Contains(q) || o.Code.Contains(q));
        return await ToPageAsync(query.OrderByDescending(o => o.CreatedAt), page, pageSize,
            o => o.ToDto(), ct);
    }

    public async Task<PagedResult<PartnerDto>> PartnersAsync(int page, int pageSize, CancellationToken ct)
        => await ToPageAsync(_db.Partners.OrderBy(p => p.Name), page, pageSize,
            p => p.ToDto(), ct);

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
            Cnpj = req.Cnpj?.Trim() ?? "",
            City = req.City?.Trim() ?? "",
            State = req.State?.Trim() ?? "",
            Lat = req.Lat ?? 0,
            Lng = req.Lng ?? 0,
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
        if (req.Cnpj is not null) p.Cnpj = req.Cnpj.Trim();
        if (req.City is not null) p.City = req.City.Trim();
        if (req.State is not null) p.State = req.State.Trim();
        if (req.Lat is { } lat) p.Lat = lat;
        if (req.Lng is { } lng) p.Lng = lng;
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

    public async Task<PagedResult<UserDto>> UsersAsync(string? q, int page, int pageSize, CancellationToken ct)
    {
        var query = _db.Users.AsQueryable();
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(u => u.Name.Contains(q) || u.Email.Contains(q));
        return await ToPageAsync(query.OrderBy(u => u.Name), page, pageSize,
            u => u.ToDto(), ct);
    }

    public async Task<UserDto> CreateUserAsync(
        AdminUserCreateRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new AppException("Nome é obrigatório.", 400);
        if (string.IsNullOrWhiteSpace(email))
            throw new AppException("E-mail é obrigatório.", 400);
        if (string.IsNullOrWhiteSpace(req.Password) || req.Password.Length < 6)
            throw new AppException("A senha deve ter pelo menos 6 caracteres.", 400);
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            throw new AppException("E-mail já está em uso.", 409);
        if (!Enum.TryParse<UserRole>(req.Role, true, out var role))
            throw new AppException("Perfil inválido.", 400);

        var partnerId = await ResolvePartnerLinkAsync(role, req.PartnerId, ct);

        var user = new User
        {
            Name = req.Name.Trim(),
            Email = email,
            PasswordHash = _hasher.Hash(req.Password),
            Phone = req.Phone,
            Role = role,
            CashbackBalance = Math.Round(req.CashbackBalance, 2),
            PartnerId = partnerId,
            AvatarUrl = $"https://api.dicebear.com/9.x/avataaars/svg?seed={Uri.EscapeDataString(req.Name)}",
        };
        _db.Users.Add(user);

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "admin.user.create",
            EntityType = "User",
            EntityId = user.Id.ToString(),
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(
                new { user.Email, Role = role.ToString() }),
        });

        await _db.SaveChangesAsync(ct);
        return user.ToDto();
    }

    // Vínculo de parceiro: obrigatório quando o papel é Partner;
    // cliente/admin nunca têm parceiro.
    private async Task<Guid?> ResolvePartnerLinkAsync(
        UserRole role, Guid? partnerId, CancellationToken ct)
    {
        if (role != UserRole.Partner) return null;
        if (partnerId is null)
            throw new AppException(
                "Usuário parceiro precisa estar vinculado a um parceiro.", 400);
        if (!await _db.Partners.AnyAsync(p => p.Id == partnerId, ct))
            throw new AppException("Parceiro vinculado não encontrado.", 404);
        return partnerId;
    }

    public async Task<UserDto> UpdateUserAsync(
        Guid id, AdminUserUpdateRequest req, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([id], ct)
            ?? throw new AppException("Usuário não encontrado.", 404);

        var email = req.Email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new AppException("Nome é obrigatório.", 400);
        if (string.IsNullOrWhiteSpace(email))
            throw new AppException("E-mail é obrigatório.", 400);
        if (await _db.Users.AnyAsync(u => u.Email == email && u.Id != id, ct))
            throw new AppException("E-mail já está em uso.", 409);
        if (!Enum.TryParse<UserRole>(req.Role, true, out var role))
            throw new AppException("Perfil inválido.", 400);

        var partnerId = await ResolvePartnerLinkAsync(role, req.PartnerId, ct);

        user.Name = req.Name.Trim();
        user.Email = email;
        user.Phone = req.Phone;
        user.Role = role;
        user.CashbackBalance = Math.Round(req.CashbackBalance, 2);
        user.PartnerId = partnerId;

        _db.AuditLogs.Add(new AuditLog
        {
            Action = "admin.user.update",
            EntityType = "User",
            EntityId = id.ToString(),
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(
                new { user.Email, Role = role.ToString() }),
        });

        await _db.SaveChangesAsync(ct);
        return user.ToDto();
    }

    public async Task<PagedResult<AuditLogDto>> AuditLogsAsync(
        DateTime? from, DateTime? to, Guid? userId, string? action,
        int page, int pageSize, CancellationToken ct)
    {
        var query = _db.AuditLogs.AsQueryable();
        if (from is { } start) query = query.Where(a => a.CreatedAt >= start);
        if (to is { } end) query = query.Where(a => a.CreatedAt <= end);
        if (userId is { } uid) query = query.Where(a => a.ActorId == uid);
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action.Contains(action));

        var users = _db.Users.Select(u => new { u.Id, u.Name });
        var enriched = query
            .OrderByDescending(a => a.CreatedAt)
            .GroupJoin(users, a => a.ActorId, u => (Guid?)u.Id, (a, actors) => new { Log = a, Actors = actors })
            .SelectMany(x => x.Actors.DefaultIfEmpty(), (x, actor) => new { x.Log, ActorName = actor == null ? null : actor.Name });

        return await ToPageAsync(enriched, page, pageSize,
            x => x.Log.ToDto(x.ActorName), ct);
    }

    private static async Task<PagedResult<TDto>> ToPageAsync<TEntity, TDto>(
        IQueryable<TEntity> query,
        int page,
        int pageSize,
        Func<TEntity, TDto> map,
        CancellationToken ct)
    {
        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 1, 100);
        var total = await query.CountAsync(ct);
        var list = await query
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .ToListAsync(ct);
        var totalPages = total == 0 ? 1 : (int)Math.Ceiling(total / (double)safePageSize);
        return new PagedResult<TDto>(
            list.Select(map).ToList(), total, safePage, safePageSize, totalPages);
    }
}
