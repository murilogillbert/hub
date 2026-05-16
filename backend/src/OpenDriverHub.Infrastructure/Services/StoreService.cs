using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class StoreService : IStoreService
{
    private readonly AppDbContext _db;
    public StoreService(AppDbContext db) => _db = db;

    public async Task<List<StoreDto>> ListForAdminAsync(Guid? partnerId, CancellationToken ct)
    {
        var query = _db.Stores.AsQueryable();
        if (partnerId is { } pid) query = query.Where(s => s.PartnerId == pid);
        return (await query.OrderBy(s => s.Name).ToListAsync(ct))
            .Select(s => s.ToDto()).ToList();
    }

    public async Task<List<StoreDto>> ListForPartnerAsync(Guid partnerId, CancellationToken ct)
        => (await _db.Stores
                .Where(s => s.PartnerId == partnerId)
                .OrderBy(s => s.Name)
                .ToListAsync(ct))
            .Select(s => s.ToDto()).ToList();

    public async Task<StoreDto> CreateForAdminAsync(StoreUpsertRequest req, CancellationToken ct)
    {
        var partnerId = req.PartnerId
            ?? throw new AppException("Parceiro é obrigatório.", 400);
        await EnsurePartnerAsync(partnerId, ct);

        var store = new PartnerStore { PartnerId = partnerId };
        Apply(store, req);
        _db.Stores.Add(store);
        await _db.SaveChangesAsync(ct);
        return store.ToDto();
    }

    public async Task<StoreDto> CreateForPartnerAsync(
        Guid partnerId, StoreUpsertRequest req, CancellationToken ct)
    {
        await EnsurePartnerAsync(partnerId, ct);

        var store = new PartnerStore { PartnerId = partnerId };
        Apply(store, req);
        _db.Stores.Add(store);
        await _db.SaveChangesAsync(ct);
        return store.ToDto();
    }

    public async Task<StoreDto> UpdateForAdminAsync(
        Guid id, StoreUpsertRequest req, CancellationToken ct)
    {
        var store = await _db.Stores.FindAsync([id], ct)
            ?? throw new AppException("Unidade não encontrada.", 404);
        if (req.PartnerId is { } partnerId && partnerId != store.PartnerId)
        {
            await EnsurePartnerAsync(partnerId, ct);
            store.PartnerId = partnerId;
        }
        Apply(store, req);
        await _db.SaveChangesAsync(ct);
        return store.ToDto();
    }

    public async Task<StoreDto> UpdateForPartnerAsync(
        Guid partnerId, Guid id, StoreUpsertRequest req, CancellationToken ct)
    {
        var store = await _db.Stores
            .FirstOrDefaultAsync(s => s.Id == id && s.PartnerId == partnerId, ct)
            ?? throw new AppException("Unidade não encontrada.", 404);
        Apply(store, req);
        await _db.SaveChangesAsync(ct);
        return store.ToDto();
    }

    public async Task DeleteForAdminAsync(Guid id, CancellationToken ct)
    {
        var store = await _db.Stores.FindAsync([id], ct)
            ?? throw new AppException("Unidade não encontrada.", 404);
        _db.Stores.Remove(store);
        await _db.SaveChangesAsync(ct);
    }

    public async Task DeleteForPartnerAsync(Guid partnerId, Guid id, CancellationToken ct)
    {
        var store = await _db.Stores
            .FirstOrDefaultAsync(s => s.Id == id && s.PartnerId == partnerId, ct)
            ?? throw new AppException("Unidade não encontrada.", 404);
        _db.Stores.Remove(store);
        await _db.SaveChangesAsync(ct);
    }

    private async Task EnsurePartnerAsync(Guid partnerId, CancellationToken ct)
    {
        if (!await _db.Partners.AnyAsync(p => p.Id == partnerId, ct))
            throw new AppException("Parceiro não encontrado.", 404);
    }

    private static void Apply(PartnerStore store, StoreUpsertRequest req)
    {
        var name = req.Name.Trim();
        var address = req.Address.Trim();
        var city = req.City.Trim();
        var state = req.State.Trim().ToUpperInvariant();
        var category = req.Category.Trim();

        if (string.IsNullOrWhiteSpace(name))
            throw new AppException("Nome da unidade é obrigatório.", 400);
        if (string.IsNullOrWhiteSpace(address))
            throw new AppException("Endereço é obrigatório.", 400);
        if (string.IsNullOrWhiteSpace(city))
            throw new AppException("Cidade é obrigatória.", 400);
        if (string.IsNullOrWhiteSpace(state))
            throw new AppException("Estado é obrigatório.", 400);
        if (string.IsNullOrWhiteSpace(category))
            throw new AppException("Categoria é obrigatória.", 400);
        if (req.Lat is < -90 or > 90 || req.Lng is < -180 or > 180)
            throw new AppException("Coordenadas inválidas.", 400);
        if (req.Lat == 0 && req.Lng == 0)
            throw new AppException("Informe latitude e longitude reais da unidade.", 400);

        store.Name = name;
        store.Address = address;
        store.City = city;
        store.State = state;
        store.Lat = req.Lat;
        store.Lng = req.Lng;
        store.Category = category;
    }
}
