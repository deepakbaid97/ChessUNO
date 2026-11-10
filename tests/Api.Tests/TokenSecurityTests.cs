using System;
using System.IO;
using System.Net.Http.Json;
using System.Threading.Tasks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Api.Tests;

public class TokenSecurityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly System.Net.Http.HttpClient _client;

    public TokenSecurityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task CreateGame_StoresOnlyHashes_AndNeverPersistsRawTokensInSnapshot()
    {
        var res = await _client.PostAsJsonAsync("/api/games", new { PlayerName = "Alice", Seed = 42 });
        res.EnsureSuccessStatusCode();
        var created = await res.Content.ReadFromJsonAsync<CreateGameResponse>();

        Assert.NotNull(created);
        Assert.False(string.IsNullOrWhiteSpace(created.InvitationToken));
        Assert.False(string.IsNullOrWhiteSpace(created.PlayerToken));

        // Join second player
        var joinRes = await _client.PostAsJsonAsync("/api/games/join", new { InvitationToken = created.InvitationToken, PlayerName = "Bob" });
        joinRes.EnsureSuccessStatusCode();
        var joined = await joinRes.Content.ReadFromJsonAsync<JoinGameResponse>();
        Assert.NotNull(joined);
        Assert.False(string.IsNullOrWhiteSpace(joined.PlayerToken));

        // Now query the repository snapshot
        var repo = _factory.Services.GetRequiredService<IGameSessionRepository>();
        var snapshotJson = await repo.ExportSessionSnapshotJsonAsync(created.GameId);

        // Assert that neither the raw invitation token nor the raw player tokens appear in snapshot JSON
        Assert.DoesNotContain(created.InvitationToken, snapshotJson);
        Assert.DoesNotContain(created.PlayerToken, snapshotJson);
        Assert.DoesNotContain(joined.PlayerToken, snapshotJson);
    }

    [Fact]
    public async Task PublicGameViewAndInviteEndpoints_DoNotExposeTokenHashesOrTokens()
    {
        var res = await _client.PostAsJsonAsync("/api/games", new { PlayerName = "Alice", Seed = 42 });
        var created = await res.Content.ReadFromJsonAsync<CreateGameResponse>();

        // 1. GET /api/games/{id}
        var getRes = await _client.GetAsync($"/api/games/{created!.GameId}");
        var getContent = await getRes.Content.ReadAsStringAsync();
        Assert.DoesNotContain(created.PlayerToken, getContent);
        Assert.DoesNotContain("TokenHash", getContent, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SecretToken", getContent, StringComparison.OrdinalIgnoreCase);

        // 2. GET /api/games/invite/{token}
        var inviteRes = await _client.GetAsync($"/api/games/invite/{created.InvitationToken}");
        var inviteContent = await inviteRes.Content.ReadAsStringAsync();
        Assert.DoesNotContain(created.PlayerToken, inviteContent);
        Assert.DoesNotContain("TokenHash", inviteContent, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("SecretToken", inviteContent, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RestoredSession_PreservesAuthorization_AndRejectsInvalidOrCrossSessionTokens()
    {
        var repo = _factory.Services.GetRequiredService<IGameSessionRepository>();
        var session = await repo.CreateSessionAsync("Alice", seed: 100);
        var rawWhiteToken = session.PlayerWhite!.SecretToken!;
        Assert.NotNull(rawWhiteToken);

        var (joinedSession, bob) = (await repo.JoinSessionAsync(session.InvitationToken!, "Bob"))!.Value;
        var rawBlackToken = bob.SecretToken!;

        // Export snapshot
        var snapshotJson = await repo.ExportSessionSnapshotJsonAsync(session.GameId);

        // Restore snapshot into a clean instance
        var restored = await repo.RestoreSessionSnapshotJsonAsync(snapshotJson);
        Assert.NotNull(restored);

        // Verify raw tokens are null in restored session
        Assert.Null(restored.PlayerWhite!.SecretToken);
        Assert.Null(restored.PlayerBlack!.SecretToken);

        // Verify valid tokens still authenticate
        Assert.True(restored.AuthenticatePlayer(rawWhiteToken, PlayerColor.White));
        Assert.True(restored.AuthenticatePlayer(rawBlackToken, PlayerColor.Black));

        // Verify invalid token is rejected
        Assert.False(restored.AuthenticatePlayer("invalid-fake-token-xyz", PlayerColor.White));
        Assert.False(restored.AuthenticatePlayer("invalid-fake-token-xyz", PlayerColor.Black));

        // Verify White's token cannot authenticate as Black
        Assert.False(restored.AuthenticatePlayer(rawWhiteToken, PlayerColor.Black));
        Assert.False(restored.AuthenticatePlayer(rawBlackToken, PlayerColor.White));

        // Create a second session and verify tokens from session B cannot authenticate in session A
        var sessionB = await repo.CreateSessionAsync("Eve", seed: 200);
        var rawEveToken = sessionB.PlayerWhite!.SecretToken!;
        Assert.False(restored.AuthenticatePlayer(rawEveToken, PlayerColor.White));
    }
}
