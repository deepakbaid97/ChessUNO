using System;
using System.IO;
using System.Threading.Tasks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Api.Tests;

public class PostgreSqlPersistenceTests : IAsyncLifetime
{
    private const string ConnectionString = "Host=localhost;Port=5432;Database=chessuno_test;Username=postgres;Password=postgres;Include Error Detail=true;";
    private DbContextOptions<ChessUnoDbContext> _options = null!;

    public async Task InitializeAsync()
    {
        _options = new DbContextOptionsBuilder<ChessUnoDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using var db = new ChessUnoDbContext(_options);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task CreateSession_PersistsToPostgreSqlDatabase()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);

        Assert.NotNull(session);
        Assert.NotEqual(Guid.Empty, session.GameId);

        // Verify direct from database entity
        await using var db = new ChessUnoDbContext(_options);
        var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == session.GameId);
        Assert.NotNull(entity);
        Assert.Equal(session.InvitationToken, entity.InvitationToken);
        Assert.Equal("WaitingForPlayer", entity.Status.ToString());
        Assert.Equal("Alice", entity.PlayerWhiteName);
        Assert.False(string.IsNullOrEmpty(entity.SnapshotJson));
    }

    [Fact]
    public async Task JoinSession_PersistsBlackPlayer_AndSetsReadyInDatabase()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);

        var joinResult = await repo.JoinSessionAsync(session.InvitationToken, "Bob");
        Assert.NotNull(joinResult);

        var (updatedSession, blackPlayer) = joinResult.Value;
        Assert.Equal("Bob", blackPlayer.PlayerName);
        Assert.Equal(PlayerColor.Black, blackPlayer.Color);
        Assert.Equal(SessionStatus.Ready, updatedSession.Status);

        // Verify in database
        await using var db = new ChessUnoDbContext(_options);
        var entity = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.GameId == session.GameId);
        Assert.NotNull(entity);
        Assert.Equal("Bob", entity.PlayerBlackName);
        Assert.Equal(SessionStatus.Ready, entity.Status);
        Assert.Equal(2, entity.GameRevision);
    }

    [Fact]
    public async Task SessionRecovery_RestoresSessionFromPostgreSql_AfterApplicationRestart()
    {
        var repo1 = new PostgreSqlGameSessionRepository(_options);
        var session = await repo1.CreateSessionAsync("Alice", seed: 42);
        await repo1.JoinSessionAsync(session.InvitationToken, "Bob");

        // Advance state by drawing a card for White
        var drawnCard = session.EngineController.DrawCard(PlayerColor.White);
        Assert.NotNull(drawnCard);
        session.GameRevision++;
        await repo1.UpdateSessionAsync(session);

        // SIMULATE APP RESTART: Create a brand new repository instance with EMPTY in-memory cache
        var repo2 = new PostgreSqlGameSessionRepository(_options);

        // Recover session by GameId
        var recovered = await repo2.GetByIdAsync(session.GameId);
        Assert.NotNull(recovered);
        Assert.Equal(session.GameId, recovered.GameId);
        Assert.Equal(session.PlayerWhite!.SecretToken, recovered.PlayerWhite!.SecretToken);
        Assert.Equal(session.PlayerBlack!.SecretToken, recovered.PlayerBlack!.SecretToken);
        Assert.Equal(session.GameRevision, recovered.GameRevision);
        Assert.Equal(session.EngineController.CurrentTurn.ActiveCard?.Id, recovered.EngineController.CurrentTurn.ActiveCard?.Id);
        Assert.Equal(session.EngineController.DeckManager.RemainingCount, recovered.EngineController.DeckManager.RemainingCount);
    }

    [Fact]
    public async Task TryRecordAction_ProvidesIdempotency_AndDeduplicatesRetries()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);

        const string actionId = "client-action-12345";
        const string payload = "{\"from\":\"e2\",\"to\":\"e4\"}";
        const string result = "{\"success\":true}";

        // First attempt succeeds
        var recordedFirst = await repo.TryRecordActionAsync(session.GameId, actionId, "SubmitMove", "White", 1, payload, result);
        Assert.True(recordedFirst);

        // Second attempt with same actionId is detected as duplicate
        var recordedSecond = await repo.TryRecordActionAsync(session.GameId, actionId, "SubmitMove", "White", 1, payload, result);
        Assert.False(recordedSecond);

        // Retrieve existing action result
        var cachedResult = await repo.GetActionResultAsync(session.GameId, actionId);
        Assert.Equal(result, cachedResult);
    }
}
