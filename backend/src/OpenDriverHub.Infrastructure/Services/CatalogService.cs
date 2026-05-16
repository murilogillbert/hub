using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _db;
    public CatalogService(AppDbContext db) => _db = db;

    /// <summary>Mapa parceiro → (cidades, estados) das lojas físicas.</summary>
    private async Task<Dictionary<Guid, (List<string> cities, List<string> states)>>
        StoreMapAsync(CancellationToken ct)
    {
        var stores = await _db.Stores
            .Where(s => s.City != "" || s.State != "")
            .ToListAsync(ct);
        return stores
            .GroupBy(s => s.PartnerId)
            .ToDictionary(
                g => g.Key,
                g => (
                    g.Select(s => s.City).Where(c => c != "").Distinct().OrderBy(c => c).ToList(),
                    g.Select(s => s.State).Where(s => s != "").Distinct().OrderBy(s => s).ToList()));
    }

    private static ProductDto Map(
        Product p,
        Dictionary<Guid, (List<string> cities, List<string> states)> map)
    {
        if (p.Kind == ProductKind.Digital)
            return p.ToDto(new(), new());
        var loc = map.TryGetValue(p.PartnerId, out var v) ? v : (new(), new());
        return p.ToDto(loc.Item1, loc.Item2);
    }

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
        var map = await StoreMapAsync(ct);
        return list.Select(p => Map(p, map)).ToList();
    }

    public async Task<CatalogPage> SearchAsync(CatalogQuery q, CancellationToken ct)
    {
        var query = _db.Products.Include(p => p.Partner).Where(p => p.Active);

        if (!string.IsNullOrWhiteSpace(q.Category) && q.Category != "Todos")
            query = query.Where(p => p.Category == q.Category);
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim();
            query = query.Where(p =>
                p.Title.Contains(term) ||
                p.Description.Contains(term) ||
                p.Partner!.Name.Contains(term));
        }
        if (q.MinPrice is { } min) query = query.Where(p => p.Price >= min);
        if (q.MaxPrice is { } max) query = query.Where(p => p.Price <= max);

        var products = await query.ToListAsync(ct);
        var map = await StoreMapAsync(ct);

        // Filtro de localização: digital aparece sempre; físico precisa de
        // loja na cidade/estado pedidos.
        if (!string.IsNullOrWhiteSpace(q.City))
            products = products.Where(p =>
                p.Kind == ProductKind.Digital ||
                (map.TryGetValue(p.PartnerId, out var v) &&
                 v.cities.Any(c => string.Equals(c, q.City, StringComparison.OrdinalIgnoreCase))))
                .ToList();
        if (!string.IsNullOrWhiteSpace(q.State))
            products = products.Where(p =>
                p.Kind == ProductKind.Digital ||
                (map.TryGetValue(p.PartnerId, out var v) &&
                 v.states.Any(s => string.Equals(s, q.State, StringComparison.OrdinalIgnoreCase))))
                .ToList();

        products = (q.Sort ?? "relevance") switch
        {
            "price_asc" => products.OrderBy(p => p.Price).ToList(),
            "price_desc" => products.OrderByDescending(p => p.Price).ToList(),
            "rating" => products.OrderByDescending(p => p.Rating).ToList(),
            _ => products.OrderByDescending(p => p.Rating).ThenBy(p => p.Title).ToList(),
        };

        var total = products.Count;
        var pageSize = Math.Clamp(q.PageSize <= 0 ? 20 : q.PageSize, 20, 50);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        var page = Math.Clamp(q.Page <= 0 ? 1 : q.Page, 1, totalPages);

        var items = products
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => Map(p, map))
            .ToList();

        return new CatalogPage(items, total, page, pageSize, totalPages);
    }

    public async Task<CatalogFiltersDto> GetFiltersAsync(CancellationToken ct)
    {
        var cats = await _db.Categories
            .Where(c => c.Active && c.Type == Domain.CategoryType.Product)
            .OrderBy(c => c.Name).Select(c => c.Name).ToListAsync(ct);
        var stores = await _db.Stores.ToListAsync(ct);
        var cities = stores.Select(s => s.City).Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct().OrderBy(c => c).ToList();
        var states = stores.Select(s => s.State).Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct().OrderBy(s => s).ToList();
        var prices = await _db.Products.Where(p => p.Active).Select(p => p.Price).ToListAsync(ct);
        var minP = prices.Count > 0 ? prices.Min() : 0m;
        var maxP = prices.Count > 0 ? prices.Max() : 0m;
        return new CatalogFiltersDto(cats, cities, states,
            Math.Floor(minP), Math.Ceiling(maxP));
    }

    public async Task<List<CategoryDto>> GetActiveCategoriesAsync(string type, CancellationToken ct)
    {
        var t = Mappings.ParseCategoryType(type);
        return (await _db.Categories.Where(c => c.Active && c.Type == t)
                .OrderBy(c => c.Name).ToListAsync(ct))
            .Select(c => c.ToDto()).ToList();
    }

    public async Task<ProductDto> GetProductAsync(Guid id, CancellationToken ct)
    {
        var p = await _db.Products.Include(x => x.Partner).FirstOrDefaultAsync(x => x.Id == id, ct)
            ?? throw new AppException("Produto não encontrado.", 404);
        var map = await StoreMapAsync(ct);
        return Map(p, map);
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
        var stores = await _db.Stores.ToListAsync(ct);
        return stores
            .Select(s => new NearbyStoreDto(
                s.Id, s.PartnerId, s.Name, s.Address, s.Lat, s.Lng, s.Category,
                GeoUtils.DistanceKm(lat, lng, s.Lat, s.Lng)))
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
