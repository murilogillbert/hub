using System.Globalization;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using OpenDriverHub.Api.Infra;
using OpenDriverHub.Application;
using OpenDriverHub.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var cfg = builder.Configuration;

var jwt = new JwtOptions
{
    Secret = cfg["Jwt:Secret"] ?? "dev-only-secret-change-me-please-32bytes-min",
    AccessTtl = TimeSpan.Parse(cfg["Jwt:AccessTtl"] ?? "02:00:00"),
    RefreshTtl = TimeSpan.Parse(cfg["Jwt:RefreshTtl"] ?? "7.00:00:00"),
};
var connStr = cfg.GetConnectionString("Default")
    ?? "Server=localhost,1433;Database=OpenDriverHub;User Id=sa;Password=Strong_Local_Pwd_123!;TrustServerCertificate=True";
var paymentProvider = cfg["Payment:Provider"] ?? "mock";
var corsOrigins = (cfg["Cors:Origins"] ?? "http://localhost:5173")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

// Diretório de uploads (servido estaticamente em /uploads).
var uploadDir = cfg["Storage:UploadDir"];
uploadDir = string.IsNullOrWhiteSpace(uploadDir)
    ? Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads")
    : Path.GetFullPath(uploadDir);
Directory.CreateDirectory(uploadDir);
builder.Services.AddSingleton(new UploadOptions(
    uploadDir,
    long.TryParse(cfg["Storage:MaxImageBytes"], out var mb) ? mb : 5 * 1024 * 1024));

builder.Services.AddInfrastructure(connStr, jwt, paymentProvider);
builder.Services.AddHttpClient();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IHttpContextAccessorLike, HttpContextAccessorAdapter>();
builder.Services.AddHostedService<PaymentReconciliationService>();

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

// Confia em proxy reverso para obter o IP real (rate limit / webhook).
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownNetworks.Clear();
    o.KnownProxies.Clear();
});

// Rate limiting: política "auth" por IP (anti força-bruta em /auth).
var authPermit = int.TryParse(cfg["RateLimit:Auth:PermitLimit"], out var pl) ? pl : 5;
var authWindow = int.TryParse(cfg["RateLimit:Auth:WindowSeconds"], out var ws) ? ws : 60;
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authPermit,
                Window = TimeSpan.FromSeconds(authWindow),
                QueueLimit = 0,
            }));
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, token) =>
    {
        ctx.HttpContext.Response.ContentType = "application/json";
        if (ctx.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
            ctx.HttpContext.Response.Headers.RetryAfter =
                ((int)retry.TotalSeconds).ToString(CultureInfo.InvariantCulture);
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Muitas tentativas. Aguarde alguns instantes e tente novamente." },
            token);
    };
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Secret)),
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Client", p => p.RequireRole("Client", "Admin"))
    .AddPolicy("Partner", p => p.RequireRole("Partner", "Admin"))
    .AddPolicy("Admin", p => p.RequireRole("Admin"));

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    // Seed demo só roda quando Seed:Enabled=true; dados reais devem vir do admin/parceiro.
    var seedDemo = cfg.GetValue<bool?>("Seed:Enabled")
        ?? false;
    await Seeder.SeedAsync(db, hasher, seedDemo);
}

app.UseForwardedHeaders();
app.UseMiddleware<ExceptionMiddleware>();
if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// Serve as imagens enviadas em /uploads.
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadDir),
    RequestPath = "/uploads",
});

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();
