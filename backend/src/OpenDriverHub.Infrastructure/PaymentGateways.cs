using System.Security.Cryptography;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<MercadoPagoGateway> _log;
    public string Provider => "mercadopago";

    public MercadoPagoGateway(ISettingsProvider settings, IHttpClientFactory http,
        ILogger<MercadoPagoGateway> log)
    {
        _settings = settings; _http = http; _log = log;
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
        var rawBody = await resp.Content.ReadAsStringAsync(ct);
        using var doc = JsonDocument.Parse(rawBody);
        var root = doc.RootElement;

        if (!resp.IsSuccessStatusCode)
        {
            _log.LogWarning("Mercado Pago POST /v1/payments falhou — HTTP {Status}: {Body}",
                (int)resp.StatusCode, rawBody);
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

/// <summary>Asaas REAL (api.asaas.com / sandbox). Cria cliente + cobrança,
/// retorna QR PIX e divide o pagamento (split) entre os parceiros que possuem
/// AsaasWalletId — o líquido cai direto na conta deles e a plataforma retém
/// taxa + reserva de cashback. Status via GET /payments/{id} ou webhook.
/// Credenciais resolvidas em runtime via ISettingsProvider (banco sobrepõe .env).</summary>
public class AsaasGateway : IPaymentGateway
{
    private readonly ISettingsProvider _settings;
    private readonly IHttpClientFactory _http;
    private readonly ILogger<AsaasGateway> _log;
    public string Provider => "asaas";

    public AsaasGateway(
        ISettingsProvider settings, IHttpClientFactory http, ILogger<AsaasGateway> log)
    {
        _settings = settings; _http = http; _log = log;
    }

    private async Task<HttpClient> ClientAsync(CancellationToken ct)
    {
        var token = await _settings.GetAsync("Asaas:ApiKey", ct);
        if (string.IsNullOrWhiteSpace(token))
            throw new AppException(
                "Asaas não configurado. Defina a API Key em Admin → Integrações.", 503);

        var env = await _settings.GetAsync("Asaas:Environment", ct);
        var baseUrl = string.Equals(env, "production", StringComparison.OrdinalIgnoreCase)
            ? "https://api.asaas.com/v3/"
            : "https://api-sandbox.asaas.com/v3/";

        var c = _http.CreateClient();
        c.BaseAddress = new Uri(baseUrl);
        // Asaas autentica por header access_token (não Bearer).
        c.DefaultRequestHeaders.Add("access_token", token);
        c.DefaultRequestHeaders.Add("User-Agent", "OpenDriverHub");
        return c;
    }

    // Mapeia status do Asaas → vocabulário interno (approved/rejected/pending).
    private static string MapStatus(string? s) => s switch
    {
        "RECEIVED" or "CONFIRMED" or "RECEIVED_IN_CASH" => "approved",
        "REFUNDED" or "REFUND_REQUESTED" or "REFUND_IN_PROGRESS"
            or "CHARGEBACK_REQUESTED" or "CHARGEBACK_DISPUTE" => "rejected",
        _ => "pending", // PENDING, OVERDUE, AWAITING_RISK_ANALYSIS, ...
    };

    public async Task<PaymentStatusSnapshot> ProcessAsync(
        Order order, decimal amount, PaymentMethod method, CardInput? card,
        CancellationToken ct)
    {
        var client = await ClientAsync(ct);
        var reference = PaymentCodes.Reference(order.Id);

        // 1. Cliente Asaas. Para o MVP/sandbox criamos um cliente por cobrança;
        //    em produção convém cachear o id no User para reaproveitar.
        var customerId = await EnsureCustomerAsync(client, order, ct);

        // 2. Corpo da cobrança (+ split para parceiros com carteira Asaas).
        var splits = BuildSplits(order, amount, _log);
        var body = new Dictionary<string, object?>
        {
            ["customer"] = customerId,
            ["billingType"] = method == PaymentMethod.Pix ? "PIX" : "CREDIT_CARD",
            ["value"] = decimal.Round(amount, 2),
            ["dueDate"] = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            ["externalReference"] = reference,
            ["description"] = order.Product?.Title ?? $"Pedido {order.Code}",
        };
        if (splits.Count > 0) body["split"] = splits;

        if (method != PaymentMethod.Pix)
        {
            // Cartão exige token gerado no front (tokenização PCI-safe), igual ao MP.
            if (card is null || string.IsNullOrWhiteSpace(card.Token))
                throw new AppException(
                    "Pagamento com cartão no Asaas requer o token do cartão (tokenização).",
                    400);
            body["creditCardToken"] = card.Token;
            body["remoteIp"] = "127.0.0.1";
        }

        // 3. Cria a cobrança.
        using var resp = await client.PostAsJsonAsync("payments", body, ct);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var root = doc.RootElement;

        if (!resp.IsSuccessStatusCode)
        {
            var msg = ExtractError(root);
            // Cartão recusado → cancela o pedido; demais erros são falha de gateway.
            if (method != PaymentMethod.Pix)
                return new PaymentStatusSnapshot(
                    order.Id, null, reference, "rejected", msg, null,
                    order.Status.ToString(), null);
            throw new AppException($"Asaas: {msg}", 502);
        }

        var paymentId = root.GetProperty("id").GetString();
        var status = MapStatus(root.TryGetProperty("status", out var st) ? st.GetString() : null);
        var detail = root.TryGetProperty("status", out var st2) ? st2.GetString() : null;

        // 4. PIX: busca o QR (copia-e-cola + imagem pronta).
        PixPayload? pix = null;
        if (method == PaymentMethod.Pix && paymentId is not null)
            pix = await FetchPixAsync(client, paymentId, ct);

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
        using var resp = await client.GetAsync($"payments/{order.ExternalPaymentId}", ct);
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

    private async Task<string> EnsureCustomerAsync(
        HttpClient client, Order order, CancellationToken ct)
    {
        // cpfCnpj: em sandbox o PIX exige CPF/CNPJ no cliente. Permitimos um
        // CPF de teste padrão via setting para o fluxo ser testável ponta a ponta.
        var defaultCpf = await _settings.GetAsync("Asaas:DefaultCpfCnpj", ct);
        var body = new Dictionary<string, object?>
        {
            ["name"] = order.Customer?.Name ?? "Cliente OpenDriverHub",
            ["email"] = order.Customer?.Email,
            ["externalReference"] = order.CustomerId.ToString(),
        };
        if (!string.IsNullOrWhiteSpace(defaultCpf)) body["cpfCnpj"] = defaultCpf;

        using var resp = await client.PostAsJsonAsync("customers", body, ct);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        if (!resp.IsSuccessStatusCode)
            throw new AppException($"Asaas (cliente): {ExtractError(doc.RootElement)}", 502);
        return doc.RootElement.GetProperty("id").GetString()
            ?? throw new AppException("Asaas não retornou o id do cliente.", 502);
    }

    private static async Task<PixPayload?> FetchPixAsync(
        HttpClient client, string paymentId, CancellationToken ct)
    {
        using var resp = await client.GetAsync($"payments/{paymentId}/pixQrCode", ct);
        if (!resp.IsSuccessStatusCode) return null;
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var r = doc.RootElement;
        var payload = r.TryGetProperty("payload", out var p) ? p.GetString() ?? "" : "";
        var image = r.TryGetProperty("encodedImage", out var i) ? i.GetString() : null;
        var exp = r.TryGetProperty("expirationDate", out var e)
            && DateTime.TryParse(e.GetString(), out var dt)
            ? dt : DateTime.UtcNow.AddMinutes(30);
        var imageUrl = string.IsNullOrEmpty(image) ? "" : $"data:image/png;base64,{image}";
        return new PixPayload(payload, payload, imageUrl, exp);
    }

    /// <summary>Monta o split por parceiro (líquido = total − taxa − cashback).
    /// Só inclui parceiros com carteira Asaas. Se a soma exceder o valor cobrado
    /// (ex.: cliente abateu cashback), ignora o split e cai no repasse manual.</summary>
    private static List<object> BuildSplits(Order order, decimal chargeAmount, ILogger log)
    {
        var splits = new List<(string wallet, decimal value)>();
        foreach (var grp in order.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.Partner?.AsaasWalletId))
            .GroupBy(i => i.PartnerId))
        {
            var partner = grp.First().Partner!;
            decimal net = 0m;
            foreach (var it in grp)
            {
                var fee = CommissionRules.PlatformFeeFor(it.LineTotal, partner.FeePercent);
                net += CommissionRules.PartnerNet(it.LineTotal, fee, it.CashbackEarned);
            }
            net = Math.Round(net, 2);
            if (net > 0) splits.Add((partner.AsaasWalletId!, net));
        }

        var sum = splits.Sum(s => s.value);
        if (sum <= 0) return new();
        if (sum > chargeAmount)
        {
            log.LogWarning(
                "Asaas split ignorado: soma {Sum} > cobrado {Charge} (pedido {Order}).",
                sum, chargeAmount, order.Code);
            return new();
        }
        return splits
            .Select(s => (object)new { walletId = s.wallet, fixedValue = s.value })
            .ToList();
    }

    private static string ExtractError(JsonElement root)
    {
        // Asaas erros: { errors: [ { code, description } ] }
        if (root.TryGetProperty("errors", out var errs)
            && errs.ValueKind == JsonValueKind.Array && errs.GetArrayLength() > 0)
        {
            var first = errs[0];
            return first.TryGetProperty("description", out var d)
                ? d.GetString() ?? "erro desconhecido" : "erro desconhecido";
        }
        return "falha na comunicação com o Asaas";
    }
}
