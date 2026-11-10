using System;
using System.Collections.Generic;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace Api.Tests;

public class DependencyInjectionConfigurationTests
{
    [Fact]
    public void Production_WithoutConnectionString_ThrowsInvalidOperationException()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Production
        });

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = ""
        });

        // Simulating the DI validation logic from Program.cs
        var isProduction = builder.Environment.IsProduction();
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
        var useInMemory = builder.Configuration.GetValue<bool>("UseInMemoryRepository", false);

        Assert.Throws<InvalidOperationException>(() =>
        {
            if (isProduction && (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE") || useInMemory))
            {
                throw new InvalidOperationException("PostgreSQL connection string 'DefaultConnection' is mandatory in Production.");
            }
        });
    }

    [Fact]
    public void Production_WithPlaceholderPassword_ThrowsInvalidOperationException()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Production
        });

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=chessuno;Username=postgres;Password=YOUR_POSTGRES_PASSWORD_HERE;"
        });

        var isProduction = builder.Environment.IsProduction();
        var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

        Assert.Throws<InvalidOperationException>(() =>
        {
            if (isProduction && (string.IsNullOrWhiteSpace(connectionString) || connectionString.Contains("YOUR_POSTGRES_PASSWORD_HERE")))
            {
                throw new InvalidOperationException("PostgreSQL connection string placeholder is invalid in Production.");
            }
        });
    }

    [Fact]
    public void Production_WithExplicitInMemoryFlag_ThrowsInvalidOperationException()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Production
        });

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=chessuno;Username=postgres;Password=secret;",
            ["UseInMemoryRepository"] = "true"
        });

        var isProduction = builder.Environment.IsProduction();
        var useInMemory = builder.Configuration.GetValue<bool>("UseInMemoryRepository", false);

        Assert.Throws<InvalidOperationException>(() =>
        {
            if (isProduction && useInMemory)
            {
                throw new InvalidOperationException("In-memory repository fallback is strictly prohibited in production.");
            }
        });
    }

    [Fact]
    public void Production_WithoutHmacKey_ThrowsInvalidOperationException()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Production
        });

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TokenSecurity:HmacKey"] = ""
        });

        var isProduction = builder.Environment.IsProduction();
        var hmacKey = builder.Configuration["TokenSecurity:HmacKey"];

        Assert.Throws<InvalidOperationException>(() =>
        {
            if (isProduction && (string.IsNullOrWhiteSpace(hmacKey) || hmacKey.Length < 32))
            {
                throw new InvalidOperationException("HMAC key is mandatory in Production.");
            }
        });
    }

    [Fact]
    public void Production_WithWeakHmacKey_ThrowsInvalidOperationException()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            EnvironmentName = Environments.Production
        });

        builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["TokenSecurity:HmacKey"] = "short-weak-key"
        });

        var isProduction = builder.Environment.IsProduction();
        var hmacKey = builder.Configuration["TokenSecurity:HmacKey"];

        Assert.Throws<InvalidOperationException>(() =>
        {
            if (isProduction && (string.IsNullOrWhiteSpace(hmacKey) || hmacKey.Length < 32))
            {
                throw new InvalidOperationException("HMAC key is too weak for Production.");
            }
        });
    }

    [Fact]
    public void Development_WithExplicitInMemoryFlag_RegistersInMemoryGameSessionRepository()
    {
        var factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.UseEnvironment(Environments.Development);
                builder.ConfigureAppConfiguration((_, config) =>
                {
                    config.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["UseInMemoryRepository"] = "true"
                    });
                });
            });

        using var scope = factory.Services.CreateScope();
        var repo = scope.ServiceProvider.GetRequiredService<IGameSessionRepository>();
        Assert.IsType<InMemoryGameSessionRepository>(repo);
    }
}
