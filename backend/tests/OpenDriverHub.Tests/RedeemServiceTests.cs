using OpenDriverHub.Domain;
using OpenDriverHub.Infrastructure.Services;
using Xunit;

namespace OpenDriverHub.Tests;

public class RedeemServiceTests
{
    [Fact]
    public async Task RedeemAsync_WhenConfirmed_MarksOrderRedeemedAndWritesAudit()
    {
        await using var scope = new TestDb();
        var actorId = Guid.NewGuid();
        var partner = new Partner { Name = "Bistro", Segment = "Food", FeePercent = 10m };
        var customer = new User { Name = "Bia", Email = "bia@example.com" };
        var product = new Product
        {
            Partner = partner,
            Title = "Voucher",
            Description = "Almoco",
            Price = 80m,
            CashbackPercent = 5m,
            Kind = ProductKind.Voucher,
            Category = "Food",
            Stock = 2,
        };
        var order = new Order
        {
            Code = "REDEEM123",
            Product = product,
            Partner = partner,
            Customer = customer,
            ProductId = product.Id,
            PartnerId = partner.Id,
            CustomerId = customer.Id,
            PaidPrice = 80m,
            CashbackEarned = 4m,
            Status = OrderStatus.Paid,
        };
        scope.Db.AddRange(partner, customer, product, order);
        await scope.Db.SaveChangesAsync();
        var service = new PartnerService(scope.Db);

        var result = await service.RedeemAsync(
            partner.Id, actorId, "REDE-EM123", true, CancellationToken.None);

        Assert.True(result.Redeemed);
        Assert.Equal(OrderStatus.Redeemed, order.Status);
        Assert.NotNull(order.RedeemedAt);
        Assert.Equal(1, product.Stock);
        Assert.Contains(scope.Db.AuditLogs, a =>
            a.ActorId == actorId && a.Action == "order.redeem" && a.EntityId == order.Id.ToString());
        Assert.Contains(scope.Db.Notifications, n =>
            n.UserId == customer.Id && n.Title == "Voucher resgatado");
    }
}
