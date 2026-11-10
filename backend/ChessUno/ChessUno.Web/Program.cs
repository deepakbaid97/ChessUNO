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

if (!isProduction && !string.IsNullOrWhiteSpace(connectionString) && connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE"))
{
    var envPassword = Environment.GetEnvironmentVariable("CHESSUNO_TEST_PASSWORD")
                      ?? Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");
    if (!string.IsNullOrWhiteSpace(envPassword))
    {
        connectionString = connectionString.Replace("YOUR_POSTGRES_PASSWORD_HERE", envPassword);
    }
}

// HMAC Token Security Key Configuration
var hmacKey = builder.Configuration["TokenSecurity:HmacKey"]
              ?? Environment.GetEnvironmentVariable("CHESSUNO_HMAC_KEY");
var prevHmacKey = builder.Configuration["TokenSecurity:PreviousHmacKey"]
                  ?? Environment.GetEnvironmentVariable("CHESSUNO_PREVIOUS_HMAC_KEY");

if (isProduction)
{
    if (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE") || useInMemory)
    {
        throw new InvalidOperationException(
            "FATAL CONFIGURATION ERROR: PostgreSQL connection string 'DefaultConnection' is mandatory in Production. Fallback to in-memory repository is strictly prohibited in production environments.");
    }

    if (string.IsNullOrWhiteSpace(hmacKey) || hmacKey.Length < 32 || hmacKey.Contains("DEVELOPMENT_ONLY"))
    {
        throw new InvalidOperationException(
            "FATAL CONFIGURATION ERROR: 'TokenSecurity:HmacKey' (or env 'CHESSUNO_HMAC_KEY') with at least 32 characters (256 bits) is mandatory in Production. Fallback to default or weak keys is strictly prohibited.");
    }
    TokenHasher.Initialize(hmacKey, prevHmacKey);
}
else
{
    if (!string.IsNullOrWhiteSpace(hmacKey) && hmacKey.Length >= 32)
    {
        TokenHasher.Initialize(hmacKey, prevHmacKey);
    }
    else
    {
        Console.WriteLine("[ChessUNO Startup] WARNING: Using ephemeral non-production HMAC key for Development/Testing.");
        TokenHasher.Initialize("ChessUnoDevTestHmacKeyMustBe32BytesMin!", prevHmacKey);
    }
}

if (!string.IsNullOrWhiteSpace(connectionString) && !connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE"))
{
    Console.WriteLine("[ChessUNO Startup] Initializing persistent PostgreSQL Game Session Repository.");
    builder.Services.AddDbContextFactory<ChessUnoDbContext>(options =>
        options.UseNpgsql(connectionString));

    builder.Services.AddSingleton<IGameSessionRepository>(sp =>
    {
        var config = sp.GetRequiredService<IConfiguration>();
        var env = sp.GetRequiredService<IHostEnvironment>();
        var inMem = config.GetValue<bool>("UseInMemoryRepository", false);
        if (inMem)
        {
            if (env.IsProduction())
            {
                throw new InvalidOperationException("In-memory game session repository cannot be registered in Production.");
            }
            return new InMemoryGameSessionRepository();
        }

        var factory = sp.GetRequiredService<IDbContextFactory<ChessUnoDbContext>>();
        using var initDb = factory.CreateDbContext();
        initDb.Database.Migrate();
        PostgreSqlGameSessionRepository.SanitizeAllExistingSnapshotsAsync(initDb).GetAwaiter().GetResult();
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
