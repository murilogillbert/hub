using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace OpenDriverHub.Infrastructure;

/// <summary>
/// Fábrica usada apenas em design-time pelo <c>dotnet ef</c> (migrations).
/// Evita subir o host da API (e o seed/Migrate do boot) ao gerar migrations.
/// A connection string aqui não precisa apontar para um banco real: o comando
/// <c>migrations add</c> não conecta — só <c>database update</c> conecta, e em
/// runtime a string vem de configuração (ver Program.cs / DependencyInjection).
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? "Server=localhost,1433;Database=OpenDriverHub;User Id=sa;Password=Strong_Local_Pwd_123!;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlServer(conn)
            .Options;

        return new AppDbContext(options);
    }
}
