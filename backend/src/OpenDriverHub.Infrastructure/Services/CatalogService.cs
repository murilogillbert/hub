using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;

namespace OpenDriverHub.Infrastructure.Services;

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _db;
    public CatalogService(AppDbContext db) => _db = db;

    public async Task<List<ProductDto>> GetProductsAsync(string? category, string? q, Guid? partnerId, CancellationToken ct)
    {
        var query = _db.Products.Include(p => p.Partner).Where(p => p.Active);
        if (!string.IsNullOrWhiteSpace(category) && category != "Todos")
            query = query.Where(p => p.Category == category);
        if (!string.IsNullOrWhiteSpace(q))
            query = query.Where(p => p.Title.Contains(q));
        if (partnerId is { } pid)
            query = query.Where(p => p.PartnerId == pid);
        var list = await query.OrderBy(p => p.Title).ToListAsync(ct);
        return list.Select(p => p.ToDto()).ToList();
    }

    public async Task<ProductDto> GetProductAsync(Guid id, CancellationToken ct)
    {
        var p = await _db.Products.Include(x => x.Partner).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new AppException("Produto não encontrado.", 404);
        return p.ToDto();
    }

    public async Task<List<StoreDto>> GetStoresAsync(Guid? partnerId, CancellationToken ct)
    {
        var query = _db.Stores.AsQueryable();
        if (partnerId is { } pid) query = query.Where(s => s.PartnerId == pid);
        var list = await query.ToListAsync(ct);
        return list.Select(s => s.ToDto()).ToList();
    }

    public async Task<List<NearbyStoreDto>> GetNearbyStoresAsync(
        double lat, double lng, double radiusKm, int limit, CancellationToken ct)
    {
        // Dataset pequeno → Haversine em memória. (Futuro: coluna geography no SQL.)
        var stores = await _db.Stores.ToListAsync(ct);
        return stores
            .Select(s => new NearbyStoreDto(
                s.Id, s.PartnerId, s.Name, s.Address, s.Lat, s.Lng, s.Category,
                Domain.GeoUtils.DistanceKm(lat, lng, s.Lat, s.Lng)))
            .Where(s => s.DistanceKm <= radiusKm)
            .OrderBy(s => s.DistanceKm)
            .Take(limit)
            .ToList();
    }

    public async Task<List<PartnerDto>> GetPartnersAsync(CancellationToken ct)
        => (await _db.Partners.ToListAsync(ct)).Select(p => p.ToDto()).ToList();

    public async Task<PartnerDto> GetPartnerAsync(Guid id, CancellationToken ct)
    {
        var p = await _db.Partners.FindAsync([id], ct)
            ?? throw new AppException("Parceiro não encontrado.", 404);
        return p.ToDto();
    }
}
