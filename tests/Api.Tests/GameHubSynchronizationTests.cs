using System;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Xunit;

namespace Api.Tests;

public class GameHubSynchronizationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly System.Net.Http.HttpClient _httpClient;

    public GameHubSynchronizationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _httpClient = factory.CreateClient();
    }

    private HubConnection CreateHubConnection()
    {
        return new HubConnectionBuilder()
            .WithUrl(new Uri(_factory.Server.BaseAddress, "/hubs/game"), options =>
            {
                options.HttpMessageHandlerFactory = _ => _factory.Server.CreateHandler();
            })
            .Build();
    }

    [Fact]
    public async Task RevisionMismatch_TriggersActionRejectedEvent()
    {
        // 1. Create Game
        var createRes = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice", Seed = 42 });
        var created = await createRes.Content.ReadFromJsonAsync<CreateGameResponse>();

        await using var connectionA = CreateHubConnection();
        var rejectedTcs = new TaskCompletionSource<ActionRejectedDto>();

        connectionA.On<ActionRejectedDto>("ActionRejected", rejected =>
        {
            rejectedTcs.TrySetResult(rejected);
        });

        await connectionA.StartAsync();
        await connectionA.InvokeAsync<bool>("JoinGameRoom", created!.GameId, created.PlayerToken);

        // Submit move with expectedRevision = 999 (mismatch)
        var result = await connectionA.InvokeAsync<bool>(
            "SubmitMoveWithIdempotency", created.GameId, created.PlayerToken, "e2", "e4", null, "act-rev-test", 999);

        Assert.False(result);

        var completedTask = await Task.WhenAny(rejectedTcs.Task, Task.Delay(5000));
        Assert.Equal(rejectedTcs.Task, completedTask);

        var rejection = await rejectedTcs.Task;
        Assert.Equal("REVISION_MISMATCH", rejection.Reason);
        Assert.Equal(999, rejection.ExpectedRevision);
    }

    [Fact]
    public async Task IdempotentAction_ReturnsSuccessWithoutDuplicatingExecution()
    {
        var createRes = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice", Seed = 42 });
        var created = await createRes.Content.ReadFromJsonAsync<CreateGameResponse>();

        var joinRes = await _httpClient.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = created!.InvitationToken,
            PlayerName = "Bob"
        });
        Assert.True(joinRes.IsSuccessStatusCode);

        await using var connectionA = CreateHubConnection();
        await connectionA.StartAsync();
        await connectionA.InvokeAsync<bool>("JoinGameRoom", created.GameId, created.PlayerToken);

        const string actionId = "client-retry-uuid-777";

        // First attempt to draw card
        var firstResult = await connectionA.InvokeAsync<bool>("DrawCardWithIdempotency", created.GameId, created.PlayerToken, actionId, null);
        Assert.True(firstResult);

        // Network retry with exact same actionId
        var retryResult = await connectionA.InvokeAsync<bool>("DrawCardWithIdempotency", created.GameId, created.PlayerToken, actionId, null);
        Assert.True(retryResult);
    }

    [Fact]
    public async Task PlayerDisconnection_NotifiesOpponent()
    {
        // 1. Create & Join Game
        var createRes = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice", Seed = 42 });
        var created = await createRes.Content.ReadFromJsonAsync<CreateGameResponse>();

        var joinRes = await _httpClient.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = created!.InvitationToken,
            PlayerName = "Bob"
        });
        var joined = await joinRes.Content.ReadFromJsonAsync<JoinGameResponse>();

        // 2. Connect both
        await using var connectionA = CreateHubConnection();
        await using var connectionB = CreateHubConnection();

        var disconnectTcs = new TaskCompletionSource<PlayerDisconnectedDto>();
        connectionA.On<PlayerDisconnectedDto>("PlayerDisconnected", info =>
        {
            disconnectTcs.TrySetResult(info);
        });

        await connectionA.StartAsync();
        await connectionA.InvokeAsync<bool>("JoinGameRoom", created.GameId, created.PlayerToken);

        await connectionB.StartAsync();
        await connectionB.InvokeAsync<bool>("JoinGameRoom", joined!.GameId, joined.PlayerToken);

        // Disconnect Player B
        await connectionB.StopAsync();

        // Player A should be notified of Player B disconnecting
        var completedTask = await Task.WhenAny(disconnectTcs.Task, Task.Delay(5000));
        Assert.Equal(disconnectTcs.Task, completedTask);

        var disconnected = await disconnectTcs.Task;
        Assert.Equal("Bob", disconnected.PlayerName);
        Assert.Equal("Black", disconnected.Color);
    }
}

public record ActionRejectedDto(string Reason, int CurrentRevision, int? ExpectedRevision);
public record PlayerDisconnectedDto(string PlayerName, string Color);
