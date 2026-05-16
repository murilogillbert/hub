using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

/// <summary>
/// Settings de integração. Banco sobrepõe .env/appsettings; valor vazio
/// remove a customização e volta a usar o .env. Segredos são mascarados na leitura.
/// </summary>
public class SettingsService : ISettingsService, ISettingsProvider
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public SettingsService(AppDbContext db, IConfiguration config)
    {
        _db = db; _config = config;
    }

    private record Field(string Key, string Label, bool Secret);
    private record Group(string Id, string Name, string Description, string Icon, Field[] Fields);

    private static readonly Group[] Catalog =
    [
        new("whatsapp", "WhatsApp Business",
            "Envia confirmação de compra, código do voucher e lembretes de resgate.",
            "💬",
            [
                new("WhatsApp:Token", "Token da API", true),
                new("WhatsApp:PhoneNumber", "Número (com DDI)", false),
            ]),
        new("mercadopago", "Mercado Pago",
            "Gateway de pagamento (Pix, crédito e débito). Webhook reconcilia o status.",
            "💳",
            [
                new("MercadoPago:AccessToken", "Access Token", true),
                new("MercadoPago:PublicKey", "Public Key", false),
                new("MercadoPago:WebhookSecret", "Webhook Secret", true),
            ]),
        new("email", "E-mail (Gmail)",
            "Conta Gmail para e-mails transacionais (confirmações e relatórios).",
            "✉️",
            [
                new("Email:GmailUser", "Conta Gmail", false),
                new("Email:GmailAppToken", "App Password / Token", true),
                new("Email:FromName", "Nome do remetente", false),
            ]),
        new("groq", "Assistente IA (Groq)",
            "LLM que conduz a conversa do chatbot rumo à conversão. Sem chave, o bot usa o modo local (regras).",
            "🤖",
            [
                new("Groq:ApiKey", "API Key (gsk_...)", true),
                new("Groq:Model", "Modelo", false),
            ]),
    ];

    private static readonly HashSet<string> AllowedKeys =
        Catalog.SelectMany(g => g.Fields.Select(f => f.Key)).ToHashSet();

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        var row = await _db.IntegrationSettings
            .FirstOrDefaultAsync(s => s.Key == key, ct);
        if (row is not null && !string.IsNullOrWhiteSpace(row.Value))
            return row.Value;
        var env = _config[key];
        return string.IsNullOrWhiteSpace(env) ? null : env;
    }

    public async Task<List<IntegrationGroupDto>> GetGroupsAsync(CancellationToken ct)
    {
        var rows = await _db.IntegrationSettings.ToListAsync(ct);
        var result = new List<IntegrationGroupDto>();

        foreach (var g in Catalog)
        {
            var fields = new List<IntegrationFieldDto>();
            foreach (var f in g.Fields)
            {
                var dbRow = rows.FirstOrDefault(r => r.Key == f.Key);
                var dbVal = dbRow is not null && !string.IsNullOrWhiteSpace(dbRow.Value)
                    ? dbRow.Value : null;
                var envVal = string.IsNullOrWhiteSpace(_config[f.Key]) ? null : _config[f.Key];
                var effective = dbVal ?? envVal;

                var source = dbVal is not null ? "db" : envVal is not null ? "env" : "unset";
                var preview = effective is null
                    ? ""
                    : f.Secret ? Mask(effective) : effective;

                fields.Add(new IntegrationFieldDto(
                    f.Key, f.Label, f.Secret, effective is not null, preview, source));
            }
            var connected = fields.Where(x =>
                    g.Fields.First(cf => cf.Key == x.Key).Secret)
                .All(x => x.HasValue) && fields.Any(x => x.HasValue);

            result.Add(new IntegrationGroupDto(
                g.Id, g.Name, g.Description, g.Icon, connected, fields));
        }
        return result;
    }

    public async Task UpdateAsync(Guid actorId, UpdateSettingRequest req, CancellationToken ct)
    {
        if (!AllowedKeys.Contains(req.Key))
            throw new AppException("Chave de configuração inválida.", 400);

        var row = await _db.IntegrationSettings
            .FirstOrDefaultAsync(s => s.Key == req.Key, ct);

        if (string.IsNullOrWhiteSpace(req.Value))
        {
            // Vazio → remove customização e volta ao .env.
            if (row is not null) _db.IntegrationSettings.Remove(row);
        }
        else if (row is null)
        {
            _db.IntegrationSettings.Add(new IntegrationSetting
            {
                Key = req.Key,
                Value = req.Value.Trim(),
                UpdatedBy = actorId,
            });
        }
        else
        {
            row.Value = req.Value.Trim();
            row.UpdatedBy = actorId;
            row.UpdatedAt = DateTime.UtcNow;
        }

        _db.AuditLogs.Add(new AuditLog
        {
            ActorId = actorId,
            Action = "settings.update",
            EntityType = "IntegrationSetting",
            EntityId = req.Key,
            // Nunca registramos o valor do segredo, só se foi definido ou limpo.
            PayloadJson = JsonSerializer.Serialize(new
            {
                req.Key,
                cleared = string.IsNullOrWhiteSpace(req.Value),
            }),
        });

        await _db.SaveChangesAsync(ct);
    }

    private static string Mask(string value)
    {
        var v = value.Trim();
        if (v.Length <= 4) return "••••";
        return $"••••••{v[^4..]}";
    }
}
