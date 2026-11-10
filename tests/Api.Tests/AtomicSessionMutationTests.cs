using System;
using System.IO;
using System.Threading.Tasks;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Sessions;
using ChessUno.Web.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Api.Tests;

public class AtomicSessionMutationTests : IAsyncLifetime
{
    private string _adminConnectionString = null!;
    private string _connectionString = null!;
    private string _databaseName = null!;
    private string _runToken = null!;
    private DbContextOptions<ChessUnoDbContext> _options = null!;

    public async Task InitializeAsync()
    {
        if (!TokenHasher.IsInitialized)
        {
            TokenHasher.Initialize("ChessUnoAtomicSessionMutationKey32Bytes!");
        }

        var baseConn = Environment.GetEnvironmentVariable("CHESSUNO_TEST_CONNECTION_STRING");
        var password = Environment.GetEnvironmentVariable("CHESSUNO_TEST_PASSWORD") ??
                       Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ??
                       "postgres";

        _adminConnectionString = !string.IsNullOrWhiteSpace(baseConn)
            ? new NpgsqlConnectionStringBuilder(baseConn) { Database = "postgres" }.ConnectionString
            : new NpgsqlConnectionStringBuilder
            {
                Host = "localhost",
                Port = 5432,
                Database = "postgres",
                Username = "postgres",
                Password = password,
                IncludeErrorDetail = true
            }.ConnectionString;

        (_connectionString, _databaseName, _runToken) = await PostgreSqlTestDatabaseManager.CreateIsolatedDatabaseAsync(_adminConnectionString);

        _options = new DbContextOptionsBuilder<ChessUnoDbContext>()
            .UseNpgsql(_connectionString)
            .Options;

        await using var db = new ChessUnoDbContext(_options);
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        if (!string.IsNullOrEmpty(_connectionString))
        {
            await PostgreSqlTestDatabaseManager.DropIsolatedDatabaseAsync(_adminConnectionString, _connectionString, _runToken);
        }
    }

    [Fact]
    public async Task JoinSession_WhenDatabaseFails_RollsBackInMemoryState()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);
        var initialRevision = session.GameRevision;

        // Create a faulty DbContextFactory that throws on SaveChanges
        var faultyOptions = new DbContextOptionsBuilder<ChessUnoDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=chessuno_nonexistent_faulty_db;Username=postgres;Password=secret;")
            .Options;
        var faultyRepo = new PostgreSqlGameSessionRepository(faultyOptions);

        // Put the active session into the faulty repo's memory
        await faultyRepo.RestoreSessionSnapshotJsonAsync(await repo.ExportSessionSnapshotJsonAsync(session.GameId));

        await Assert.ThrowsAnyAsync<Exception>(() =>
            faultyRepo.JoinSessionAsync(session.InvitationToken!, "Bob"));

        // Retrieve the session from memory: it MUST be rolled back
        var rolledBackSession = await faultyRepo.GetByIdAsync(session.GameId);
        Assert.NotNull(rolledBackSession);
        Assert.Null(rolledBackSession.PlayerBlack);
        Assert.Equal(SessionStatus.WaitingForPlayer, rolledBackSession.Status);
        Assert.Equal(initialRevision, rolledBackSession.GameRevision);
    }

    [Fact]
    public async Task CancelSession_WhenDatabaseFails_RollsBackInMemoryState()
    {
        var repo = new PostgreSqlGameSessionRepository(_options);
        var session = await repo.CreateSessionAsync("Alice", seed: 42);
        var initialRevision = session.GameRevision;
        var playerToken = session.PlayerWhite!.SecretToken!;

        var faultyOptions = new DbContextOptionsBuilder<ChessUnoDbContext>()
            .UseNpgsql("Host=localhost;Port=5432;Database=chessuno_nonexistent_faulty_db;Username=postgres;Password=secret;")
            .Options;
        var faultyRepo = new PostgreSqlGameSessionRepository(faultyOptions);
        await faultyRepo.RestoreSessionSnapshotJsonAsync(await repo.ExportSessionSnapshotJsonAsync(session.GameId));

        await Assert.ThrowsAnyAsync<Exception>(() =>
            faultyRepo.CancelSessionAsync(session.GameId, playerToken));

        var rolledBackSession = await faultyRepo.GetByIdAsync(session.GameId);
        Assert.NotNull(rolledBackSession);
        Assert.Equal(SessionStatus.WaitingForPlayer, rolledBackSession.Status);
        Assert.Equal(initialRevision, rolledBackSession.GameRevision);
    }

    [Fact]
    public async Task JoinSession_CrossInstanceConcurrency_AllowsOnlyOnePlayerToJoin()
    {
        var instanceA = new PostgreSqlGameSessionRepository(_options);
        var instanceB = new PostgreSqlGameSessionRepository(_options);

        var session = await instanceA.CreateSessionAsync("Alice", seed: 100);
        var inviteToken = session.InvitationToken!;

        // Both instanceA and instanceB attempt to join simultaneously
        var taskA = instanceA.JoinSessionAsync(inviteToken, "Bob-InstanceA");
        var taskB = instanceB.JoinSessionAsync(inviteToken, "Charlie-InstanceB");

        var results = await Task.WhenAll(taskA, taskB);

        var successCount = (results[0] != null ? 1 : 0) + (results[1] != null ? 1 : 0);
        Assert.Equal(1, successCount);

        // Verify the persisted state in DB has exactly one joined player
        await using var db = new ChessUnoDbContext(_options);
        var entity = await db.Sessions.FirstOrDefaultAsync(s => s.GameId == session.GameId);
        Assert.NotNull(entity);
        Assert.Equal(SessionStatus.Ready, entity.Status);
        Assert.NotNull(entity.PlayerBlackId);
    }
}
