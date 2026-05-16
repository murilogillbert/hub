using OpenDriverHub.Domain;

namespace OpenDriverHub.Application;

public record ApiEnvelope<T>(T Data);

// ---------- Auth ----------
public record RegisterRequest(string Name, string Email, string Password, string? Cpf, string? Phone);
public record PartnerRegisterRequest(
    string Name, string Email, string Password, string? Phone,
    string StoreName, string Segment);
public record LoginRequest(string Email, string Password);
public record RefreshRequest(string RefreshToken);
public record UserDto(
    Guid Id, string Name, string Email, string Role, decimal CashbackBalance,
    string? AvatarUrl, Guid? PartnerId);
public record AuthResponse(string Token, string RefreshToken, UserDto User);

// ---------- Catalog ----------
public record ProductDto(
    Guid Id, Guid PartnerId, string PartnerName, string Title, string Description,
    decimal Price, decimal CashbackPercent, string Kind, string ImageUrl,
    string Category, double Rating, int Stock,
    bool Digital, List<string> Cities, List<string> States);
public record ProductUpsertRequest(
    string Title, string Description, decimal Price, decimal CashbackPercent,
    string Kind, string ImageUrl, string Category, int Stock);
public record PartnerDto(
    Guid Id, string Name, string Segment, string LogoUrl, bool Active,
    decimal FeePercent, DateTime JoinedAt);
public record PartnerUpsertRequest(string Name, string Segment, string LogoUrl, decimal FeePercent, bool Active);
public record StoreDto(
    Guid Id, Guid PartnerId, string Name, string Address,
    string City, string State, double Lat, double Lng, string Category);

// Categorias (geridas pelo Admin)
public record CategoryDto(Guid Id, string Name, string Type, bool Active);
public record CategoryUpsertRequest(string Name, bool Active, string Type = "product");

// Catálogo e-commerce: filtros + paginação
public record CatalogQuery(
    string? Category, string? Q, string? City, string? State,
    decimal? MinPrice, decimal? MaxPrice, string? Sort,
    int Page, int PageSize);
public record CatalogPage(
    List<ProductDto> Items, int Total, int Page, int PageSize, int TotalPages);
public record CatalogFiltersDto(
    List<string> Categories, List<string> Cities, List<string> States,
    decimal MinPrice, decimal MaxPrice);
public record NearbyStoreDto(
    Guid Id, Guid PartnerId, string Name, string Address,
    double Lat, double Lng, string Category, double DistanceKm);

// ---------- Orders / Payments ----------
public record CreateOrderRequest(Guid ProductId, bool UseCashback = false);
public record OrderDto(
    Guid Id, string Code, Guid ProductId, string ProductTitle, Guid PartnerId,
    string PartnerName, Guid CustomerId, string CustomerName, decimal PaidPrice,
    decimal CashbackEarned, decimal CashbackUsed, string Status,
    DateTime CreatedAt, DateTime? RedeemedAt);
public record ProcessPaymentRequest(Guid OrderId, string Method, CardInput? Card);
public record CardInput(string Number, string Holder, string Expiry, string Cvv);
public record PixPayload(string QrCode, string CopiaECola, string TicketUrl, DateTime ExpiresAt);
public record PaymentStatusSnapshot(
    Guid OrderId, string? PaymentId, string? PaymentReference, string PaymentStatus,
    string? StatusDetail, string? VoucherCode, string OrderStatus, PixPayload? Pix);

// ---------- Redeem ----------
public record RedeemRequest(string Code);
public record RedeemResult(
    Guid OrderId, string ProductTitle, string CustomerName, decimal PaidPrice,
    decimal FeePercent, decimal PlatformFee, decimal CustomerCashback,
    decimal PartnerNet, bool Redeemed);

// ---------- Assistant ----------
public record AssistantLeadInput(
    string? Profile, string? Category, string? Goal, string? MainIntent,
    int Score, string Temperature);
public record AssistantLeadDto(Guid Id, AssistantLeadInput Lead, DateTime CreatedAt);
public record BotInteractionInput(
    string MensagemUsuario, string RespostaBot, string EtapaFluxo,
    Guid? LeadId, AssistantLeadInput Lead);

public record ChatMessage(string Role, string Content);
public record AssistantChatRequest(List<ChatMessage> Messages);
public record AssistantChatResponse(string Reply, bool Fallback);

// ---------- Profile ----------
public record UpdateProfileRequest(string Name, string Email, string? Phone);
public record UpdateNotificationsRequest(bool WhatsApp, bool Email, bool Promo);

// ---------- Integration settings ----------
public record IntegrationFieldDto(
    string Key,
    string Label,
    bool Secret,
    bool HasValue,
    string Preview,
    string Source); // "db" (personalizado) | "env" (.env/appsettings) | "unset"
public record IntegrationGroupDto(
    string Id, string Name, string Description, string Icon,
    bool Connected, List<IntegrationFieldDto> Fields);
public record UpdateSettingRequest(string Key, string? Value);

// ---------- Metrics ----------
public record SeriesPoint(string Label, decimal Value);
/// <summary>Item nomeado com valor (R$) e quantidade — categorias, métodos, produtos, leads.</summary>
public record NamedValue(string Name, decimal Value, int Count);
public record TopPartner(Guid PartnerId, string PartnerName, decimal Revenue);

public record PartnerMetricsDto(
    decimal TotalRevenue,
    int TotalSales,
    decimal PendingTransfer,
    decimal PaidTransfer,
    decimal AverageTicket,
    decimal CashbackGranted,
    int UniqueCustomers,
    int PendingCount,
    int PaidCount,
    int RedeemedCount,
    decimal RedemptionRate,
    List<SeriesPoint> SalesByHour,
    List<SeriesPoint> RevenueLastDays,
    List<NamedValue> TopProducts,
    List<NamedValue> SalesByCategory,
    List<NamedValue> PaymentMethods);

public record AdminMetricsDto(
    decimal Gmv,
    decimal NetRevenue,
    int Customers,
    int Partners,
    int ActivePartners,
    int OrdersToday,
    decimal AverageTicket,
    decimal CashbackOutstanding,
    int NewCustomers30d,
    int PendingCount,
    int PaidCount,
    int RedeemedCount,
    int CancelledCount,
    decimal PaymentConversion,
    decimal RedemptionRate,
    List<SeriesPoint> RevenueByMonth,
    List<TopPartner> TopPartners,
    List<NamedValue> SalesByCategory,
    List<NamedValue> PaymentMethods,
    List<NamedValue> LeadsByTemperature);
