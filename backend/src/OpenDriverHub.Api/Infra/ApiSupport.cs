using System.Security.Claims;
using OpenDriverHub.Application;
using OpenDriverHub.Infrastructure;

namespace OpenDriverHub.Api.Infra;

/// <summary>Configuração de upload de imagens.</summary>
public record UploadOptions(string Directory, long MaxBytes);

/// <summary>Adapta IHttpContextAccessor para a abstração da Infrastructure.</summary>
public class HttpContextAccessorAdapter : IHttpContextAccessorLike
{
    private readonly IHttpContextAccessor _accessor;
    public HttpContextAccessorAdapter(IHttpContextAccessor accessor) => _accessor = accessor;
    public ClaimsPrincipal? User => _accessor.HttpContext?.User;
}

/// <summary>Converte AppException em ProblemDetails JSON.</summary>
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _log;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> log)
    {
        _next = next; _log = log;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (AppException ex)
        {
            ctx.Response.StatusCode = ex.StatusCode;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Erro não tratado");
            ctx.Response.StatusCode = 500;
            ctx.Response.ContentType = "application/json";
            await ctx.Response.WriteAsJsonAsync(new { error = "Erro interno do servidor." });
        }
    }
}

/// <summary>Reconciliação periódica de pagamentos PIX pendentes (simula webhook).</summary>
public class PaymentReconciliationService : BackgroundService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<PaymentReconciliationService> _log;

    public PaymentReconciliationService(IServiceProvider sp, ILogger<PaymentReconciliationService> log)
    {
        _sp = sp; _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _sp.CreateScope();
                var payments = scope.ServiceProvider.GetRequiredService<IPaymentService>();
                await payments.ReconcilePendingAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha na reconciliação de pagamentos");
            }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}

public static class ClaimsExtensions
{
    public static Guid UserId(this ClaimsPrincipal user)
        => Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new AppException("Não autenticado.", 401);

    public static Guid PartnerId(this ClaimsPrincipal user)
        => Guid.TryParse(user.FindFirst("partnerId")?.Value, out var id)
            ? id
            : throw new AppException("Usuário não vinculado a um parceiro.", 403);
}
