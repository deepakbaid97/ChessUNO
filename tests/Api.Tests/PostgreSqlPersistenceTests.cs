using System;
using System.IO;
using System.Threading.Tasks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Api.Tests;

public class PostgreSqlPersistenceTests : IAsyncLifetime
{
    private static string GetSafeTestConnectionString()
    {
        var envConn = Environment.GetEnvironmentVariable("CHESSUNO_TEST_CONNECTION_STRING");
        if (!string.IsNullOrWhiteSpace(envConn))
        {
            ValidateTestDatabase(envConn);
            return envConn;
        }

        var password = Environment.GetEnvironmentVariable("CHESSUNO_TEST_PASSWORD") ??
                       Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ??
                       "postgres";

        var conn = $"Host=localhost;Port=5432;Database=chessuno_test;Username=postgres;Password={password};Include Error Detail=true;";
        ValidateTestDatabase(conn);
        return conn;
    }

    private static void ValidateTestDatabase(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = builder.Database?.ToLowerInvariant() ?? string.Empty;

        if (!dbName.Contains("test"))
        {
            throw new InvalidOperationException(
                $"SAFETY VIOLATION: Refusing to perform destructive database operations against non-test database '{dbName}'. Test database name MUST contain 'test'.");
        }
    }

    private readonly string _connectionString = GetSafeTestConnectionString();
    private DbContextOptions<ChessUnoDbContext> _options = null!;

    public async Task InitializeAsync()
    {
        ValidateTestDatabase(_connectionString);

        _options = new DbContextOptionsBuilder<ChessUnoDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        await using var db = new ChessUnoDbContext(_options);
        await db.Database.EnsureDeletedAsync();
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public void ValidateTestDatabase_RejectsProductionOrNonTestDatabaseNames()
    {
        var prodConn = "Host=localhost;Port=5432;Database=chessuno;Username=postgres;Password=secret;";
        Assert.Throws<InvalidOperationException>(() => ValidateTestDatabase(prodConn));

        var anotherNonTest = "Host=localhost;Port=5432;Database=production_db;Username=postgres;Password=secret;";
        Assert.Throws<InvalidOperationException>(() => ValidateTestDatabase(anotherNonTest));

        var validTest = "Host=localhost;Port=5432;Database=chessuno_test;Username=postgres;Password=secret;";
        ValidateTestDatabase(validTest); // Should not throw
    }

    [Fact]
    public async Task CreateSession_PersistsOnlyHashes_AndOmitsRawTokens()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);

        Assert.NotNull(session);
        Assert.NotEqual(Guid.Empty, session.GameId);

