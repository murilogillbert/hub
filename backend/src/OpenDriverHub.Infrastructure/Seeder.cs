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

        // ----- Categorias (geridas pelo Admin) -----
        var catNames = new[]
        {
            "Alimentação", "Cafeteria", "Entretenimento", "Educação",
            "Tecnologia", "Beleza", "Saúde", "Serviços",
        };
        db.Categories.AddRange(catNames.Select(n => new Category { Name = n }));

        var pCafe = new Partner { Name = "Estação do Café", Segment = "Cafeteria", FeePercent = 10, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=cafe&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 8, 12) };
        var pCine = new Partner { Name = "CineHub", Segment = "Entretenimento", FeePercent = 12, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=cinema&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 9, 2) };
        var pBurger = new Partner { Name = "BurgerLab", Segment = "Alimentação", FeePercent = 15, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=burger&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 10, 21) };
        var pTech = new Partner { Name = "EduDigital", Segment = "Educação", FeePercent = 8, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=tech&backgroundType=gradientLinear", JoinedAt = new DateTime(2026, 1, 8) };
        var pBeauty = new Partner { Name = "Studio Belle", Segment = "Beleza", FeePercent = 12, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=belle&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 11, 3) };
        var pFit = new Partner { Name = "VidaFit", Segment = "Saúde", FeePercent = 10, LogoUrl = "https://api.dicebear.com/9.x/icons/svg?seed=fit&backgroundType=gradientLinear", JoinedAt = new DateTime(2025, 12, 1) };
        db.Partners.AddRange(pCafe, pCine, pBurger, pTech, pBeauty, pFit);

        // ----- Lojas físicas com cidade/estado (pTech é 100% digital: sem loja) -----
        db.Stores.AddRange(
            new PartnerStore { Partner = pCafe, Name = "Estação do Café - Centro", Address = "Rua das Flores, 120 - Centro", City = "São Paulo", State = "SP", Lat = -23.5505, Lng = -46.6333, Category = "Cafeteria" },
            new PartnerStore { Partner = pCafe, Name = "Estação do Café - Jardins", Address = "Av. Paulista, 900 - Jardins", City = "São Paulo", State = "SP", Lat = -23.5618, Lng = -46.6565, Category = "Cafeteria" },
            new PartnerStore { Partner = pCafe, Name = "Estação do Café - Copacabana", Address = "Av. Atlântica, 1700 - Copacabana", City = "Rio de Janeiro", State = "RJ", Lat = -22.9711, Lng = -43.1822, Category = "Cafeteria" },
            new PartnerStore { Partner = pCine, Name = "CineHub Shopping Sul", Address = "Av. das Nações, 4500 - Sul", City = "São Paulo", State = "SP", Lat = -23.5896, Lng = -46.6402, Category = "Entretenimento" },
            new PartnerStore { Partner = pCine, Name = "CineHub BH Savassi", Address = "Rua Pernambuco, 1000 - Savassi", City = "Belo Horizonte", State = "MG", Lat = -19.9386, Lng = -43.9352, Category = "Entretenimento" },
            new PartnerStore { Partner = pBurger, Name = "BurgerLab Vila Madalena", Address = "Rua Aspicuelta, 350 - Vila Madalena", City = "São Paulo", State = "SP", Lat = -23.5469, Lng = -46.6911, Category = "Alimentação" },
            new PartnerStore { Partner = pBurger, Name = "BurgerLab Itaim", Address = "Rua Joaquim Floriano, 700 - Itaim", City = "São Paulo", State = "SP", Lat = -23.5839, Lng = -46.6776, Category = "Alimentação" },
            new PartnerStore { Partner = pBurger, Name = "BurgerLab Asa Sul", Address = "CLS 410 Bloco B - Asa Sul", City = "Brasília", State = "DF", Lat = -15.8267, Lng = -47.9218, Category = "Alimentação" },
            new PartnerStore { Partner = pBeauty, Name = "Studio Belle Pinheiros", Address = "Rua dos Pinheiros, 200", City = "São Paulo", State = "SP", Lat = -23.5650, Lng = -46.6800, Category = "Beleza" },
            new PartnerStore { Partner = pFit, Name = "VidaFit Barra", Address = "Av. das Américas, 5000 - Barra", City = "Rio de Janeiro", State = "RJ", Lat = -23.0010, Lng = -43.3650, Category = "Saúde" });

        var images = new[]
        {
            "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600",
            "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=600",
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600",
            "https://images.unsplash.com/photo-1503602642458-232111445657?w=600",
            "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600",
            "https://images.unsplash.com/photo-1550547660-d9450f859349?w=600",
            "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600",
            "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600",
        };

        // Produtos âncora (usados em pedidos demo).
        var prodCombo = new Product { Partner = pCafe, Title = "Combo Café + Croissant", Description = "Café espresso 60ml com croissant amanteigado quentinho.", Price = 18.9m, CashbackPercent = 5, Kind = ProductKind.Voucher, ImageUrl = images[0], Category = "Cafeteria", Rating = 4.8, Stock = 120 };
        var prodCine = new Product { Partner = pCine, Title = "Ingresso CineHub - Sessão dupla", Description = "2 ingressos para qualquer sessão 2D, válidos por 60 dias.", Price = 49.9m, CashbackPercent = 8, Kind = ProductKind.Voucher, ImageUrl = images[1], Category = "Entretenimento", Rating = 4.6, Stock = 50 };
        var prodBurger = new Product { Partner = pBurger, Title = "Smash Burger Duplo + Fritas", Description = "Hambúrguer artesanal duplo com fritas crocantes.", Price = 39.5m, CashbackPercent = 10, Kind = ProductKind.Voucher, ImageUrl = images[2], Category = "Alimentação", Rating = 4.9, Stock = 80 };
        db.Products.AddRange(prodCombo, prodCine, prodBurger);

        // Catálogo amplo (>30 itens) para paginação real, incl. digitais sem local.
        var rnd = new Random(42);
        var gen = new List<(Partner partner, string cat, ProductKind kind, string title)>
        {
            (pCafe, "Cafeteria", ProductKind.Voucher, "Cappuccino Premium"),
            (pCafe, "Cafeteria", ProductKind.Physical, "Caneca Estação do Café"),
            (pCafe, "Cafeteria", ProductKind.Voucher, "Café da Manhã Completo"),
            (pCafe, "Cafeteria", ProductKind.Voucher, "Combo Latte + Bolo"),
            (pBurger, "Alimentação", ProductKind.Voucher, "Combo Cheddar Bacon"),
            (pBurger, "Alimentação", ProductKind.Voucher, "Voucher 20% off no balcão"),
            (pBurger, "Alimentação", ProductKind.Voucher, "Veggie Burger + Suco"),
            (pBurger, "Alimentação", ProductKind.Voucher, "Combo Família (4 burgers)"),
            (pCine, "Entretenimento", ProductKind.Voucher, "Ingresso 3D + Pipoca"),
            (pCine, "Entretenimento", ProductKind.Voucher, "Pacote Casal (2 ingressos)"),
            (pCine, "Entretenimento", ProductKind.Voucher, "Sessão Premium VIP"),
            (pTech, "Educação", ProductKind.Digital, "Curso de Direção Defensiva"),
            (pTech, "Educação", ProductKind.Digital, "Curso de Inglês Online"),
            (pTech, "Educação", ProductKind.Digital, "Mentoria de Carreira (3 sessões)"),
            (pTech, "Tecnologia", ProductKind.Digital, "E-book: Finanças Pessoais"),
            (pTech, "Tecnologia", ProductKind.Digital, "Assinatura App Produtividade"),
            (pTech, "Educação", ProductKind.Digital, "Workshop de Excel Avançado"),
            (pBeauty, "Beleza", ProductKind.Voucher, "Corte + Escova"),
            (pBeauty, "Beleza", ProductKind.Voucher, "Dia de Spa Relax"),
            (pBeauty, "Beleza", ProductKind.Voucher, "Manicure + Pedicure"),
            (pBeauty, "Beleza", ProductKind.Physical, "Kit Skincare Premium"),
            (pFit, "Saúde", ProductKind.Voucher, "Day Use Academia"),
            (pFit, "Saúde", ProductKind.Voucher, "Avaliação Física + Plano"),
            (pFit, "Saúde", ProductKind.Voucher, "Aula de Yoga (pacote 5)"),
            (pFit, "Serviços", ProductKind.Voucher, "Personal Trainer (1h)"),
            (pCafe, "Serviços", ProductKind.Voucher, "Aluguel de espaço p/ reunião"),
            (pBurger, "Alimentação", ProductKind.Voucher, "Milkshake Artesanal"),
            (pCine, "Entretenimento", ProductKind.Voucher, "Combo Aniversário (10 ingressos)"),
            (pBeauty, "Beleza", ProductKind.Voucher, "Maquiagem Profissional"),
            (pFit, "Saúde", ProductKind.Digital, "Plano de Treino Online (mensal)"),
            (pTech, "Tecnologia", ProductKind.Digital, "Template de Currículo + Revisão"),
            (pCafe, "Cafeteria", ProductKind.Voucher, "Cartão Fidelidade 10 cafés"),
        };
        foreach (var (partner, cat, kind, title) in gen)
        {
            var price = Math.Round((decimal)(rnd.Next(990, 19990) / 100.0), 2);
            db.Products.Add(new Product
            {
                Partner = partner,
                Title = title,
                Description = $"{title} — oferta de {partner.Name} com cashback.",
                Price = price,
                CashbackPercent = rnd.Next(3, 13),
                Kind = kind,
                ImageUrl = images[rnd.Next(images.Length)],
                Category = cat,
                Rating = Math.Round(3.8 + rnd.NextDouble() * 1.2, 1),
                Stock = kind == ProductKind.Digital ? 9999 : rnd.Next(15, 300),
            });
        }

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
