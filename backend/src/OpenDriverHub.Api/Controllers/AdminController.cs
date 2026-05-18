using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDriverHub.Api.Infra;
using OpenDriverHub.Application;

namespace OpenDriverHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "Admin")]
[Route("api/v1/admin")]
public class AdminController : ControllerBase
{
    private readonly IAdminService _admin;
    private readonly IAssistantService _assistant;
    private readonly ISettingsService _settings;
    private readonly ICategoryService _categories;
    private readonly IStoreService _stores;

    public AdminController(
        IAdminService admin,
        IAssistantService assistant,
        ISettingsService settings,
        ICategoryService categories,
        IStoreService stores)
    {
        _admin = admin; _assistant = assistant; _settings = settings;
        _categories = categories; _stores = stores;
    }

    [HttpGet("categories")]
    public async Task<IActionResult> Categories(CancellationToken ct)
        => Ok(new ApiEnvelope<List<CategoryDto>>(await _categories.ListAsync(ct)));

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory(CategoryUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<CategoryDto>(await _categories.CreateAsync(req, ct)));

    [HttpPut("categories/{id:guid}")]
    public async Task<IActionResult> UpdateCategory(Guid id, CategoryUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<CategoryDto>(await _categories.UpdateAsync(id, req, ct)));

    [HttpDelete("categories/{id:guid}")]
    public async Task<IActionResult> DeleteCategory(Guid id, CancellationToken ct)
    {
        await _categories.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpGet("integrations")]
    public async Task<IActionResult> Integrations(CancellationToken ct)
        => Ok(new ApiEnvelope<List<IntegrationGroupDto>>(
            await _settings.GetGroupsAsync(ct)));

    [HttpPut("integrations")]
    public async Task<IActionResult> UpdateIntegration(
        UpdateSettingRequest req, CancellationToken ct)
    {
        await _settings.UpdateAsync(User.UserId(), req, ct);
        return Ok(new ApiEnvelope<List<IntegrationGroupDto>>(
            await _settings.GetGroupsAsync(ct)));
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> Metrics(CancellationToken ct)
        => Ok(new ApiEnvelope<AdminMetricsDto>(await _admin.MetricsAsync(ct)));

    [HttpGet("sales")]
    public async Task<IActionResult> Sales([FromQuery] Guid? partnerId,
        [FromQuery] string? status, [FromQuery] string? q,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
        => Ok(new ApiEnvelope<PagedResult<OrderDto>>(
            await _admin.SalesAsync(partnerId, status, q, page, pageSize, ct)));

    [HttpGet("partners")]
    public async Task<IActionResult> Partners(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
        => Ok(new ApiEnvelope<PagedResult<PartnerDto>>(
            await _admin.PartnersAsync(page, pageSize, ct)));

    [HttpPost("partners")]
    public async Task<IActionResult> CreatePartner(PartnerUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<PartnerDto>(await _admin.CreatePartnerAsync(req, ct)));

    [HttpPut("partners/{id:guid}")]
    public async Task<IActionResult> UpdatePartner(Guid id, PartnerUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<PartnerDto>(await _admin.UpdatePartnerAsync(id, req, ct)));

    [HttpDelete("partners/{id:guid}")]
    public async Task<IActionResult> DeletePartner(Guid id, CancellationToken ct)
    {
        await _admin.DeletePartnerAsync(id, ct);
        return NoContent();
    }

    [HttpGet("payouts/summary")]
    public async Task<IActionResult> PayoutSummary(CancellationToken ct)
        => Ok(new ApiEnvelope<List<PartnerPayoutSummaryDto>>(
            await _admin.PayoutSummaryAsync(ct)));

    [HttpGet("payouts")]
    public async Task<IActionResult> Payouts(
        [FromQuery] Guid? partnerId, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(new ApiEnvelope<PagedResult<PartnerPayoutDto>>(
            await _admin.PayoutsAsync(partnerId, page, pageSize, ct)));

    [HttpPost("payouts")]
    public async Task<IActionResult> CreatePayout(
        CreatePayoutRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<PartnerPayoutDto>(
            await _admin.CreatePayoutAsync(User.UserId(), req, ct)));

    [HttpGet("stores")]
    public async Task<IActionResult> Stores([FromQuery] Guid? partnerId, CancellationToken ct)
        => Ok(new ApiEnvelope<List<StoreDto>>(
            await _stores.ListForAdminAsync(partnerId, ct)));

    [HttpPost("stores")]
    public async Task<IActionResult> CreateStore(StoreUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<StoreDto>(
            await _stores.CreateForAdminAsync(req, ct)));

    [HttpPut("stores/{id:guid}")]
    public async Task<IActionResult> UpdateStore(Guid id, StoreUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<StoreDto>(
            await _stores.UpdateForAdminAsync(id, req, ct)));

    [HttpDelete("stores/{id:guid}")]
    public async Task<IActionResult> DeleteStore(Guid id, CancellationToken ct)
    {
        await _stores.DeleteForAdminAsync(id, ct);
        return NoContent();
    }

    [HttpGet("users")]
    public async Task<IActionResult> Users(
        [FromQuery] string? q, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20, CancellationToken ct = default)
        => Ok(new ApiEnvelope<PagedResult<UserDto>>(
            await _admin.UsersAsync(q, page, pageSize, ct)));

    [HttpPost("users")]
    public async Task<IActionResult> CreateUser(
        AdminUserCreateRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<UserDto>(await _admin.CreateUserAsync(req, ct)));

    [HttpPut("users/{id:guid}")]
    public async Task<IActionResult> UpdateUser(
        Guid id, AdminUserUpdateRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<UserDto>(await _admin.UpdateUserAsync(id, req, ct)));

    [HttpGet("leads")]
    public async Task<IActionResult> Leads(CancellationToken ct)
        => Ok(new ApiEnvelope<List<AssistantLeadDto>>(
            await _assistant.ListLeadsAsync(ct)));

    [HttpGet("audit-logs")]
    public async Task<IActionResult> AuditLogs(
        [FromQuery] DateTime? from, [FromQuery] DateTime? to,
        [FromQuery] Guid? userId, [FromQuery] string? action,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
        => Ok(new ApiEnvelope<PagedResult<AuditLogDto>>(
            await _admin.AuditLogsAsync(from, to, userId, action, page, pageSize, ct)));
}
