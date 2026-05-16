using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using OpenDriverHub.Api.Infra;
using OpenDriverHub.Application;

namespace OpenDriverHub.Api.Controllers;

[ApiController]
[Authorize(Policy = "Partner")] // Parceiro ou Admin
[Route("api/v1/uploads")]
public class UploadsController : ControllerBase
{
    private readonly UploadOptions _opt;
    public UploadsController(UploadOptions opt) => _opt = opt;

    public record UploadResult(string Url);

    [HttpPost("image")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    public async Task<IActionResult> Image(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppException("Nenhum arquivo enviado.", 400);
        if (file.Length > _opt.MaxBytes)
            throw new AppException(
                $"Arquivo muito grande (máx. {_opt.MaxBytes / (1024 * 1024)} MB).", 413);

        // Detecta o tipo pelos magic bytes (não confia no content-type do cliente).
        var header = new byte[12];
        await using (var s = file.OpenReadStream())
        {
            var read = await s.ReadAsync(header.AsMemory(0, 12), ct);
            if (read < 12) throw new AppException("Arquivo inválido.", 415);
        }

        var ext = DetectExtension(header)
            ?? throw new AppException(
                "Formato não suportado. Use JPEG, PNG ou WEBP.", 415);

        var name = $"{Guid.NewGuid():N}{ext}";
        var fullPath = Path.Combine(_opt.Directory, name);
        await using (var dest = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(dest, ct);
        }

        return Ok(new ApiEnvelope<UploadResult>(new UploadResult($"/uploads/{name}")));
    }

    private static string? DetectExtension(byte[] h)
    {
        // JPEG: FF D8 FF
        if (h[0] == 0xFF && h[1] == 0xD8 && h[2] == 0xFF) return ".jpg";
        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (h[0] == 0x89 && h[1] == 0x50 && h[2] == 0x4E && h[3] == 0x47)
            return ".png";
        // WEBP: "RIFF"...."WEBP"
        if (h[0] == 0x52 && h[1] == 0x49 && h[2] == 0x46 && h[3] == 0x46 &&
            h[8] == 0x57 && h[9] == 0x45 && h[10] == 0x42 && h[11] == 0x50)
            return ".webp";
        return null;
    }
}
