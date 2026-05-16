using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDriverHub.Api.Infra;
using OpenDriverHub.Application;

namespace OpenDriverHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "Partner")]
[Route("api/v1/partner")]
public class PartnerController : ControllerBase
{
    private readonly IPartnerService _partner;
    public PartnerController(IPartnerService partner) => _partner = partner;

    [HttpGet("products")]
    public async Task<IActionResult> Products(CancellationToken ct)
        => Ok(new ApiEnvelope<List<ProductDto>>(
            await _partner.MyProductsAsync(User.PartnerId(), ct)));

    [HttpPost("products")]
    public async Task<IActionResult> Create(ProductUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<ProductDto>(
            await _partner.CreateProductAsync(User.PartnerId(), req, ct)));

    [HttpPut("products/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ProductUpsertRequest req, CancellationToken ct)
        => Ok(new ApiEnvelope<ProductDto>(
            await _partner.UpdateProductAsync(User.PartnerId(), id, req, ct)));

    [HttpDelete("products/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _partner.DeleteProductAsync(User.PartnerId(), id, ct);
        return NoContent();
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> Metrics(CancellationToken ct)
        => Ok(new ApiEnvelope<PartnerMetricsDto>(
            await _partner.MetricsAsync(User.PartnerId(), ct)));

    /// <summary>Valida o voucher (confirm=false) ou efetua o resgate (confirm=true).</summary>
    [HttpPost("redeem")]
    public async Task<IActionResult> Redeem(RedeemRequest req,
        [FromQuery] bool confirm, CancellationToken ct)
        => Ok(new ApiEnvelope<RedeemResult>(await _partner.RedeemAsync(
            User.PartnerId(), User.UserId(), req.Code, confirm, ct)));
}
