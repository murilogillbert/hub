using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Partner> Partners => Set<Partner>();
    public DbSet<PartnerStore> Stores => Set<PartnerStore>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<PaymentTransaction> Payments => Set<PaymentTransaction>();
    public DbSet<AssistantLead> Leads => Set<AssistantLead>();
    public DbSet<BotInteraction> BotInteractions => Set<BotInteraction>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<IntegrationSetting> IntegrationSettings => Set<IntegrationSetting>();
    public DbSet<PaymentEvent> PaymentEvents => Set<PaymentEvent>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<CashbackEntry> CashbackEntries => Set<CashbackEntry>();
    public DbSet<Review> Reviews => Set<Review>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Category>(e =>
        {
            e.HasIndex(x => new { x.Name, x.Type }).IsUnique();
            e.Property(x => x.Name).HasMaxLength(80).IsRequired();
        });
        b.Entity<PartnerStore>(e =>
        {
            e.Property(x => x.City).HasMaxLength(120);
            e.Property(x => x.State).HasMaxLength(40);
        });
        b.Entity<IntegrationSetting>(e =>
        {
            e.HasIndex(x => x.Key).IsUnique();
            e.Property(x => x.Key).HasMaxLength(120).IsRequired();
            e.Property(x => x.Value).HasMaxLength(1024);
        });

        b.Entity<User>(e =>
        {
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.Email).HasMaxLength(180).IsRequired();
            e.Property(x => x.CashbackBalance).HasPrecision(12, 2);
        });

        b.Entity<Partner>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(160).IsRequired();
            e.Property(x => x.FeePercent).HasPrecision(5, 2);
        });

        b.Entity<PartnerStore>(e =>
        {
            e.HasOne(x => x.Partner).WithMany(p => p.Stores)
                .HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Product>(e =>
        {
            e.HasIndex(x => x.PartnerId);
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.Property(x => x.Price).HasPrecision(12, 2);
            e.Property(x => x.CashbackPercent).HasPrecision(5, 2);
            e.HasOne(x => x.Partner).WithMany(p => p.Products)
                .HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<Order>(e =>
        {
            e.HasIndex(x => x.Code).IsUnique();
            e.HasIndex(x => new { x.CustomerId, x.Status });
            e.HasIndex(x => x.PartnerId);
            e.Property(x => x.Code).HasMaxLength(40).IsRequired();
            e.Property(x => x.PaidPrice).HasPrecision(12, 2);
            e.Property(x => x.CashbackEarned).HasPrecision(12, 2);
            e.Property(x => x.CashbackUsed).HasPrecision(12, 2);
            e.Property(x => x.RowVersion).IsRowVersion();
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Partner).WithMany().HasForeignKey(x => x.PartnerId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<OrderItem>(e =>
        {
            e.HasIndex(x => x.OrderId);
            e.HasIndex(x => x.PartnerId);
            e.Property(x => x.ProductTitle).HasMaxLength(200);
            e.Property(x => x.UnitPrice).HasPrecision(12, 2);
            e.Property(x => x.LineTotal).HasPrecision(12, 2);
            e.Property(x => x.CashbackPercent).HasPrecision(5, 2);
            e.Property(x => x.CashbackEarned).HasPrecision(12, 2);
            e.HasOne(x => x.Order).WithMany(o => o.Items)
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product).WithMany()
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Partner).WithMany()
                .HasForeignKey(x => x.PartnerId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<PaymentTransaction>(e =>
        {
            e.HasIndex(x => x.ExternalPaymentId);
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.HasOne(x => x.Order).WithMany(o => o.Payments)
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Cascade);
        });

        b.Entity<CashbackEntry>(e =>
        {
            e.HasIndex(x => new { x.UserId, x.CreatedAt });
            e.Property(x => x.Amount).HasPrecision(12, 2);
            e.Property(x => x.Description).HasMaxLength(240);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Order).WithMany()
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.SetNull);
        });

        b.Entity<Review>(e =>
        {
            // 1 avaliação por produto por usuário.
            e.HasIndex(x => new { x.ProductId, x.UserId }).IsUnique();
            e.Property(x => x.Comment).HasMaxLength(1000);
            e.HasOne(x => x.Product).WithMany()
                .HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.User).WithMany()
                .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Order).WithMany()
                .HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
        });

        b.Entity<BotInteraction>(e =>
        {
            e.HasOne(x => x.Lead).WithMany(l => l.Interactions)
                .HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.SetNull);
        });
    }
}
