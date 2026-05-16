using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class PaymentService : IPaymentService
{
    private readonly AppDbContext _db;
    private readonly IPaymentGateway _gateway;

    public PaymentService(AppDbContext db, IPaymentGateway gateway)
    {
        _db = db; _gateway = gateway;
    }

    public async Task<PaymentStatusSnapshot> ProcessAsync(Guid customerId, ProcessPaymentRequest req, CancellationToken ct)
    {
        var order = await _db.Orders.Include(o => o.Product)
            .FirstOrDefaultAsync(o => o.Id == req.OrderId && o.CustomerId == customerId, ct)
            ?? throw new AppException("Pedido não encontrado.", 404);
        if (order.Status != OrderStatus.PendingPayment)
            throw new AppException("Pedido não está aguardando pagamento.", 409);

        var method = Mappings.ParseMethod(req.Method);
        order.PaymentMethod = method;
        var snap = await _gateway.ProcessAsync(order, method, req.Card, ct);

        order.PaymentReference = snap.PaymentReference;
        order.ExternalPaymentId = snap.PaymentId;

        _db.Payments.Add(new PaymentTransaction
        {
            OrderId = order.Id,
            Provider = _gateway.Provider,
            ExternalReference = snap.PaymentReference,
            ExternalPaymentId = snap.PaymentId,
            Method = method,
            Amount = order.PaidPrice,
            Status = ParseStatus(snap.PaymentStatus),
            StatusDetail = snap.StatusDetail,
            LastSyncedAt = DateTime.UtcNow,
        });

        if (snap.PaymentStatus == "approved")
            await ApproveAsync(order, snap.VoucherCode, ct);
        else if (snap.PaymentStatus is "rejected" or "cancelled")
            order.Status = OrderStatus.Cancelled;

        await _db.SaveChangesAsync(ct);
        return snap with { OrderStatus = order.Status.ToString() };
    }

    public async Task<PaymentStatusSnapshot> StatusAsync(Guid orderId, CancellationToken ct)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct)
            ?? throw new AppException("Pedido não encontrado.", 404);

        if (order.Status == OrderStatus.PendingPayment)
        {
            var sync = await _gateway.SyncAsync(order, ct);
            if (sync is { PaymentStatus: "approved" })
            {
                await ApproveAsync(order, sync.VoucherCode, ct);
                await _db.SaveChangesAsync(ct);
            }
        }

        return new PaymentStatusSnapshot(
            order.Id, order.ExternalPaymentId, order.PaymentReference,
            order.Status == OrderStatus.Paid ? "approved"
                : order.Status == OrderStatus.Cancelled ? "cancelled" : "pending",
            null, order.VoucherCode, order.Status.ToString(), null);
    }

    public async Task ReconcilePendingAsync(CancellationToken ct)
    {
        var pending = await _db.Orders
            .Where(o => o.Status == OrderStatus.PendingPayment && o.PaymentMethod == PaymentMethod.Pix)
            .ToListAsync(ct);
        foreach (var order in pending)
        {
            var sync = await _gateway.SyncAsync(order, ct);
            if (sync is { PaymentStatus: "approved" })
                await ApproveAsync(order, sync.VoucherCode, ct);
        }
        if (pending.Count > 0) await _db.SaveChangesAsync(ct);
    }

    public async Task<string> ReconcileByExternalAsync(
        string externalId, string eventType, string? rawPayload, CancellationToken ct)
    {
        var order = await _db.Orders.FirstOrDefaultAsync(
            o => o.ExternalPaymentId == externalId || o.PaymentReference == externalId, ct);

        var status = "ignored";
        if (order is not null)
        {
            if (order.Status == OrderStatus.PendingPayment)
            {
                var sync = await _gateway.SyncAsync(order, ct);
                if (sync is { PaymentStatus: "approved" })
                {
                    await ApproveAsync(order, sync.VoucherCode, ct);
                    status = "approved";
                }
                else
                {
                    status = "pending";
                }
            }
            else
            {
                // Já processado anteriormente → idempotente, sem efeito colateral.
                status = order.Status.ToString().ToLowerInvariant();
            }
        }

        _db.PaymentEvents.Add(new PaymentEvent
        {
            Provider = "mercado_pago",
            EventType = eventType,
            ExternalId = externalId,
            OrderId = order?.Id,
            Status = status,
            RawPayload = rawPayload,
        });
        await _db.SaveChangesAsync(ct);
        return status;
    }

    private async Task ApproveAsync(Order order, string? voucher, CancellationToken ct)
    {
        if (order.Status == OrderStatus.Paid) return;
        order.Status = OrderStatus.Paid;
        order.PaidAt = DateTime.UtcNow;
        order.VoucherCode ??= voucher ?? PaymentCodes.Voucher();
        _db.Notifications.Add(new Notification
        {
            UserId = order.CustomerId,
            Title = "Pagamento confirmado",
            Message = $"Seu voucher do pedido {order.Code} está liberado.",
        });
        await Task.CompletedTask;
    }

    private static PaymentStatus ParseStatus(string s) => s switch
    {
        "approved" => PaymentStatus.Approved,
        "rejected" => PaymentStatus.Rejected,
        "cancelled" => PaymentStatus.Cancelled,
        "refunded" => PaymentStatus.Refunded,
        _ => PaymentStatus.Pending,
    };
}
