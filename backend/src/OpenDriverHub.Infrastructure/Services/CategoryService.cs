using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class CategoryService : ICategoryService
{
    private readonly AppDbContext _db;
    public CategoryService(AppDbContext db) => _db = db;

    public async Task<List<CategoryDto>> ListAsync(CancellationToken ct)
        => (await _db.Categories
                .OrderBy(c => c.Type).ThenBy(c => c.Name).ToListAsync(ct))
            .Select(c => c.ToDto()).ToList();

    public async Task<CategoryDto> CreateAsync(CategoryUpsertRequest req, CancellationToken ct)
    {
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new AppException("Nome da categoria é obrigatório.", 400);
        var type = Mappings.ParseCategoryType(req.Type);
        if (await _db.Categories.AnyAsync(c => c.Name == name && c.Type == type, ct))
            throw new AppException("Já existe uma categoria com esse nome.", 409);
        var cat = new Category { Name = name, Type = type, Active = req.Active };
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return cat.ToDto();
    }

    public async Task<CategoryDto> UpdateAsync(Guid id, CategoryUpsertRequest req, CancellationToken ct)
    {
        var cat = await _db.Categories.FindAsync([id], ct)
            ?? throw new AppException("Categoria não encontrada.", 404);
        var name = req.Name.Trim();
        if (string.IsNullOrWhiteSpace(name))
            throw new AppException("Nome da categoria é obrigatório.", 400);
        if (await _db.Categories.AnyAsync(
                c => c.Name == name && c.Type == cat.Type && c.Id != id, ct))
            throw new AppException("Já existe uma categoria com esse nome.", 409);
        cat.Name = name;
        cat.Active = req.Active;
        await _db.SaveChangesAsync(ct);
        return cat.ToDto();
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var cat = await _db.Categories.FindAsync([id], ct)
            ?? throw new AppException("Categoria não encontrada.", 404);
        // Soft-delete: desativa para não quebrar produtos existentes.
        cat.Active = false;
        await _db.SaveChangesAsync(ct);
    }
}
