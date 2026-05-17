using OpenDriverHub.Application;
using OpenDriverHub.Domain;
using OpenDriverHub.Infrastructure.Services;
using Xunit;

namespace OpenDriverHub.Tests;

public class PaymentServiceTests
{
    [Fact]
    public async Task ProcessAsync_ApprovedPayment_UpdatesCashbackAndLedger()
    {
        await using var scope = new TestDb();
        var partner = new Partner { Name = "Cafe", Segment = "Food", Active = true };
        var customer = new User
        {
            Name = "Ana",
            Email = "ana@example.com",
            CashbackBalance = 20m,
        };
        var product = new Product
        {
            Partner = partner,
            Title = "Combo",
            Description = "Cafe",
            Price = 50m,
            CashbackPercent = 10m,
            Kind = ProductKind.Voucher,
            Category = "Food",
            Stock = 10,
        };
        var order = new Order
        {
            Code = "ABC123",
            Product = product,
            Partner = partner,
            Customer = customer,
            ProductId = product.Id,
            PartnerId = partner.Id,
            CustomerId = customer.Id,
            PaidPrice = 50m,
            CashbackUsed = 15m,
            CashbackEarned = 5m,
            Status = OrderStatus.PendingPayment,
        };
        scope.Db.AddRange(partner, customer, product, order);
        await scope.Db.SaveChangesAsync();

        var service = new PaymentService(scope.Db, new ApprovedGateway());

        var snapshot = await service.ProcessAsync(
            customer.Id,
            new ProcessPaymentRequest(order.Id, "pix", null),
            CancellationToken.None);

        Assert.Equal("approved", snapshot.PaymentStatus);
        Assert.Equal(OrderStatus.Paid, order.Status);
        Assert.Equal(10m, customer.CashbackBalance);
        Assert.Equal(2, scope.Db.CashbackEntries.Count());
        Assert.Contains(scope.Db.CashbackEntries, e =>
            e.Type == CashbackEntryType.Used && e.Amount == 15m);
        Assert.Contains(scope.Db.CashbackEntries, e =>
            e.Type == CashbackEntryType.Earned && e.Amount == 5m);
    }

    private sealed class ApprovedGateway : IPaymentGateway
    {
        public string Provider => "test";

        public Task<PaymentStatusSnapshot> ProcessAsync(
            Order order, decimal amount, PaymentMethod method, CardInput? card,
            CancellationToken ct)
            => Task.FromResult(new PaymentStatusSnapshot(
                order.Id, "pay_1", "ref_1", "approved", null, "VOUCHER", "pending", null));

        public Task<PaymentStatusSnapshot?> SyncAsync(Order order, CancellationToken ct)
            => Task.FromResult<PaymentStatusSnapshot?>(null);
    }
}
