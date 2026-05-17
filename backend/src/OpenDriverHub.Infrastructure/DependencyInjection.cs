using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenDriverHub.Application;
using OpenDriverHub.Infrastructure.Services;

namespace OpenDriverHub.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        string connectionString,
        JwtOptions jwtOptions,
        string paymentProvider)
    {
        services.AddDbContext<AppDbContext>(opt =>
            opt.UseSqlServer(connectionString, sql => sql.EnableRetryOnFailure()));

        services.AddSingleton(jwtOptions);
        services.AddSingleton<IPasswordHasher, BcryptPasswordHasher>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.AddScoped<ICurrentUser, CurrentUser>();

        if (paymentProvider.Equals("mercadopago", StringComparison.OrdinalIgnoreCase))
            services.AddScoped<IPaymentGateway, MercadoPagoGateway>();
        else
            services.AddScoped<IPaymentGateway, MockPaymentGateway>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<ICatalogService, CatalogService>();
        services.AddScoped<IPartnerService, PartnerService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IPaymentService, PaymentService>();
        services.AddScoped<IAssistantService, AssistantService>();
        services.AddScoped<IAdminService, AdminService>();
        services.AddScoped<ICategoryService, CategoryService>();
        services.AddScoped<IStoreService, StoreService>();
        services.AddScoped<IReviewService, ReviewService>();

        services.AddScoped<SettingsService>();
        services.AddScoped<ISettingsService>(sp => sp.GetRequiredService<SettingsService>());
        services.AddScoped<ISettingsProvider>(sp => sp.GetRequiredService<SettingsService>());

        return services;
    }
}
