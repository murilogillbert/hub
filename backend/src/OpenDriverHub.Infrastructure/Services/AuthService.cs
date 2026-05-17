using Microsoft.EntityFrameworkCore;
using OpenDriverHub.Application;
using OpenDriverHub.Domain;

namespace OpenDriverHub.Infrastructure.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher _hasher;
    private readonly IJwtTokenService _jwt;

    public AuthService(AppDbContext db, IPasswordHasher hasher, IJwtTokenService jwt)
    {
        _db = db; _hasher = hasher; _jwt = jwt;
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            throw new AppException("E-mail já cadastrado.", 409);

        var user = new User
        {
            Name = req.Name.Trim(),
            Email = email,
            PasswordHash = _hasher.Hash(req.Password),
            Role = UserRole.Client,
            Phone = req.Phone,
            AvatarUrl = $"https://api.dicebear.com/9.x/avataaars/svg?seed={Uri.EscapeDataString(req.Name)}",
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);
        return Build(user);
    }

    public async Task<AuthResponse> RegisterPartnerAsync(PartnerRegisterRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            throw new AppException("E-mail já cadastrado.", 409);

        var strategy = _db.Database.CreateExecutionStrategy();
        User created = null!;
        await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(ct);

            var partner = new Partner
            {
                Name = req.StoreName.Trim(),
                Segment = req.Segment.Trim(),
                FeePercent = 10m,
                Active = true,
                Cnpj = (req.Cnpj ?? "").Trim(),
                City = (req.City ?? "").Trim(),
                State = (req.State ?? "").Trim(),
                Lat = req.Lat ?? 0,
                Lng = req.Lng ?? 0,
                LogoUrl = $"https://api.dicebear.com/9.x/icons/svg?seed={Uri.EscapeDataString(req.StoreName)}&backgroundType=gradientLinear",
            };
            _db.Partners.Add(partner);

            var user = new User
            {
                Name = req.Name.Trim(),
                Email = email,
                PasswordHash = _hasher.Hash(req.Password),
                Role = UserRole.Partner,
                Phone = req.Phone,
                Partner = partner,
                AvatarUrl = $"https://api.dicebear.com/9.x/avataaars/svg?seed={Uri.EscapeDataString(req.Name)}",
            };
            _db.Users.Add(user);

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            created = user;
        });
        return Build(created);
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest req, CancellationToken ct)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email, ct)
            ?? throw new AppException("Credenciais inválidas.", 401);
        if (!_hasher.Verify(req.Password, user.PasswordHash))
            throw new AppException("Credenciais inválidas.", 401);
        return Build(user);
    }

    public async Task<AuthResponse> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var userId = _jwt.ValidateRefresh(refreshToken)
            ?? throw new AppException("Refresh token inválido.", 401);
        var user = await _db.Users.FindAsync([userId], ct)
            ?? throw new AppException("Usuário não encontrado.", 401);
        return Build(user);
    }

    public async Task<UserDto> MeAsync(Guid userId, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct)
            ?? throw new AppException("Usuário não encontrado.", 404);
        return user.ToDto();
    }

    public async Task<UserDto> UpdateProfileAsync(Guid userId, UpdateProfileRequest req, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct)
            ?? throw new AppException("Usuário não encontrado.", 404);
        user.Name = req.Name.Trim();
        user.Email = req.Email.Trim().ToLowerInvariant();
        user.Phone = req.Phone;
        if (!string.IsNullOrWhiteSpace(req.AvatarUrl))
            user.AvatarUrl = req.AvatarUrl.Trim();
        await _db.SaveChangesAsync(ct);
        return user.ToDto();
    }

    public async Task UpdateNotificationsAsync(Guid userId, UpdateNotificationsRequest req, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct)
            ?? throw new AppException("Usuário não encontrado.", 404);
        user.NotifyWhatsApp = req.WhatsApp;
        user.NotifyEmail = req.Email;
        user.NotifyPromo = req.Promo;
        await _db.SaveChangesAsync(ct);
    }

    public async Task ChangePasswordAsync(Guid userId, ChangePasswordRequest req, CancellationToken ct)
    {
        var user = await _db.Users.FindAsync([userId], ct)
            ?? throw new AppException("Usuario nao encontrado.", 404);
        if (!_hasher.Verify(req.CurrentPassword, user.PasswordHash))
            throw new AppException("Senha atual incorreta.", 400);
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            throw new AppException("A nova senha deve ter pelo menos 6 caracteres.", 400);
        user.PasswordHash = _hasher.Hash(req.NewPassword);
        await _db.SaveChangesAsync(ct);
    }

    public async Task<List<NotificationDto>> NotificationsAsync(Guid userId, CancellationToken ct)
        => (await _db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(20)
                .ToListAsync(ct))
            .Select(n => n.ToDto())
            .ToList();

    private AuthResponse Build(User user)
    {
        var (token, refresh) = _jwt.Issue(user);
        return new AuthResponse(token, refresh, user.ToDto());
    }
}
