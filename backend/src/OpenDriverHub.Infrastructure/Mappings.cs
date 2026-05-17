using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure;

public static class Mappings
{
    public static UserDto ToDto(this User u) => new(
        u.Id, u.Name, u.Email, u.Role.ToString().ToLowerInvariant(),
        u.CashbackBalance, u.AvatarUrl, u.PartnerId, u.Phone);

    public static ProductDto ToDto(
        this Product p,
        List<string>? cities = null,
        List<string>? states = null) => new(
        p.Id, p.PartnerId, p.Partner?.Name ?? "", p.Title, p.Description,
        p.Price, p.CashbackPercent, p.Kind.ToString().ToLowerInvariant(),
        p.ImageUrl, p.Category, p.Rating, p.Stock,
        p.Kind == ProductKind.Digital,
        cities ?? new(), states ?? new());

    public static PartnerDto ToDto(this Partner p) => new(
        p.Id, p.Name, p.Segment, p.LogoUrl, p.Active, p.FeePercent, p.JoinedAt,
        p.Cnpj, p.City, p.State, p.Lat, p.Lng);

    public static StoreDto ToDto(this PartnerStore s) => new(
        s.Id, s.PartnerId, s.Name, s.Address, s.City, s.State, s.Lat, s.Lng, s.Category);

    public static CategoryDto ToDto(this Category c) =>
        new(c.Id, c.Name, c.Type.ToString().ToLowerInvariant(), c.Active);

    public static NotificationDto ToDto(this Notification n) => new(
        n.Id, n.Title, n.Message, n.Channel, n.ReadAt is not null, n.CreatedAt);

    public static AuditLogDto ToDto(this AuditLog a, string? actorName = null) => new(
        a.Id, a.ActorId, actorName, a.Action, a.EntityType, a.EntityId,
        a.PayloadJson, a.CreatedAt);

    public static CashbackEntryDto ToDto(this CashbackEntry e) => new(
        e.Id,
        e.Type == CashbackEntryType.Earned ? "earned" : "used",
        e.Amount,
        e.OrderId,
        e.Order?.Code,
        e.Description,
        e.CreatedAt);

    public static CategoryType ParseCategoryType(string? s) =>
        string.Equals(s, "store", StringComparison.OrdinalIgnoreCase)
            ? CategoryType.Store
            : CategoryType.Product;

    public static OrderDto ToDto(this Order o) => new(
        o.Id, o.Code, o.ProductId, o.Product?.Title ?? "", o.PartnerId,
        o.Partner?.Name ?? "", o.CustomerId, o.Customer?.Name ?? "",
        o.PaidPrice, o.CashbackEarned, o.CashbackUsed,
        o.Status switch
        {
            OrderStatus.PendingPayment => "pending",
            OrderStatus.Paid => "paid",
            OrderStatus.Redeemed => "redeemed",
            _ => "cancelled",
        },
        o.CreatedAt, o.RedeemedAt);

    public static ProductKind ParseKind(string s) => s.ToLowerInvariant() switch
    {
        "digital" => ProductKind.Digital,
        "physical" => ProductKind.Physical,
        _ => ProductKind.Voucher,
    };

    public static PaymentMethod ParseMethod(string s) => s.ToLowerInvariant() switch
    {
        "credit_card" or "credit" => PaymentMethod.CreditCard,
        "debit_card" or "debit" => PaymentMethod.DebitCard,
        _ => PaymentMethod.Pix,
    };
}
