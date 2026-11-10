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

// Database Context & Session Repository
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrEmpty(connectionString))
{
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
