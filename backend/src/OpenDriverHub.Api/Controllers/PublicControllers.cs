using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OpenDriverHub.Api.Infra;
using OpenDriverHub.Application;

namespace OpenDriverHub.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[EnableRateLimiting("auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    public AuthController(IAuthService auth) => _auth = auth;

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<AuthResponse>(await _auth.RegisterAsync(req, ct)));

    [HttpPost("register/partner")]
    public async Task<IActionResult> RegisterPartner(PartnerRegisterRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<AuthResponse>(await _auth.RegisterPartnerAsync(req, ct)));

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<AuthResponse>(await _auth.LoginAsync(req, ct)));

    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<AuthResponse>(await _auth.RefreshAsync(req.RefreshToken, ct)));

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
        => Ok(new ApiEnvelope<UserDto>(await _auth.MeAsync(User.UserId(), ct)));
}

[ApiController]
[Route("api/v1")]
public class CatalogController : ControllerBase
{
    private readonly ICatalogService _catalog;
    public CatalogController(ICatalogService catalog) => _catalog = catalog;

    [HttpGet("products")]
    public async Task<IActionResult> Products([FromQuery] string? category,
        [FromQuery] string? q, [FromQuery] Guid? partnerId, CancellationToken ct)
        => Ok(new ApiEnvelope<List<ProductDto>>(
            await _catalog.GetProductsAsync(category, q, partnerId, ct)));

    [HttpGet("products/{id:guid}")]
    public async Task<IActionResult> Product(Guid id, CancellationToken ct)
        => Ok(new ApiEnvelope<ProductDto>(await _catalog.GetProductAsync(id, ct)));

    [HttpGet("catalog")]
    public async Task<IActionResult> Catalog(
        [FromQuery] string? category, [FromQuery] string? q,
        [FromQuery] string? city, [FromQuery] string? state,
        [FromQuery] decimal? minPrice, [FromQuery] decimal? maxPrice,
        [FromQuery] string? sort, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(new ApiEnvelope<CatalogPage>(await _catalog.SearchAsync(
            new CatalogQuery(category, q, city, state, minPrice, maxPrice,
                sort, page, pageSize), ct)));

    [HttpGet("catalog/filters")]
    public async Task<IActionResult> CatalogFilters(CancellationToken ct)
        => Ok(new ApiEnvelope<CatalogFiltersDto>(await _catalog.GetFiltersAsync(ct)));

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken ct)
        => Ok(new ApiEnvelope<List<CategoryDto>>(
            await _catalog.GetActiveCategoriesAsync(ct)));

    [HttpGet("stores")]
    public async Task<IActionResult> Stores([FromQuery] Guid? partnerId, CancellationToken ct)
        => Ok(new ApiEnvelope<List<StoreDto>>(await _catalog.GetStoresAsync(partnerId, ct)));

    [HttpGet("stores/nearby")]
    public async Task<IActionResult> Nearby(
        [FromQuery] double lat, [FromQuery] double lng,
        [FromQuery] double radiusKm = 10, [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        if (lat is < -90 or > 90 || lng is < -180 or > 180)
            throw new AppException("Coordenadas inválidas.", 400);
        var r = Math.Clamp(radiusKm, 0.5, 50);
        var l = Math.Clamp(limit, 1, 50);
        return Ok(new ApiEnvelope<List<NearbyStoreDto>>(
            await _catalog.GetNearbyStoresAsync(lat, lng, r, l, ct)));
    }

    [HttpGet("partners")]
    public async Task<IActionResult> Partners(CancellationToken ct)
        => Ok(new ApiEnvelope<List<PartnerDto>>(await _catalog.GetPartnersAsync(ct)));

    [HttpGet("partners/{id:guid}")]
    public async Task<IActionResult> Partner(Guid id, CancellationToken ct)
        => Ok(new ApiEnvelope<PartnerDto>(await _catalog.GetPartnerAsync(id, ct)));
}

[ApiController]
[Authorize(Policy = "Client")]
[Route("api/v1")]
public class ClientController : ControllerBase
{
    private readonly IOrderService _orders;
    private readonly IPaymentService _payments;

    public ClientController(IOrderService orders, IPaymentService payments)
    {
        _orders = orders; _payments = payments;
    }

    [HttpPost("orders")]
    public async Task<IActionResult> Create(CreateOrderRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<OrderDto>(await _orders.CreateAsync(User.UserId(), req, ct)));

    [HttpGet("me/orders")]
    public async Task<IActionResult> MyOrders([FromQuery] string? status, CancellationToken ct)
        => Ok(new ApiEnvelope<List<OrderDto>>(
            await _orders.MyOrdersAsync(User.UserId(), status, ct)));

    [HttpGet("me/orders/{id:guid}")]
    public async Task<IActionResult> MyOrder(Guid id, CancellationToken ct)
        => Ok(new ApiEnvelope<OrderDto>(await _orders.GetMyOrderAsync(User.UserId(), id, ct)));

    [HttpPost("payments/process")]
    public async Task<IActionResult> Pay(ProcessPaymentRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<PaymentStatusSnapshot>(
            await _payments.ProcessAsync(User.UserId(), req, ct)));

    [HttpGet("orders/{id:guid}/payment-status")]
    public async Task<IActionResult> PayStatus(Guid id, CancellationToken ct)
        => Ok(new ApiEnvelope<PaymentStatusSnapshot>(await _payments.StatusAsync(id, ct)));
}

/// <summary>Perfil do usuário autenticado — qualquer papel (cliente, parceiro, admin).</summary>
[ApiController]
[Authorize]
[Route("api/v1")]
public class MeController : ControllerBase
{
    private readonly IAuthService _auth;
    public MeController(IAuthService auth) => _auth = auth;

    [HttpPut("me/profile")]
    public async Task<IActionResult> Profile(UpdateProfileRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<UserDto>(
            await _auth.UpdateProfileAsync(User.UserId(), req, ct)));

    [HttpPut("me/notifications")]
    public async Task<IActionResult> Notifications(UpdateNotificationsRequest req, CancellationToken ct)
    {
        await _auth.UpdateNotificationsAsync(User.UserId(), req, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/v1/assistant")]
public class AssistantController : ControllerBase
{
    private readonly IAssistantService _assistant;
    public AssistantController(IAssistantService assistant) => _assistant = assistant;

    [HttpPost("leads")]
    public async Task<IActionResult> CreateLead(AssistantLeadInput input, CancellationToken ct)
    {
        Guid? userId = Guid.TryParse(
            User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
            out var id) ? id : null;
        return Ok(new ApiEnvelope<AssistantLeadDto>(
            await _assistant.CreateLeadAsync(userId, input, ct)));
    }

    [HttpPost("interactions")]
    public async Task<IActionResult> Interaction(BotInteractionInput input, CancellationToken ct)
    {
        await _assistant.RecordInteractionAsync(input, ct);
        return NoContent();
    }

    [HttpPost("chat")]
    public async Task<IActionResult> Chat(AssistantChatRequest req, CancellationToken ct)
    {
        Guid? userId = Guid.TryParse(
            User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value,
            out var id) ? id : null;
        return Ok(new ApiEnvelope<AssistantChatResponse>(
            await _assistant.ChatAsync(req, userId, ct)));
    }
}
