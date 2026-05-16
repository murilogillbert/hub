using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure;

public static class Mappings
{
    public static UserDto ToDto(this User u) => new(
        u.Id, u.Name, u.Email, u.Role.ToString().ToLowerInvariant(),
        u.CashbackBalance, u.AvatarUrl, u.PartnerId);

    public static ProductDto ToDto(this Product p) => new(
        p.Id, p.PartnerId, p.Partner?.Name ?? "", p.Title, p.Description,
        p.Price, p.CashbackPercent, p.Kind.ToString().ToLowerInvariant(),
        p.ImageUrl, p.Category, p.Rating, p.Stock);

    public static PartnerDto ToDto(this Partner p) => new(
        p.Id, p.Name, p.Segment, p.LogoUrl, p.Active, p.FeePercent, p.JoinedAt);

    public static StoreDto ToDto(this PartnerStore s) => new(
        s.Id, s.PartnerId, s.Name, s.Address, s.Lat, s.Lng, s.Category);

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
