using OpenDriverHub.Domain;

namespace OpenDriverHub.Application;

/// <summary>Erro de negócio com status HTTP associado.</summary>
public class AppException : Exception
{
    public int StatusCode { get; }
    public AppException(string message, int statusCode = 400) : base(message)
        => StatusCode = statusCode;
}

// ---------- Portas (implementadas na Infrastructure) ----------
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string hash);
}

public interface IJwtTokenService
{
    (string token, string refreshToken) Issue(User user);
    Guid? ValidateRefresh(string refreshToken);
}

public interface ICurrentUser
{
    Guid? Id { get; }
    UserRole? Role { get; }
    Guid? PartnerId { get; }
}

public interface IPaymentGateway
{
    string Provider { get; }
    Task<PaymentStatusSnapshot> ProcessAsync(Order order, decimal amount, PaymentMethod method, CardInput? card, CancellationToken ct);
    Task<PaymentStatusSnapshot?> SyncAsync(Order order, CancellationToken ct);
}

// ---------- Serviços de aplicação ----------
public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest req, CancellationToken ct);
    Task<AuthResponse> RegisterPartnerAsync(PartnerRegisterRequest req, CancellationToken ct);
    Task<AuthResponse> LoginAsync(LoginRequest req, CancellationToken ct);
    Task<AuthResponse> RefreshAsync(string refreshToken, CancellationToken ct);
    Task<UserDto> MeAsync(Guid userId, CancellationToken ct);
    Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest req, CancellationToken ct);
    Task UpdateNotificationsAsync(Guid userId, UpdateNotificationsRequest req, CancellationToken ct);
    Task ChangePasswordAsync(Guid userId, ChangePasswordRequest req, CancellationToken ct);
    Task<List<NotificationDto>> NotificationsAsync(Guid userId, CancellationToken ct);
}

public interface ICatalogService
{
    Task<List<ProductDto>> GetProductsAsync(string? category, string? q, Guid? partnerId, CancellationToken ct);
    Task<ProductDto> GetProductAsync(Guid id, CancellationToken ct);
    Task<List<StoreDto>> GetStoresAsync(Guid? partnerId, CancellationToken ct);
    Task<List<NearbyStoreDto>> GetNearbyStoresAsync(
        double lat, double lng, double radiusKm, int limit, CancellationToken ct);
    Task<List<PartnerDto>> GetPartnersAsync(CancellationToken ct);
    Task<PartnerDto> GetPartnerAsync(Guid id, CancellationToken ct);
    Task<CatalogPage> SearchAsync(CatalogQuery query, CancellationToken ct);
    Task<CatalogFiltersDto> GetFiltersAsync(CancellationToken ct);
    Task<List<CategoryDto>> GetActiveCategoriesAsync(string type, CancellationToken ct);
}