        // Verify direct from database entity
        await using var db = new ChessUnoDbContext(_options);
        var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == session.GameId);
        Assert.NotNull(entity);
        Assert.Equal(session.InvitationTokenHash, entity.InvitationTokenHash);
        Assert.Equal("WaitingForPlayer", entity.Status.ToString());
        Assert.Equal("Alice", entity.PlayerWhiteName);
        Assert.Equal(session.PlayerWhite!.TokenHash, entity.PlayerWhiteTokenHash);

        // Crucial security verification: raw tokens MUST NOT be present in snapshotJson
        Assert.DoesNotContain(session.InvitationToken!, entity.SnapshotJson);
        Assert.DoesNotContain(session.PlayerWhite.SecretToken!, entity.SnapshotJson);
    }

    [Fact]
    public async Task JoinSession_PersistsBlackPlayerHash_AndSetsReadyInDatabase()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);

        var joinResult = await repo.JoinSessionAsync(session.InvitationToken!, "Bob");
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
        Assert.Equal(blackPlayer.TokenHash, entity.PlayerBlackTokenHash);
        Assert.Equal(SessionStatus.Ready, entity.Status);
        Assert.Equal(2, entity.GameRevision);

        // Verify snapshot does not contain Bob's raw secret token
        Assert.DoesNotContain(blackPlayer.SecretToken!, entity.SnapshotJson);
    }

    [Fact]
    public async Task SessionRecovery_RestoresSessionFromPostgreSql_PreservingAuthorizationWithoutRawTokens()
    {
        var repo1 = new PostgreSqlGameSessionRepository(_options);
        var session = await repo1.CreateSessionAsync("Alice", seed: 42);
        var joinResult = await repo1.JoinSessionAsync(session.InvitationToken!, "Bob");
        var rawWhiteToken = session.PlayerWhite!.SecretToken!;
        var rawBlackToken = joinResult!.Value.Player.SecretToken!;

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
        Assert.Equal(session.GameRevision, recovered.GameRevision);

        // Raw tokens MUST be null on recovered session
        Assert.Null(recovered.PlayerWhite!.SecretToken);
        Assert.Null(recovered.PlayerBlack!.SecretToken);

        // Hashes must match
        Assert.Equal(session.PlayerWhite.TokenHash, recovered.PlayerWhite.TokenHash);
        Assert.Equal(session.PlayerBlack.TokenHash, recovered.PlayerBlack.TokenHash);

        // Authenticators must still succeed
        Assert.True(recovered.AuthenticatePlayer(rawWhiteToken, PlayerColor.White));
        Assert.True(recovered.AuthenticatePlayer(rawBlackToken, PlayerColor.Black));

        // Invalid tokens fail
        Assert.False(recovered.AuthenticatePlayer("invalid-token", PlayerColor.White));
    }

    [Fact]
    public async Task AtomicAction_CommitsStateAndActionRecord_Atomically()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);
        await repo.JoinSessionAsync(session.InvitationToken!, "Bob");

        const string actionId = "atomic-action-001";

        // Execute action atomically
        var (success, errorCode, newRev, isReplay) = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "DrawCard",
            PlayerColor.White,
            expectedRevision: 2,
            s =>
            {
                s.EngineController.DrawCard(PlayerColor.White);
                return (true, null);
            }
        );

        Assert.True(success);
        Assert.Null(errorCode);
        Assert.Equal(3, newRev);
        Assert.False(isReplay);

        // Verify both session entity and action entity were committed in PostgreSQL
        await using var db = new ChessUnoDbContext(_options);
        var entity = await db.Sessions.AsNoTracking().FirstOrDefaultAsync(s => s.GameId == session.GameId);
        Assert.NotNull(entity);
        Assert.Equal(3, entity.GameRevision);

        var action = await db.Actions.AsNoTracking().FirstOrDefaultAsync(a => a.GameId == session.GameId && a.ActionId == actionId);
        Assert.NotNull(action);
        Assert.Equal("DrawCard", action.ActionType);

        // Idempotency: Repeating the exact same action returns isReplay: true without incrementing revision
        var replay = await repo.ExecuteActionAtomicallyAsync(
            session.GameId,
            actionId,
            "DrawCard",
            PlayerColor.White,
            expectedRevision: 3,
            s => (true, null)
        );

        Assert.True(replay.Success);
        Assert.True(replay.IsIdempotentReplay);
        Assert.Equal(3, replay.NewRevision);
    }

    [Fact]
    public async Task CrossInstanceConcurrency_DetectsRevisionConflict_AndReloadsAuthoritativeState()
    {
        // Simulate two independent repository instances (representing two distinct server pods)
        var instanceA = new PostgreSqlGameSessionRepository(_options);
        var instanceB = new PostgreSqlGameSessionRepository(_options);

        var sessionA = await instanceA.CreateSessionAsync("Alice", seed: 42);
        await instanceA.JoinSessionAsync(sessionA.InvitationToken!, "Bob");

        // Load into instance B
        var sessionB = await instanceB.GetByIdAsync(sessionA.GameId);
        Assert.NotNull(sessionB);
        Assert.Equal(sessionA.GameRevision, sessionB.GameRevision);

        // Instance A commits an action, moving revision from 2 to 3
        var resultA = await instanceA.ExecuteActionAtomicallyAsync(
            sessionA.GameId,
            "act-inst-a",
            "DrawCard",
            PlayerColor.White,
            expectedRevision: 2,
            s =>
            {
                s.EngineController.DrawCard(PlayerColor.White);
                return (true, null);
            }
        );
        Assert.True(resultA.Success);
        Assert.Equal(3, resultA.NewRevision);

        // Instance B attempts to execute an action with its stale revision (2)
        var resultB = await instanceB.ExecuteActionAtomicallyAsync(
            sessionB.GameId,
            "act-inst-b",
            "DrawCard",
            PlayerColor.White,
            expectedRevision: 2,
            s => (true, null)
        );

        // Must detect revision conflict and reject
        Assert.False(resultB.Success);
        Assert.Equal("CONCURRENCY_CONFLICT", resultB.ErrorCode);

        // Instance B's in-memory session is reloaded with authoritative DB state (revision 3)
        var reloadedB = await instanceB.GetByIdAsync(sessionA.GameId);
        Assert.NotNull(reloadedB);
        Assert.Equal(3, reloadedB.GameRevision);
    }
}
