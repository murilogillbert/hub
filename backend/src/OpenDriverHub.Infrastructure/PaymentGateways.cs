using System.Security.Cryptography;
using System.Net.Http.Json;
using System.Text.Json;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure;

public static class PaymentCodes
{
    public static string Hex(int n) => Convert.ToHexString(RandomNumberGenerator.GetBytes(n));
    public static string Reference(Guid orderId) => $"DH-{orderId:N}-{Hex(4)}";
    public static string Voucher() => $"OD-{Hex(4)}";
}

/// <summary>Gateway local (default). PIX confirma sozinho após a janela mínima de exibição.</summary>
public class MockPaymentGateway : IPaymentGateway
{
    public string Provider => "mock";
    private const string RejectedTestCard = "5031433215406351";

    public Task<PaymentStatusSnapshot> ProcessAsync(Order order, decimal amount, PaymentMethod method, CardInput? card, CancellationToken ct)
    {
        var reference = PaymentCodes.Reference(order.Id);
        var paymentId = PaymentCodes.Hex(6);

        if (method == PaymentMethod.Pix)
        {
            var pix = new PixPayload(
                reference,
                $"00020126580014BR.GOV.BCB.PIX0136{reference}5204000053039865406{amount:0.00}5802BR5921OPENDRIVERHUB LTDA6009SAO PAULO62070503***6304{PaymentCodes.Hex(2)}",
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
        // PIX pendente confirma após 5 minutos para manter o QR disponível no checkout.
        if (order.PaymentMethod == PaymentMethod.Pix
            && order.Status == OrderStatus.PendingPayment
            && DateTime.UtcNow - order.CreatedAt > TimeSpan.FromMinutes(5))
        {
            return Task.FromResult<PaymentStatusSnapshot?>(new PaymentStatusSnapshot(
                order.Id, order.ExternalPaymentId, order.PaymentReference,
                "approved", "accredited", order.VoucherCode ?? PaymentCodes.Voucher(),
                OrderStatus.Paid.ToString(), null));
        }
        return Task.FromResult<PaymentStatusSnapshot?>(null);
    }
}

/// <summary>Mercado Pago REAL (api.mercadopago.com). Access token resolvido em
/// runtime via ISettingsProvider (banco sobrepõe .env). PIX cria cobrança e
/// retorna QR/copia-e-cola; cartão usa token gerado no front (SDK MP.js).</summary>
public class MercadoPagoGateway : IPaymentGateway
{
    private readonly ISettingsProvider _settings;
    private readonly IHttpClientFactory _http;
    public string Provider => "mercadopago";

    public MercadoPagoGateway(ISettingsProvider settings, IHttpClientFactory http)
    {
        _settings = settings; _http = http;
    }

    private async Task<HttpClient> ClientAsync(CancellationToken ct)
    {
        var token = await _settings.GetAsync("MercadoPago:AccessToken", ct);
        if (string.IsNullOrWhiteSpace(token))
            throw new AppException(
                "Mercado Pago não configurado. Defina o Access Token em Admin → Integrações.",
                503);
        var c = _http.CreateClient();
        c.BaseAddress = new Uri("https://api.mercadopago.com/");
        c.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return c;
    }

    private static string MapStatus(string? s) => s switch
    {
        "approved" => "approved",
        "rejected" or "cancelled" => "rejected",
        "refunded" or "charged_back" => "rejected",
        _ => "pending",
    };

    public async Task<PaymentStatusSnapshot> ProcessAsync(
        Order order, decimal amount, PaymentMethod method, CardInput? card,
        CancellationToken ct)
    {
        var client = await ClientAsync(ct);
        var reference = PaymentCodes.Reference(order.Id);
        var payerEmail = order.Customer?.Email ?? "comprador@opendriverhub.com";

        object body;
        if (method == PaymentMethod.Pix)
        {
            body = new
            {
                transaction_amount = decimal.Round(amount, 2),
                description = order.Product?.Title ?? $"Pedido {order.Code}",
                payment_method_id = "pix",
                external_reference = reference,
                payer = new { email = payerEmail },
            };
        }
        else
        {
            if (card is null || string.IsNullOrWhiteSpace(card.Token))
                throw new AppException(
                    "Pagamento com cartão requer o token do cartão (SDK Mercado Pago).",
                    400);
            body = new
            {
                transaction_amount = decimal.Round(amount, 2),
                token = card.Token,
                description = order.Product?.Title ?? $"Pedido {order.Code}",
                installments = card.Installments ?? 1,
                payment_method_id = card.PaymentMethodId,
                external_reference = reference,
                payer = new { email = payerEmail },
            };
        }

        using var req = new HttpRequestMessage(HttpMethod.Post, "v1/payments");
        req.Headers.Add("X-Idempotency-Key", Guid.NewGuid().ToString());
        req.Content = JsonContent.Create(body);
        using var resp = await client.SendAsync(req, ct);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;

        if (!resp.IsSuccessStatusCode)
        {
            var msg = root.TryGetProperty("message", out var m)
                ? m.GetString() : "Falha no Mercado Pago.";
            throw new AppException($"Mercado Pago: {msg}", 502);
        }

        var paymentId = root.GetProperty("id").ToString();
        var status = MapStatus(root.TryGetProperty("status", out var st) ? st.GetString() : null);
        var detail = root.TryGetProperty("status_detail", out var sd) ? sd.GetString() : null;

        PixPayload? pix = null;
        if (method == PaymentMethod.Pix &&
            root.TryGetProperty("point_of_interaction", out var poi) &&
            poi.TryGetProperty("transaction_data", out var td))
        {
            var qr = td.TryGetProperty("qr_code", out var q) ? q.GetString() ?? "" : "";
            var ticket = td.TryGetProperty("ticket_url", out var tu) ? tu.GetString() ?? "" : "";
            pix = new PixPayload(qr, qr, ticket, DateTime.UtcNow.AddMinutes(30));
        }

        var voucher = status == "approved" ? PaymentCodes.Voucher() : null;
        return new PaymentStatusSnapshot(
            order.Id, paymentId, reference, status, detail, voucher,
            order.Status.ToString(), pix);
    }

    public async Task<PaymentStatusSnapshot?> SyncAsync(Order order, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(order.ExternalPaymentId)
            || order.Status != OrderStatus.PendingPayment)
            return null;

        var client = await ClientAsync(ct);
        using var resp = await client.GetAsync($"v1/payments/{order.ExternalPaymentId}", ct);
        if (!resp.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var status = MapStatus(
            doc.RootElement.TryGetProperty("status", out var st) ? st.GetString() : null);
        if (status != "approved") return null;

        return new PaymentStatusSnapshot(
            order.Id, order.ExternalPaymentId, order.PaymentReference,
            "approved", "accredited", order.VoucherCode ?? PaymentCodes.Voucher(),
            OrderStatus.Paid.ToString(), null);
    }
}
