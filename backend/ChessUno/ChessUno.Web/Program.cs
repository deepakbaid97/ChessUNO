using System;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSignalR();

// Persistence Configuration
var isProduction = builder.Environment.IsProduction();
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
var useInMemory = builder.Configuration.GetValue<bool>("UseInMemoryRepository", false);

if (isProduction)
{
    if (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE") || useInMemory)
    {
        throw new InvalidOperationException(
            "FATAL CONFIGURATION ERROR: PostgreSQL connection string 'DefaultConnection' is mandatory in Production. Fallback to in-memory repository is strictly prohibited in production environments.");
    }
}

if (!string.IsNullOrWhiteSpace(connectionString) && !useInMemory && !connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE"))
{
    Console.WriteLine("[ChessUNO Startup] Initializing persistent PostgreSQL Game Session Repository.");
    builder.Services.AddDbContextFactory<ChessUnoDbContext>(options =>
        options.UseNpgsql(connectionString));

    builder.Services.AddSingleton<IGameSessionRepository>(sp =>
    {
        var factory = sp.GetRequiredService<IDbContextFactory<ChessUnoDbContext>>();
        using var initDb = factory.CreateDbContext();
        initDb.Database.Migrate();
        return new PostgreSqlGameSessionRepository(factory);
    });
}
else
{
    if (isProduction)
    {
        throw new InvalidOperationException("In-memory game session repository cannot be registered in Production.");
    }
    Console.WriteLine("[ChessUNO Startup] Initializing volatile InMemory Game Session Repository (Development/Testing only).");
    builder.Services.AddSingleton<IGameSessionRepository, InMemoryGameSessionRepository>();
}

// Configurable CORS with explicit allowlist (no wildcards in production)
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [
    "http://localhost:5173",
    "https://localhost:5173",
    "http://localhost:4173",
    "https://localhost:4173"
];

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();
app.UseRouting();

app.MapControllers();
app.MapHub<ChessUno.Web.Hubs.GameHub>("/hubs/game");
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }));

app.Run();

// Make public for WebApplicationFactory in tests
public partial class Program { }
