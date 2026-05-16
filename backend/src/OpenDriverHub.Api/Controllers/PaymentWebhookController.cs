using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDriverHub.Application;

namespace OpenDriverHub.Api.Controllers;

/// <summary>
/// Webhook do Mercado Pago com verificação de assinatura HMAC-SHA256
/// (espelha o paymentWebhooks.ts do Opendriver). Público (server-to-server),
/// sem CORS/JWT. O segredo vem de Admin → Integrações (settings, sobrepõe .env).
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/v1/payments/webhook")]
public class PaymentWebhookController : ControllerBase
{
    private readonly ISettingsProvider _settings;
    private readonly IPaymentService _payments;
    private readonly IConfiguration _cfg;
    private readonly ILogger<PaymentWebhookController> _log;

    public PaymentWebhookController(
        ISettingsProvider settings,
        IPaymentService payments,
        IConfiguration cfg,
        ILogger<PaymentWebhookController> log)
    {
        _settings = settings; _payments = payments; _cfg = cfg; _log = log;
    }

    [HttpPost("mercadopago")]
    public async Task<IActionResult> MercadoPago(
        [FromQuery(Name = "data.id")] string? dataId,
        [FromQuery] string? id,
        [FromQuery] string? type,
        CancellationToken ct)
    {
        var paymentId = dataId ?? id;
        var eventType = type ?? "payment";
        if (string.IsNullOrWhiteSpace(paymentId))
            return BadRequest(new { error = "missing_data_id" });

        var secret = await _settings.GetAsync("MercadoPago:WebhookSecret", ct);
        var requireSig =
            !bool.TryParse(_cfg["Payment:WebhookRequireSignature"], out var rs) || rs;
        var toleranceSec =
            int.TryParse(_cfg["Payment:WebhookToleranceSeconds"], out var t) ? t : 300;

        if (string.IsNullOrWhiteSpace(secret))
        {
            if (requireSig)
            {
                _log.LogWarning("Webhook MP recebido sem secret configurado.");
                return StatusCode(503, new { error = "webhook_secret_not_configured" });
            }
            _log.LogWarning("Webhook MP aceito SEM verificação (dev: secret ausente).");
            return await ReconcileAsync(paymentId, eventType, ct);
        }

        var signature = Request.Headers["x-signature"].ToString();
        var requestId = Request.Headers["x-request-id"].ToString();
        var check = VerifySignature(signature, requestId, paymentId, secret, toleranceSec);
        if (!check.ok)
        {
            _log.LogWarning("Assinatura de webhook MP inválida: {Reason}", check.reason);
            return Unauthorized(new { error = check.reason });
        }

        return await ReconcileAsync(paymentId, eventType, ct);
    }

    private async Task<IActionResult> ReconcileAsync(
        string paymentId, string eventType, CancellationToken ct)
    {
        var status = await _payments.ReconcileByExternalAsync(
            paymentId, eventType, null, ct);
        return Ok(new { received = true, status });
    }

    private static (bool ok, string reason) VerifySignature(
        string signatureHeader, string requestId, string dataId,
        string secret, int toleranceSeconds)
    {
        if (string.IsNullOrWhiteSpace(signatureHeader))
            return (false, "missing_signature");

        // Formato: "ts=1700000000,v1=hexhmac"
        string? ts = null, v1 = null;
        foreach (var part in signatureHeader.Split(','))
        {
            var kv = part.Split('=', 2);
            if (kv.Length != 2) continue;
            var k = kv[0].Trim();
            var val = kv[1].Trim();
            if (k == "ts") ts = val;
            else if (k == "v1") v1 = val;
        }
        if (ts is null || v1 is null)
            return (false, "malformed_signature_header");

        if (!long.TryParse(ts, out var tsSeconds))
            return (false, "invalid_signature_timestamp");
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (Math.Abs(now - tsSeconds) > toleranceSeconds)
            return (false, "signature_timestamp_out_of_range");

        // Manifest oficial do Mercado Pago.
        var manifest = $"id:{dataId};request-id:{requestId};ts:{ts};";
        var expected = Convert.ToHexString(
                new HMACSHA256(Encoding.UTF8.GetBytes(secret))
                    .ComputeHash(Encoding.UTF8.GetBytes(manifest)))
            .ToLowerInvariant();

        var match = CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(v1.ToLowerInvariant()));
        return match ? (true, "ok") : (false, "signature_mismatch");
    }
}
