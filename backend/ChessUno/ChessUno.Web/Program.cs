using ChessUno.Core.Sessions;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSignalR();

// Register session repository as singleton in memory
builder.Services.AddSingleton<IGameSessionRepository, InMemoryGameSessionRepository>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .SetIsOriginAllowed(_ => true)
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();
app.UseRouting();

app.MapControllers();
app.MapHub<ChessUno.Web.Hubs.GameHub>("/hubs/game");

app.Run();

// Make public for WebApplicationFactory in tests
public partial class Program { }
