using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;
using OpenDriverHub.Infrastructure.Services;

namespace OpenDriverHub.Infrastructure;

/// <summary>Seed idempotente — espelha os mocks do front (paridade visual).</summary>
public static class Seeder
{
    /// <summary>
    /// Aplica as migrations (sempre) e, se <paramref name="seedDemo"/> for true,
    /// popula dados demo. Em produção o seed demo deve ficar desligado para não
    /// criar contas com senha conhecida.
    /// </summary>
    public static async Task SeedAsync(
        AppDbContext db, IPasswordHasher hasher, bool seedDemo, CancellationToken ct = default)
    {
        await db.Database.MigrateAsync(ct);
        if (!seedDemo) return;
        if (await db.Partners.AnyAsync(ct)) return;

        var pCafe = new Partner { Name = "Estação do Café", Segment = "Cafeteria", FeePercent = 10, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=cafe&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 8, 12) };
        var pCine = new Partner { Name = "CineHub", Segment = "Entretenimento", FeePercent = 12, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=cinema&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 9, 2) };
        var pBurger = new Partner { Name = "BurgerLab", Segment = "Alimentação", FeePercent = 15, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=burger&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 10, 21) };
        var pTech = new Partner { Name = "TechStore Digital", Segment = "Tecnologia", FeePercent = 8, Active = false, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=tech&backgroundType=gradientLinear", JoinedAt = new DateTime(2026, 1, 8) };
        db.Partners.AddRange(pCafe, pCine, pBurger, pTech);

        db.Stores.AddRange(
            new PartnerStore { Partner = pCafe, Name = "Estação do Café - Centro", Address = "Rua das Flores, 120 - Centro", Lat = -23.5505, Lng = -46.6333, Category = "Cafeteria" },
            new PartnerStore { Partner = pCafe, Name = "Estação do Café - Jardins", Address = "Av. Paulista, 900 - Jardins", Lat = -23.5618, Lng = -46.6565, Category = "Cafeteria" },
            new PartnerStore { Partner = pCine, Name = "CineHub Shopping Sul", Address = "Av. das Nações, 4500 - Sul", Lat = -23.5896, Lng = -46.6402, Category = "Entretenimento" },
            new PartnerStore { Partner = pBurger, Name = "BurgerLab Vila Madalena", Address = "Rua Aspicuelta, 350 - Vila Madalena", Lat = -23.5469, Lng = -46.6911, Category = "Alimentação" },
            new PartnerStore { Partner = pBurger, Name = "BurgerLab Itaim", Address = "Rua Joaquim Floriano, 700 - Itaim", Lat = -23.5839, Lng = -46.6776, Category = "Alimentação" });

        var prodCombo = new Product { Partner = pCafe, Title = "Combo Café + Croissant", Description = "Café espresso 60ml com croissant amanteigado quentinho.", Price = 18.9m, CashbackPercent = 5, Kind = ProductKind.Voucher, ImageUrl = "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600", Category = "Cafeteria", Rating = 4.8, Stock = 120 };
        var prodCine = new Product { Partner = pCine, Title = "Ingresso CineHub - Sessão dupla", Description = "2 ingressos para qualquer sessão 2D, válidos por 60 dias.", Price = 49.9m, CashbackPercent = 8, Kind = ProductKind.Voucher, ImageUrl = "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600", Category = "Entretenimento", Rating = 4.6, Stock = 50 };
        var prodBurger = new Product { Partner = pBurger, Title = "Smash Burger Duplo + Fritas", Description = "Hambúrguer artesanal duplo com fritas crocantes.", Price = 39.5m, CashbackPercent = 10, Kind = ProductKind.Voucher, ImageUrl = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600", Category = "Alimentação", Rating = 4.9, Stock = 80 };
        var prodCurso = new Product { Partner = pTech, Title = "Curso Online de Direção Defensiva", Description = "Acesso vitalício ao curso digital, com certificado.", Price = 89.0m, CashbackPercent = 3, Kind = ProductKind.Digital, ImageUrl = "https://images.unsplash.com/photo-1503602642458-232111445657?w=600", Category = "Educação", Rating = 4.5, Stock = 999 };
        var prodCaneca = new Product { Partner = pCafe, Title = "Caneca Estação do Café", Description = "Caneca de cerâmica 300ml personalizada.", Price = 34.0m, CashbackPercent = 4, Kind = ProductKind.Physical, ImageUrl = "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600", Category = "Cafeteria", Rating = 4.7, Stock = 25 };
        var prodVoucher = new Product { Partner = pBurger, Title = "Voucher 20% off no balcão", Description = "Use no caixa do BurgerLab e ganhe 20% off acima de R$ 30.", Price = 9.9m, CashbackPercent = 6, Kind = ProductKind.Voucher, ImageUrl = "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600", Category = "Alimentação", Rating = 4.4, Stock = 300 };
        db.Products.AddRange(prodCombo, prodCine, prodBurger, prodCurso, prodCaneca, prodVoucher);

        var pwd = hasher.Hash("Demo@123");
        var cliente = new User { Name = "Mariana Souza", Email = "cliente@demo.com", PasswordHash = pwd, Role = UserRole.Client, CashbackBalance = 12.45m, AvatarUrl = "https://api.dicebear.com/9.x/avataaars/svg?seed=mariana" };
        var pedro = new User { Name = "Pedro Lima", Email = "pedro@demo.com", PasswordHash = pwd, Role = UserRole.Client, CashbackBalance = 3.99m };
        var parceiro = new User { Name = "João Silva (BurgerLab)", Email = "parceiro@demo.com", PasswordHash = pwd, Role = UserRole.Partner, Partner = pBurger, AvatarUrl = "https://api.dicebear.com/9.x/avataaars/svg?seed=joao" };
        var admin = new User { Name = "Admin OpenDriverHub", Email = "admin@demo.com", PasswordHash = pwd, Role = UserRole.Admin, AvatarUrl = "https://api.dicebear.com/9.x/avataaars/svg?seed=admin" };
        db.Users.AddRange(cliente, pedro, parceiro, admin);

        db.Orders.AddRange(
            new Order { Code = OrderService.GenerateCode(), Product = prodCombo, Partner = pCafe, Customer = cliente, PaidPrice = 18.9m, CashbackEarned = 0.95m, Status = OrderStatus.Paid, PaymentMethod = PaymentMethod.Pix, PaidAt = DateTime.UtcNow.AddDays(-3), VoucherCode = PaymentCodes.Voucher(), CreatedAt = DateTime.UtcNow.AddDays(-3) },
            new Order { Code = OrderService.GenerateCode(), Product = prodBurger, Partner = pBurger, Customer = cliente, PaidPrice = 39.5m, CashbackEarned = 3.95m, CashbackUsed = 2.0m, Status = OrderStatus.Redeemed, PaymentMethod = PaymentMethod.CreditCard, PaidAt = DateTime.UtcNow.AddDays(-7), RedeemedAt = DateTime.UtcNow.AddDays(-6), VoucherCode = PaymentCodes.Voucher(), CreatedAt = DateTime.UtcNow.AddDays(-7) },
            new Order { Code = OrderService.GenerateCode(), Product = prodCine, Partner = pCine, Customer = pedro, PaidPrice = 49.9m, CashbackEarned = 3.99m, Status = OrderStatus.Paid, PaymentMethod = PaymentMethod.Pix, PaidAt = DateTime.UtcNow.AddDays(-1), VoucherCode = PaymentCodes.Voucher(), CreatedAt = DateTime.UtcNow.AddDays(-1) });

        await db.SaveChangesAsync(ct);
    }
}
