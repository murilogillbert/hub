using System.Security.Cryptography;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure;

public static class PaymentCodes
{
    public static string Hex(int n) => Convert.ToHexString(RandomNumberGenerator.GetBytes(n));
    public static string Reference(Guid orderId) => $"DH-{orderId:N}-{Hex(4)}";
    public static string Voucher() => $"OD-{Hex(4)}";
}

/// <summary>Gateway local (default). PIX confirma sozinho via reconciliação (~8s).</summary>
public class MockPaymentGateway : IPaymentGateway
{
    public string Provider => "mock";
    private const string RejectedTestCard = "5031433215406351";

    public Task<PaymentStatusSnapshot> ProcessAsync(Order order, PaymentMethod method, CardInput? card, CancellationToken ct)
    {
        var reference = PaymentCodes.Reference(order.Id);
        var paymentId = PaymentCodes.Hex(6);

        if (method == PaymentMethod.Pix)
        {
            var pix = new PixPayload(
                reference,
                $"00020126580014BR.GOV.BCB.PIX0136{reference}5204000053039865406{order.PaidPrice:0.00}5802BR5921OPENDRIVERHUB LTDA6009SAO PAULO62070503***6304{PaymentCodes.Hex(2)}",
                $"https://mock.local/pix/{paymentId}",
                DateTime.UtcNow.AddMinutes(30));
            return Task.FromResult(new PaymentStatusSnapshot(
                order.Id, paymentId, reference, "pending", "pending_waiting_transfer",
                null, order.Status.ToString(), pix));
        }

        var rejected = card?.Number.Replace(" ", "") == RejectedTestCard;
        return Task.FromResult(new PaymentStatusSnapshot(
            order.Id, paymentId, reference,
            rejected ? "rejected" : "approved",
            rejected ? "cc_rejected_other_reason" : "accredited",
            rejected ? null : PaymentCodes.Voucher(),
            order.Status.ToString(), null));
    }

    public Task<PaymentStatusSnapshot?> SyncAsync(Order order, CancellationToken ct)
    {
        // PIX pendente confirma após 8s da criação (simula webhook do banco).
        if (order.PaymentMethod == PaymentMethod.Pix
            && order.Status == OrderStatus.PendingPayment
            && DateTime.UtcNow - order.CreatedAt > TimeSpan.FromSeconds(8))
        {
            return Task.FromResult<PaymentStatusSnapshot?>(new PaymentStatusSnapshot(
                order.Id, order.ExternalPaymentId, order.PaymentReference,
                "approved", "accredited", order.VoucherCode ?? PaymentCodes.Voucher(),
                OrderStatus.Paid.ToString(), null));
        }
        return Task.FromResult<PaymentStatusSnapshot?>(null);
    }
}

/// <summary>Mercado Pago sandbox — ativado por Payment:Provider=mercadopago.
/// O access token é resolvido em runtime via ISettingsProvider (banco
/// sobrepõe .env). Sem token configurado, recusa o pagamento.
/// A chamada HTTP real fica como TODO de produção.</summary>
public class MercadoPagoGateway : IPaymentGateway
{
    private readonly MockPaymentGateway _fallback = new();
    private readonly ISettingsProvider _settings;
    public string Provider => "mercadopago";

    public MercadoPagoGateway(ISettingsProvider settings) => _settings = settings;

    public async Task<PaymentStatusSnapshot> ProcessAsync(Order order, PaymentMethod method, CardInput? card, CancellationToken ct)
    {
        var token = await _settings.GetAsync("MercadoPago:AccessToken", ct);
        if (string.IsNullOrWhiteSpace(token))
            throw new AppException(
                "Mercado Pago não configurado. Defina o Access Token em Admin → Integrações.",
                503);
        return await _fallback.ProcessAsync(order, method, card, ct);
    }

    public Task<PaymentStatusSnapshot?> SyncAsync(Order order, CancellationToken ct)
        => _fallback.SyncAsync(order, ct);
}
