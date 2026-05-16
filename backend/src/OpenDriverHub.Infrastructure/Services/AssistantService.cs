using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class AssistantService : IAssistantService
{
    private readonly AppDbContext _db;
    public AssistantService(AppDbContext db) => _db = db;

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
