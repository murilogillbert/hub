using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class AssistantService : IAssistantService
{
    private readonly AppDbContext _db;
    private readonly ISettingsProvider _settings;
    private readonly IHttpClientFactory _http;

    public AssistantService(
        AppDbContext db, ISettingsProvider settings, IHttpClientFactory http)
    {
        _db = db; _settings = settings; _http = http;
    }

    private const string SystemPrompt =
        """
        Você é o assistente virtual do OpenDriverHub, um marketplace onde parceiros
        (cafeterias, restaurantes, cinemas, cursos) vendem produtos, vouchers e
        serviços para clientes cadastrados, e TODA compra gera cashback que vira
        crédito para abater na próxima compra.

        Seu objetivo é CONVERTER: entender rápido a necessidade do visitante,
        recomendar a categoria/benefício certo e conduzi-lo a (1) criar conta e
        comprar no catálogo, ou (2) continuar o atendimento no WhatsApp.

        Regras:
        - Responda em português do Brasil, tom amigável e direto.
        - Mensagens curtas (no máximo 3 frases). Faça UMA pergunta por vez.
        - Destaque o cashback e o preço menor como motivadores.
        - Categorias reais: Alimentação, Cafeteria, Entretenimento, Educação.
        - Não invente produtos, preços ou promoções específicas.
        - Quando perceber intenção de compra ou dúvida que exige humano,
          incentive: "posso te encaminhar para o WhatsApp para finalizar".
        - Nunca peça dados sensíveis (senha, cartão).
        """;

    public async Task<AssistantChatResponse> ChatAsync(
        AssistantChatRequest req, Guid? userId, CancellationToken ct)
    {
        var apiKey = await _settings.GetAsync("Groq:ApiKey", ct);
        var lastUser = req.Messages.LastOrDefault(m => m.Role == "user")?.Content ?? "";

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            // Sem chave configurada → sinaliza fallback (front usa o motor local).
            return new AssistantChatResponse("", Fallback: true);
        }

        var model = await _settings.GetAsync("Groq:Model", ct);
        if (string.IsNullOrWhiteSpace(model)) model = "llama-3.3-70b-versatile";

        var messages = new List<object> { new { role = "system", content = SystemPrompt } };
        // Mantém só as últimas 12 mensagens para limitar tokens.
        foreach (var m in req.Messages.TakeLast(12))
            messages.Add(new { role = m.Role == "assistant" ? "assistant" : "user", content = m.Content });

        var client = _http.CreateClient();
        client.Timeout = TimeSpan.FromSeconds(20);
        using var httpReq = new HttpRequestMessage(
            HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
        httpReq.Headers.Add("Authorization", $"Bearer {apiKey}");
        httpReq.Content = JsonContent.Create(new
        {
            model,
            messages,
            temperature = 0.6,
            max_tokens = 320,
        });

        string reply;
        try
        {
            using var resp = await client.SendAsync(httpReq, ct);
            if (!resp.IsSuccessStatusCode)
                return new AssistantChatResponse("", Fallback: true);

            using var stream = await resp.Content.ReadAsStreamAsync(ct);
            using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            reply = doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";
            if (string.IsNullOrWhiteSpace(reply))
                return new AssistantChatResponse("", Fallback: true);
        }
        catch
        {
            return new AssistantChatResponse("", Fallback: true);
        }

        // Persiste a interação para o painel de leads do admin.
        _db.BotInteractions.Add(new BotInteraction
        {
            UserMessage = lastUser,
            BotResponse = reply,
            Step = "llm",
        });
        await _db.SaveChangesAsync(ct);

        return new AssistantChatResponse(reply.Trim(), Fallback: false);
    }

    public async Task<AssistantLeadDto> CreateLeadAsync(Guid? userId, AssistantLeadInput input, CancellationToken ct)
    {
        var lead = new AssistantLead
        {
            UserId = userId,
            Profile = input.Profile,
            Category = input.Category,
            Goal = input.Goal,
            MainIntent = input.MainIntent,
            Score = input.Score,
            Temperature = ParseTemp(input.Temperature),
        };
        _db.Leads.Add(lead);
        await _db.SaveChangesAsync(ct);
        return new AssistantLeadDto(lead.Id, input, lead.CreatedAt);
    }

    public async Task RecordInteractionAsync(BotInteractionInput input, CancellationToken ct)
    {
        _db.BotInteractions.Add(new BotInteraction
        {
            LeadId = input.LeadId,
            UserMessage = input.MensagemUsuario,
            BotResponse = input.RespostaBot,
            Step = input.EtapaFluxo,
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<AssistantLeadDto>> ListLeadsAsync(CancellationToken ct)
        => (await _db.Leads.OrderByDescending(l => l.CreatedAt).Take(200).ToListAsync(ct))
            .Select(l => new AssistantLeadDto(l.Id,
                new AssistantLeadInput(l.Profile, l.Category, l.Goal, l.MainIntent,
                    l.Score, l.Temperature.ToString().ToLowerInvariant()),
                l.CreatedAt))
            .ToList();

    private static LeadTemperature ParseTemp(string s) => s.ToLowerInvariant() switch
    {
        "quente" => LeadTemperature.Quente,
        "morno" => LeadTemperature.Morno,
        _ => LeadTemperature.Frio,
    };
}
