using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using ChessUno.Web.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Xunit;

namespace Api.Tests;

public class PostgreSqlTestIsolationTests
{
    [Theory]
    [InlineData("chessuno")]
    [InlineData("chessuno_prod")]
    [InlineData("production_test")]
    [InlineData("test_production")]
    [InlineData("customer_contest")]
    [InlineData("latest_db")]
    [InlineData("postgres")]
    [InlineData("template1")]
    [InlineData("chessuno_test")] // Non-unique / legacy shared name
    public void ValidateTestDatabaseName_RejectsUnsafeOrNonIsolatedNames(string dbName)
    {
        var conn = $"Host=localhost;Port=5432;Database={dbName};Username=postgres;Password=secret;";
        Assert.Throws<InvalidOperationException>(() => PostgreSqlTestDatabaseManager.ValidateIsolatedDatabaseName(conn));
    }

    [Fact]
    public void ValidateTestDatabaseName_AcceptsStrictlyIsolatedNames()
    {
        var runId = Guid.NewGuid().ToString("N").Substring(0, 12);
        var validName = $"chessuno_test_isolated_{runId}";
        var conn = $"Host=localhost;Port=5432;Database={validName};Username=postgres;Password=secret;";
        
        // Should not throw
        var validated = PostgreSqlTestDatabaseManager.ValidateIsolatedDatabaseName(conn);
        Assert.Equal(validName, validated);
    }

    [Fact]
    public async Task EphemeralDatabaseLifecycle_CreatesUniqueIsolatedDatabase_AndCleansUpSafely()
    {
        var baseConn = Environment.GetEnvironmentVariable("CHESSUNO_TEST_CONNECTION_STRING");
        var password = Environment.GetEnvironmentVariable("CHESSUNO_TEST_PASSWORD") ??
                       Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ??
                       "postgres";

        var adminConn = !string.IsNullOrWhiteSpace(baseConn)
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

        // Create ephemeral isolated database
        var (isolatedConn, isolatedDbName, runToken) = await PostgreSqlTestDatabaseManager.CreateIsolatedDatabaseAsync(adminConn);

        try
        {
            Assert.StartsWith("chessuno_test_isolated_", isolatedDbName);

            // Verify isolation marker table exists in the new isolated DB
            var options = new DbContextOptionsBuilder<ChessUnoDbContext>()
                .UseNpgsql(isolatedConn)
                .Options;

            await using var db = new ChessUnoDbContext(options);
            await db.Database.MigrateAsync();

            var markerExists = await PostgreSqlTestDatabaseManager.VerifyIsolationMarkerAsync(isolatedConn, runToken);
            Assert.True(markerExists);

            // Verify games table is usable
            var entity = new GameSessionEntity
            {
                GameId = Guid.NewGuid(),
                InvitationTokenHash = "abc123hash",
                Status = ChessUno.Core.Sessions.SessionStatus.WaitingForPlayer,
                BoardFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                GameRevision = 1,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
                SnapshotJson = "{}"
            };
            db.Sessions.Add(entity);
            await db.SaveChangesAsync();
            Assert.Equal(1, await db.Sessions.CountAsync());
        }
        finally
        {
            // Drop ephemeral database safely
            await PostgreSqlTestDatabaseManager.DropIsolatedDatabaseAsync(adminConn, isolatedConn, runToken);

            // Verify database was dropped
            await using var adminConnection = new NpgsqlConnection(adminConn);
            await adminConnection.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                $"SELECT 1 FROM pg_database WHERE datname = '{isolatedDbName}';", adminConnection);
            var exists = (await cmd.ExecuteScalarAsync()) != null;
            Assert.False(exists);
        }
    }
}
