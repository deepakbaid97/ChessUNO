using System;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace Api.Tests;

public class GamesApiTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly System.Net.Http.HttpClient _client;

    public GamesApiTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateGame_ReturnsSuccess_WithInvitationTokenAndCreatorCredentials()
    {
        var response = await _client.PostAsJsonAsync("/api/games", new
        {
            PlayerName = "Alice"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var content = await response.Content.ReadFromJsonAsync<CreateGameResponse>();
        Assert.NotNull(content);
        Assert.NotEqual(Guid.Empty, content.GameId);
        Assert.False(string.IsNullOrWhiteSpace(content.InvitationToken));
        Assert.False(string.IsNullOrWhiteSpace(content.InvitationUrl));
        Assert.False(string.IsNullOrWhiteSpace(content.PlayerToken));
        Assert.Equal("White", content.AssignedColor);
        Assert.Equal("WaitingForPlayer", content.Status);
    }

    [Fact]
    public async Task JoinGame_WithValidToken_AssignsBlackAndSetsStatusToReady()
    {
        // 1. Create Game
        var createResponse = await _client.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        // 2. Join Game with invitation token
        var joinResponse = await _client.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = created!.InvitationToken,
            PlayerName = "Bob"
        });

        Assert.Equal(HttpStatusCode.OK, joinResponse.StatusCode);

        var joined = await joinResponse.Content.ReadFromJsonAsync<JoinGameResponse>();
        Assert.NotNull(joined);
        Assert.Equal(created.GameId, joined.GameId);
        Assert.Equal("Black", joined.AssignedColor);
        Assert.False(string.IsNullOrWhiteSpace(joined.PlayerToken));
        Assert.Equal("Ready", joined.Status);
    }

    [Fact]
    public async Task JoinGame_WithInvalidToken_ReturnsNotFound()
    {
        var response = await _client.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = "non-existent-token-12345",
            PlayerName = "Eve"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task JoinGame_WhenAlreadyFull_ReturnsConflict()
    {
        // 1. Create
        var createResponse = await _client.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        // 2. Player B joins
        await _client.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = created!.InvitationToken,
            PlayerName = "Bob"
        });

        // 3. Player C attempts to join full game
        var thirdPlayerResponse = await _client.PostAsJsonAsync("/api/games/join", new
        {
            InvitationToken = created.InvitationToken,
            PlayerName = "Charlie"
        });

        Assert.Equal(HttpStatusCode.Conflict, thirdPlayerResponse.StatusCode);
    }

    [Fact]
    public async Task GetGameSession_ReturnsPublicInfo_HidingSecretTokens()
    {
        var createResponse = await _client.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        var getResponse = await _client.GetAsync($"/api/games/{created!.GameId}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var session = await getResponse.Content.ReadFromJsonAsync<GameSessionViewResponse>();
        Assert.NotNull(session);
        Assert.Equal(created.GameId, session.GameId);
        Assert.Equal("Alice", session.PlayerWhiteName);
        Assert.Null(session.PlayerBlackName);
        Assert.Equal("WaitingForPlayer", session.Status);
    }

    [Fact]
    public async Task GetInvitationInfo_WithValidToken_ReturnsSessionDetails()
    {
        var createResponse = await _client.PostAsJsonAsync("/api/games", new { PlayerName = "Alice" });
        var created = await createResponse.Content.ReadFromJsonAsync<CreateGameResponse>();

        var inviteResponse = await _client.GetAsync($"/api/games/invite/{created!.InvitationToken}");
        Assert.Equal(HttpStatusCode.OK, inviteResponse.StatusCode);

        var inviteInfo = await inviteResponse.Content.ReadFromJsonAsync<InvitationInfoResponse>();
        Assert.NotNull(inviteInfo);
        Assert.Equal(created.GameId, inviteInfo.GameId);
        Assert.Equal("Alice", inviteInfo.CreatorName);
        Assert.Equal("Black", inviteInfo.AssignedColor);
        Assert.Equal("WaitingForPlayer", inviteInfo.Status);
    }

    [Fact]
    public async Task GetInvitationInfo_WithInvalidToken_ReturnsNotFound()
    {
        var inviteResponse = await _client.GetAsync("/api/games/invite/non-existent-token");
        Assert.Equal(HttpStatusCode.NotFound, inviteResponse.StatusCode);
    }
}

public record InvitationInfoResponse(
    Guid GameId,
    string Status,
    string CreatorName,
    string AssignedColor
);

public record CreateGameResponse(
    Guid GameId,
    string InvitationToken,
    string InvitationUrl,
    string PlayerId,
    string PlayerToken,
    string AssignedColor,
    string Status
);

public record JoinGameResponse(
    Guid GameId,
    string PlayerId,
    string PlayerToken,
    string AssignedColor,
    string Status
);

public record GameSessionViewResponse(
    Guid GameId,
    string Status,
    string? PlayerWhiteName,
    string? PlayerBlackName,
    string BoardFen,
    int Revision
);

