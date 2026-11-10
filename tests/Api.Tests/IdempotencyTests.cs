using System;
using System.Text.Json;
using System.Threading.Tasks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Sessions;
using Xunit;

namespace Api.Tests;

public class IdempotencyTests
{
    public IdempotencyTests()
    {
        if (!TokenHasher.IsInitialized)
        {
            TokenHasher.Initialize("ChessUnoIdempotencyTestKeyMustBe32Bytes!");
        }
    }

    [Fact]
    public async Task ExactRetry_ReturnsOriginalSuccess_WithoutMutatingStateOrIncrementingRevision()
    {
        var repo = new InMemoryGameSessionRepository();
        var session = await repo.CreateSessionAsync("Alice", seed: 42);
        var actionId = Guid.NewGuid().ToString();
        var payload = JsonSerializer.Serialize(new { from = "e2", to = "e4" });

        int executionCount = 0;
        // First execution
        var result1 = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "MakeMove",
            PlayerColor.White,
            expectedRevision: 1,
            s =>
            {
                executionCount++;
                return (true, null);
            },
            payloadJson: payload
        );

        Assert.True(result1.Success);
        Assert.False(result1.IsIdempotentReplay);
        Assert.Equal(2, result1.NewRevision);
        Assert.Equal(1, executionCount);

        // Exact retry with SAME actionId, SAME player, SAME actionType, and SAME payload
        // Even with the stale expectedRevision = 1 (from when the client initiated it)
        var result2 = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "MakeMove",
            PlayerColor.White,
            expectedRevision: 1, // Stale revision submitted on retry!
            s =>
            {
                executionCount++;
                return (true, null);
            },
            payloadJson: payload
        );

        Assert.True(result2.Success);
        Assert.True(result2.IsIdempotentReplay);
        Assert.Equal(2, result2.NewRevision);
        Assert.Equal(1, executionCount); // Mutator NOT re-executed!
    }

    [Fact]
    public async Task ReusingActionId_WithDifferentPayload_IsRejectedWithIdempotencyConflict()
    {
        var repo = new InMemoryGameSessionRepository();
        var session = await repo.CreateSessionAsync("Alice", seed: 42);
        var actionId = Guid.NewGuid().ToString();
        var payloadA = JsonSerializer.Serialize(new { from = "e2", to = "e4" });
        var payloadB = JsonSerializer.Serialize(new { from = "d2", to = "d4" }); // Different payload!

        var result1 = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "MakeMove",
            PlayerColor.White,
            expectedRevision: 1,
            s => (true, null),
            payloadJson: payloadA
        );
        Assert.True(result1.Success);

        // Attempting to reuse same actionId with payloadB
        var result2 = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "MakeMove",
            PlayerColor.White,
            expectedRevision: 1,
            s => (true, null),
            payloadJson: payloadB
        );

        Assert.False(result2.Success);
        Assert.Equal("IDEMPOTENCY_CONFLICT", result2.ErrorCode);
        Assert.False(result2.IsIdempotentReplay);
    }

    [Fact]
    public async Task ReusingActionId_WithDifferentActionTypeOrPlayer_IsRejectedWithIdempotencyConflict()
    {
        var repo = new InMemoryGameSessionRepository();
        var session = await repo.CreateSessionAsync("Alice", seed: 42);
        var actionId = Guid.NewGuid().ToString();
        var payload = JsonSerializer.Serialize(new { card = "skip" });

        var result1 = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "PlayCard",
            PlayerColor.White,
            expectedRevision: 1,
            s => (true, null),
            payloadJson: payload
        );
        Assert.True(result1.Success);

        // Different player
        var resultDifferentPlayer = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "PlayCard",
            PlayerColor.Black,
            expectedRevision: 2,
            s => (true, null),
            payloadJson: payload
        );
        Assert.False(resultDifferentPlayer.Success);
        Assert.Equal("IDEMPOTENCY_CONFLICT", resultDifferentPlayer.ErrorCode);

        // Different action type
        var resultDifferentType = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "DrawCard",
            PlayerColor.White,
            expectedRevision: 2,
            s => (true, null),
            payloadJson: payload
        );
        Assert.False(resultDifferentType.Success);
        Assert.Equal("IDEMPOTENCY_CONFLICT", resultDifferentType.ErrorCode);
    }
}
