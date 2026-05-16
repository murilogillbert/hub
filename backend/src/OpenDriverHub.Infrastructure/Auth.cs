using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure;

public class JwtOptions
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "opendriverhub";
    public string Audience { get; set; } = "opendriverhub";
    public TimeSpan AccessTtl { get; set; } = TimeSpan.FromHours(2);
    public TimeSpan RefreshTtl { get; set; } = TimeSpan.FromDays(7);
}

public class BcryptPasswordHasher : IPasswordHasher
{
    public string Hash(string password) => BCrypt.Net.BCrypt.HashPassword(password, 11);
    public bool Verify(string password, string hash) => BCrypt.Net.BCrypt.Verify(password, hash);
}

public class JwtTokenService : IJwtTokenService
{
    private readonly JwtOptions _opt;
    public JwtTokenService(JwtOptions opt) => _opt = opt;

    public (string token, string refreshToken) Issue(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_opt.Secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Name),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString()),
        };
        if (user.PartnerId is { } pid)
            claims.Add(new Claim("partnerId", pid.ToString()));

        var jwt = new JwtSecurityToken(
            issuer: _opt.Issuer, audience: _opt.Audience, claims: claims,
            expires: DateTime.UtcNow.Add(_opt.AccessTtl), signingCredentials: creds);

        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        var refresh = CreateRefresh(user.Id);
        return (token, refresh);
    }

    private string CreateRefresh(Guid userId)
    {
        var payload = $"{userId}|{DateTime.UtcNow.Add(_opt.RefreshTtl):O}";
        var sig = Convert.ToHexString(
            new HMACSHA256(Encoding.UTF8.GetBytes(_opt.Secret))
                .ComputeHash(Encoding.UTF8.GetBytes(payload)));
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{payload}|{sig}"));
    }

    public Guid? ValidateRefresh(string refreshToken)
    {
        try
        {
            var raw = Encoding.UTF8.GetString(Convert.FromBase64String(refreshToken));
            var parts = raw.Split('|');
            if (parts.Length != 3) return null;
            var payload = $"{parts[0]}|{parts[1]}";
            var expected = Convert.ToHexString(
                new HMACSHA256(Encoding.UTF8.GetBytes(_opt.Secret))
                    .ComputeHash(Encoding.UTF8.GetBytes(payload)));
            if (!CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(expected), Encoding.UTF8.GetBytes(parts[2])))
                return null;
            if (DateTime.Parse(parts[1]).ToUniversalTime() < DateTime.UtcNow) return null;
            return Guid.Parse(parts[0]);
        }
        catch { return null; }
    }
}

public class CurrentUser : ICurrentUser
{
    public Guid? Id { get; }
    public UserRole? Role { get; }
    public Guid? PartnerId { get; }

    public CurrentUser(IHttpContextAccessorLike accessor)
    {
        var p = accessor.User;
        if (p?.Identity?.IsAuthenticated != true) return;
        if (Guid.TryParse(p.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id)) Id = id;
        if (Enum.TryParse<UserRole>(p.FindFirst(ClaimTypes.Role)?.Value, out var r)) Role = r;
        if (Guid.TryParse(p.FindFirst("partnerId")?.Value, out var pid)) PartnerId = pid;
    }
}

/// <summary>Pequena abstração p/ não acoplar a Infra ao ASP.NET diretamente nos testes.</summary>
public interface IHttpContextAccessorLike
{
    ClaimsPrincipal? User { get; }
}
