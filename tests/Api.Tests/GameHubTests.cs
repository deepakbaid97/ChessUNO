using System;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Xunit;

namespace Api.Tests;

public class GameHubTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly System.Net.Http.HttpClient _httpClient;

    public GameHubTests(WebApplicationFactory<Program> factory)
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
    public async Task ConnectToGame_WithValidToken_ReceivesSnapshotAndJoinedEvent()
    {
        // 1. Create Game via API
        var createResponse = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        // 2. Connect to SignalR Hub
        await using var hubConnection = CreateHubConnection();
        var snapshotTcs = new TaskCompletionSource<GameSnapshotDto>();

        hubConnection.On<GameSnapshotDto>("GameStateSnapshot", snapshot =>
        {
            snapshotTcs.SetResult(snapshot);
        });

        await hubConnection.StartAsync();

        // 3. Authenticate / Join Room
        var joinResult = await hubConnection.InvokeAsync<bool>("JoinGameRoom", created!.GameId, created.PlayerToken);

        Assert.True(joinResult);

        var receivedSnapshot = await Task.WhenAny(snapshotTcs.Task, Task.Delay(5000));
        Assert.Equal(snapshotTcs.Task, receivedSnapshot);

        var snapshot = await snapshotTcs.Task;
        Assert.Equal(created.GameId, snapshot.GameId);
        Assert.NotNull(snapshot.BoardFen);
        Assert.Equal("White", snapshot.AssignedColor);
    }

    [Fact]
    public async Task ConnectToGame_WithInvalidToken_IsRejected()
    {
        var createResponse = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        await using var hubConnection = CreateHubConnection();
        await hubConnection.StartAsync();

        var joinResult = await hubConnection.InvokeAsync<bool>("JoinGameRoom", created!.GameId, "invalid-token-xyz");
        Assert.False(joinResult);
    }

    [Fact]
    public async Task WebRtcSignaling_RelaysOfferToOpponent()
    {
        // 1. Create & Join Game (2 players)
        var createResponse = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        var joinResponse = await _httpClient.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = created!.InvitationToken,
            PlayerName = "Bob"
        });
        var joined = await joinResponse.Content.ReadFromJsonAsync<JoinGameResponse>();

        // 2. Connect both players to SignalR
        await using var connectionA = CreateHubConnection();
        await using var connectionB = CreateHubConnection();

        var offerTcs = new TaskCompletionSource<string>();

        connectionB.On<string, string>("ReceiveSignal", (signalType, payload) =>
        {
            if (signalType == "offer")
            {
                offerTcs.SetResult(payload);
            }
        });

        await connectionA.StartAsync();
        await connectionB.StartAsync();

        await connectionA.InvokeAsync<bool>("JoinGameRoom", created.GameId, created.PlayerToken);
        await connectionB.InvokeAsync<bool>("JoinGameRoom", created.GameId, joined!.PlayerToken);

        // 3. Player A sends WebRTC offer
        var dummySdp = "v=0\r\no=alice 1234 5678 IN IP4 127.0.0.1";
        await connectionA.InvokeAsync("SendSignal", created.GameId, created.PlayerToken, "offer", dummySdp);

        var received = await Task.WhenAny(offerTcs.Task, Task.Delay(5000));
        Assert.Equal(offerTcs.Task, received);

        var receivedSdp = await offerTcs.Task;
        Assert.Equal(dummySdp, receivedSdp);
    }

    [Fact]
    public async Task AuthoritativeAction_DrawCard_BroadcastsCardDrawnToRoom()
    {
        var createResponse = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        await using var connectionA = CreateHubConnection();
        var cardDrawnTcs = new TaskCompletionSource<CardDrawnBroadcastDto>();

        connectionA.On<CardDrawnBroadcastDto>("CardDrawn", broadcast =>
        {
            cardDrawnTcs.SetResult(broadcast);
        });

        await connectionA.StartAsync();
        await connectionA.InvokeAsync<bool>("JoinGameRoom", created!.GameId, created.PlayerToken);

        // Player A draws card
        var drawSuccess = await connectionA.InvokeAsync<bool>("DrawCard", created.GameId, created.PlayerToken);
        Assert.True(drawSuccess);

        var received = await Task.WhenAny(cardDrawnTcs.Task, Task.Delay(5000));
        Assert.Equal(cardDrawnTcs.Task, received);

        var broadcast = await cardDrawnTcs.Task;
        Assert.False(string.IsNullOrEmpty(broadcast.CardName));
        Assert.Equal("White", broadcast.Player);
    }

    [Fact]
    public async Task GetLegalMoves_ReturnsInitialLegalMovesForWhite()
    {
        var createResponse = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        await using var connectionA = CreateHubConnection();
        await connectionA.StartAsync();
        await connectionA.InvokeAsync<bool>("JoinGameRoom", created!.GameId, created.PlayerToken);

        var legalMoves = await connectionA.InvokeAsync<System.Collections.Generic.List<string>>("GetLegalMoves", created.GameId, created.PlayerToken);
        Assert.NotNull(legalMoves);
        Assert.Equal(20, legalMoves.Count); // 16 pawn moves + 4 knight moves in initial chess position
        Assert.Contains("e2e4", legalMoves);
        Assert.Contains("g1f3", legalMoves);
    }

    [Fact]
    public async Task Resign_FinishesGameAndBroadcastsState()
    {
        var createResponse = await _httpClient.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        await using var connectionA = CreateHubConnection();
        var updateTcs = new TaskCompletionSource<dynamic>();

        connectionA.On<System.Text.Json.JsonElement>("GameStateUpdated", update =>
        {
            if (update.GetProperty("gameStatus").GetString() == "Resigned")
            {
                updateTcs.SetResult(update);
            }
        });

        await connectionA.StartAsync();
        await connectionA.InvokeAsync<bool>("JoinGameRoom", created!.GameId, created.PlayerToken);

        var resignSuccess = await connectionA.InvokeAsync<bool>("Resign", created.GameId, created.PlayerToken);
        Assert.True(resignSuccess);

        var completed = await Task.WhenAny(updateTcs.Task, Task.Delay(5000));
        Assert.Equal(updateTcs.Task, completed);
    }
}

public record GameSnapshotDto(
    Guid GameId,
    string Status,
    string AssignedColor,
    string BoardFen,
    string ActivePlayer,
    string TurnPhase,
    int RemainingMoves,
    int RemainingDeckCount
);

public record CardDrawnBroadcastDto(
    string Player,
    string CardName,
    int RemainingDeckCount
);