public interface ICategoryService
{
    Task<List<CategoryDto>> ListAsync(CancellationToken ct);
    Task<CategoryDto> CreateAsync(CategoryUpsertRequest req, CancellationToken ct);
    Task<CategoryDto> UpdateAsync(Guid id, CategoryUpsertRequest req, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
}

public interface IStoreService
{
    Task<List<StoreDto>> ListForAdminAsync(Guid? partnerId, CancellationToken ct);
    Task<List<StoreDto>> ListForPartnerAsync(Guid partnerId, CancellationToken ct);
    Task<StoreDto> CreateForAdminAsync(StoreUpsertRequest req, CancellationToken ct);
    Task<StoreDto> CreateForPartnerAsync(Guid partnerId, StoreUpsertRequest req, CancellationToken ct);
    Task<StoreDto> UpdateForAdminAsync(Guid id, StoreUpsertRequest req, CancellationToken ct);
    Task<StoreDto> UpdateForPartnerAsync(Guid partnerId, Guid id, StoreUpsertRequest req, CancellationToken ct);
    Task DeleteForAdminAsync(Guid id, CancellationToken ct);
    Task DeleteForPartnerAsync(Guid partnerId, Guid id, CancellationToken ct);
}

public interface IPartnerService
{
    Task<List<ProductDto>> MyProductsAsync(Guid partnerId, CancellationToken ct);
    Task<ProductDto> CreateProductAsync(Guid partnerId, ProductUpsertRequest req, CancellationToken ct);
    Task<ProductDto> UpdateProductAsync(Guid partnerId, Guid productId, ProductUpsertRequest req, CancellationToken ct);
    Task DeleteProductAsync(Guid partnerId, Guid productId, CancellationToken ct);
    Task<PartnerMetricsDto> MetricsAsync(Guid partnerId, CancellationToken ct);
    Task<RedeemResult> RedeemAsync(Guid partnerId, Guid actorId, string code, bool confirm, CancellationToken ct);
}

public interface IOrderService
{
    Task<OrderDto> CreateAsync(Guid customerId, CreateOrderRequest req, CancellationToken ct);
    Task<List<OrderDto>> MyOrdersAsync(Guid customerId, string? status, CancellationToken ct);
    Task<OrderDto> GetMyOrderAsync(Guid customerId, Guid orderId, CancellationToken ct);
    Task<List<CashbackEntryDto>> CashbackEntriesAsync(Guid customerId, CancellationToken ct);
}

public interface IPaymentService
{
    Task<PaymentStatusSnapshot> ProcessAsync(Guid customerId, ProcessPaymentRequest req, CancellationToken ct);
    Task<PaymentStatusSnapshot> StatusAsync(Guid orderId, CancellationToken ct);
    Task ReconcilePendingAsync(CancellationToken ct);
    /// <summary>Reconcilia um pagamento a partir de um id externo (webhook). Idempotente.</summary>
    Task<string> ReconcileByExternalAsync(string externalId, string eventType, string? rawPayload, CancellationToken ct);
}

public interface IAssistantService
{
    Task<AssistantLeadDto> CreateLeadAsync(Guid? userId, AssistantLeadInput input, CancellationToken ct);
    Task RecordInteractionAsync(BotInteractionInput input, CancellationToken ct);
    Task<List<AssistantLeadDto>> ListLeadsAsync(CancellationToken ct);
    Task<AssistantChatResponse> ChatAsync(AssistantChatRequest req, Guid? userId, CancellationToken ct);
}

/// <summary>Resolve uma credencial: valor do banco (se houver) senão o .env/appsettings.</summary>
public interface ISettingsProvider
{
    Task<string?> GetAsync(string key, CancellationToken ct = default);
}

public interface ISettingsService
{
    Task<List<IntegrationGroupDto>> GetGroupsAsync(CancellationToken ct);
    Task UpdateAsync(Guid actorId, UpdateSettingRequest req, CancellationToken ct);
}

public interface IAdminService
{
    Task<AdminMetricsDto> MetricsAsync(CancellationToken ct);
    Task<PagedResult<OrderDto>> SalesAsync(
        Guid? partnerId, string? status, string? q, int page, int pageSize, CancellationToken ct);
    Task<PagedResult<PartnerDto>> PartnersAsync(int page, int pageSize, CancellationToken ct);
    Task<PartnerDto> CreatePartnerAsync(PartnerUpsertRequest req, CancellationToken ct);
    Task<PartnerDto> UpdatePartnerAsync(Guid id, PartnerUpsertRequest req, CancellationToken ct);
    Task DeletePartnerAsync(Guid id, CancellationToken ct);
    Task<PagedResult<UserDto>> UsersAsync(string? q, int page, int pageSize, CancellationToken ct);
    Task<UserDto> CreateUserAsync(AdminUserCreateRequest req, CancellationToken ct);
    Task<UserDto> UpdateUserAsync(Guid id, AdminUserUpdateRequest req, CancellationToken ct);
    Task<PagedResult<AuditLogDto>> AuditLogsAsync(
        DateTime? from, DateTime? to, Guid? userId, string? action,
        int page, int pageSize, CancellationToken ct);
}
