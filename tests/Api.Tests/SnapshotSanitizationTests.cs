using System;
using System.IO;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Api.Tests;

[Collection("NonParallelTokenHasherTests")]
public class SnapshotSanitizationTests
{
    public SnapshotSanitizationTests()
    {
        TokenHasher.Initialize("ChessUnoDefaultGlobalTestKeyMustBe32BytesMin!");
    }

    [Fact]
    public void LegacySnapshotSanitizer_RemovesRawTokens_AndPreservesTokenHashesAndGameState()
    {
        var rawWhiteSecret = "legacy-secret-white-token-999";
        var rawBlackSecret = "legacy-secret-black-token-888";
        var rawInvitation = "legacy-raw-invitation-token-777";

        var expectedWhiteHash = TokenHasher.HashToken(rawWhiteSecret);
        var expectedBlackHash = TokenHasher.HashToken(rawBlackSecret);
        var expectedInviteHash = TokenHasher.HashToken(rawInvitation);

        // Simulated legacy snapshot JSON with raw tokens present and missing hashes
        var legacyJson = $$"""
        {
            "GameId": "{{Guid.NewGuid()}}",
            "InvitationToken": "{{rawInvitation}}",
            "Status": "Ready",
            "PlayerWhite": {
                "PlayerId": "{{Guid.NewGuid()}}",
                "PlayerName": "Alice",
                "Color": "White",
                "SecretToken": "{{rawWhiteSecret}}",
                "IsConnected": false
            },
            "PlayerBlack": {
                "PlayerId": "{{Guid.NewGuid()}}",
                "PlayerName": "Bob",
                "Color": "Black",
                "SecretToken": "{{rawBlackSecret}}",
                "IsConnected": false
            },
            "CreatedAt": "2026-01-01T00:00:00Z",
            "GameRevision": 4,
            "BoardFen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            "ConfigVersion": "1.0.0",
            "EventSequenceNumber": 10,
            "GameStatus": "Active",
            "InCheck": false,
            "HalfMoveClock": 0,
            "FullMoveNumber": 1,
            "Reserves": { "White": [], "Black": [] },
            "MoveHistory": [],
            "TurnState": { "TurnNumber": 1, "Phase": "Action" },
            "DrawDeck": [],
            "DiscardPile": []
        }
        """;

        // Assert raw tokens were present before sanitization
        Assert.Contains(rawWhiteSecret, legacyJson);
        Assert.Contains(rawBlackSecret, legacyJson);
        Assert.Contains(rawInvitation, legacyJson);

        // Sanitize
        var sanitizedJson = LegacySnapshotSanitizer.Sanitize(legacyJson);

        // Verify raw tokens are stripped
        Assert.DoesNotContain(rawWhiteSecret, sanitizedJson);
        Assert.DoesNotContain(rawBlackSecret, sanitizedJson);
        Assert.DoesNotContain(rawInvitation, sanitizedJson);
        Assert.DoesNotContain("SecretToken", sanitizedJson);

        // Verify computed hashes are now present
        var node = JsonNode.Parse(sanitizedJson)!;
        Assert.Equal(expectedInviteHash, node["InvitationTokenHash"]?.ToString());
        Assert.Equal(expectedWhiteHash, node["PlayerWhite"]?["TokenHash"]?.ToString());
        Assert.Equal(expectedBlackHash, node["PlayerBlack"]?["TokenHash"]?.ToString());

        // Verify game state preserved
        Assert.Equal("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1", node["BoardFen"]?.ToString());
        Assert.Equal(4, node["GameRevision"]?.GetValue<int>());
    }

    [Fact]
    public async Task RestoreFromLegacySnapshot_StripsRawTokens_AndAuthenticatesOriginalPlayer()
    {
        var rawWhiteSecret = "legacy-secret-white-token-111";
        var rawInvitation = "legacy-raw-invite-token-222";

        var legacyJson = $$"""
        {
            "GameId": "{{Guid.NewGuid()}}",
            "InvitationToken": "{{rawInvitation}}",
            "Status": "WaitingForPlayer",
            "PlayerWhite": {
                "PlayerId": "{{Guid.NewGuid()}}",
                "PlayerName": "Alice",
                "Color": "White",
                "SecretToken": "{{rawWhiteSecret}}",
                "IsConnected": false
            },
            "CreatedAt": "2026-01-01T00:00:00Z",
            "GameRevision": 1,
            "BoardFen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            "ConfigVersion": "1.0.0",
            "EventSequenceNumber": 0,
            "GameStatus": "Active",
            "InCheck": false,
            "HalfMoveClock": 0,
            "FullMoveNumber": 1,
            "Reserves": { "White": [], "Black": [] },
            "MoveHistory": [],
            "TurnState": { "TurnNumber": 1, "Phase": "Draw" },
            "DrawDeck": [],
            "DiscardPile": []
        }
        """;

        var repo = new InMemoryGameSessionRepository();
        var session = await repo.RestoreSessionSnapshotJsonAsync(legacyJson);
        Assert.NotNull(session);
        Assert.NotNull(session.PlayerWhite);
        Assert.NotEmpty(session.PlayerWhite.TokenHash);

        // SecretToken must be null
        Assert.Null(session.PlayerWhite!.SecretToken);
        Assert.Null(session.InvitationToken);

        // Debug assertion
        var expectedHash = TokenHasher.HashToken(rawWhiteSecret);
        Assert.Equal(expectedHash, session.PlayerWhite.TokenHash);

        // Original raw secret authenticates against computed hash
        Assert.True(session.AuthenticatePlayer(rawWhiteSecret, PlayerColor.White));
        Assert.False(session.AuthenticatePlayer("wrong-token", PlayerColor.White));
    }
}
