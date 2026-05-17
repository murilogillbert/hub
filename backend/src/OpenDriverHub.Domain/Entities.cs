namespace OpenDriverHub.Domain;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; } = UserRole.Client;
    public decimal CashbackBalance { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Phone { get; set; }
    public bool NotifyWhatsApp { get; set; } = true;
    public bool NotifyEmail { get; set; } = true;
    public bool NotifyPromo { get; set; }
    public Guid? PartnerId { get; set; }
    public Partner? Partner { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Partner
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Segment { get; set; } = string.Empty;
    public string LogoUrl { get; set; } = string.Empty;
    public string Cnpj { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public double Lat { get; set; }
    public double Lng { get; set; }
    public bool Active { get; set; } = true;
    public decimal FeePercent { get; set; } = 10m;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
    public List<Product> Products { get; set; } = new();
    public List<PartnerStore> Stores { get; set; } = new();
}

public class PartnerStore
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public Partner? Partner { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public double Lat { get; set; }
    public double Lng { get; set; }
    public string Category { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
}

/// <summary>Categoria de produto — definida e gerida pelo Admin.</summary>
public class Category
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public CategoryType Type { get; set; } = CategoryType.Product;
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PartnerId { get; set; }
    public Partner? Partner { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal CashbackPercent { get; set; }
    public ProductKind Kind { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public double Rating { get; set; }
    public int Stock { get; set; }
    public bool Active { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Order
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid PartnerId { get; set; }
    public Partner? Partner { get; set; }
    public Guid CustomerId { get; set; }
    public User? Customer { get; set; }
    public decimal PaidPrice { get; set; }
    public decimal CashbackEarned { get; set; }
    public decimal CashbackUsed { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PendingPayment;
    public PaymentMethod? PaymentMethod { get; set; }
    public string? PaymentReference { get; set; }
    public string? ExternalPaymentId { get; set; }
    public string? VoucherCode { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
    public DateTime? RedeemedAt { get; set; }
    public byte[]? RowVersion { get; set; }
    public List<PaymentTransaction> Payments { get; set; } = new();
}

public class PaymentTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public string Provider { get; set; } = "mock";
    public string? ExternalReference { get; set; }
    public string? ExternalPaymentId { get; set; }
    public PaymentMethod Method { get; set; }
    public decimal Amount { get; set; }
    public PaymentStatus Status { get; set; }
    public string? StatusDetail { get; set; }
    public string? ResponsePayload { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSyncedAt { get; set; }
}

public class CashbackEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid? OrderId { get; set; }
    public Order? Order { get; set; }
    public CashbackEntryType Type { get; set; }
    public decimal Amount { get; set; }
    public string Description { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Avaliação de um produto por um cliente que já resgatou.</summary>
public class Review
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public Product? Product { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public int Rating { get; set; } // 1..5
    public string Comment { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class AssistantLead
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? UserId { get; set; }
    public string? Profile { get; set; }
    public string? Category { get; set; }
    public string? Goal { get; set; }
    public string? MainIntent { get; set; }
    public int Score { get; set; }
    public LeadTemperature Temperature { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public List<BotInteraction> Interactions { get; set; } = new();
}

public class BotInteraction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? LeadId { get; set; }
    public AssistantLead? Lead { get; set; }
    public string UserMessage { get; set; } = string.Empty;
    public string BotResponse { get; set; } = string.Empty;
    public string Step { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Notification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Channel { get; set; } = "interno";
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Evento de webhook de pagamento recebido (rastreabilidade + dedupe).</summary>
public class PaymentEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Provider { get; set; } = "mercado_pago";
    public string EventType { get; set; } = string.Empty;
    public string? ExternalId { get; set; }
    public Guid? OrderId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? RawPayload { get; set; }
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>Credencial/configuração de integração editável em runtime.
/// Quando presente, sobrepõe o valor do .env/appsettings.</summary>
public class IntegrationSetting
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public Guid? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? ActorId { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
