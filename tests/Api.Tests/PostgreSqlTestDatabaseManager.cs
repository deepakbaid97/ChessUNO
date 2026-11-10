using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Npgsql;

namespace Api.Tests;

public static class PostgreSqlTestDatabaseManager
{
    private static readonly Regex IsolatedTestDbRegex = new(
        @"^chessuno_test_isolated_[a-f0-9]{8,32}$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly string[] ProhibitedNames =
    [
        "postgres",
        "template0",
        "template1",
        "chessuno",
        "master",
        "production",
        "prod"
    ];

    public static string ValidateIsolatedDatabaseName(string connectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var dbName = builder.Database?.ToLowerInvariant() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(dbName))
        {
            throw new InvalidOperationException("SAFETY VIOLATION: Database name cannot be empty for isolated test operations.");
        }

        // Must match strictly isolated test DB prefix and pattern
        if (!IsolatedTestDbRegex.IsMatch(dbName))
        {
            throw new InvalidOperationException(
                $"SAFETY VIOLATION: Test database name '{dbName}' does not match required isolation pattern '^chessuno_test_isolated_[a-f0-9]{{8,32}}$'. " +
                "Ephemeral isolation is required to prevent data loss or test collisions.");
        }

        // Prohibited production names & keywords
        foreach (var prohibited in ProhibitedNames)
        {
            if (dbName.Equals(prohibited, StringComparison.OrdinalIgnoreCase) ||
                dbName.Contains("production", StringComparison.OrdinalIgnoreCase) ||
                dbName.Contains("prod", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"SAFETY VIOLATION: Refusing to perform test operations against protected/production database '{dbName}'.");
            }
        }

        return dbName;
    }

    public static async Task<(string ConnectionString, string DatabaseName, string RunToken)> CreateIsolatedDatabaseAsync(string adminConnectionString)
    {
        var runId = Guid.NewGuid().ToString("N").Substring(0, 12);
        var dbName = $"chessuno_test_isolated_{runId}";
        var runToken = Guid.NewGuid().ToString("N");

        ValidateIsolatedDatabaseName($"Host=localhost;Database={dbName};");

        await using (var adminConn = new NpgsqlConnection(adminConnectionString))
        {
            await adminConn.OpenAsync();
            await using var cmd = new NpgsqlCommand($"CREATE DATABASE \"{dbName}\";", adminConn);
            await cmd.ExecuteNonQueryAsync();
        }

        var targetBuilder = new NpgsqlConnectionStringBuilder(adminConnectionString)
        {
            Database = dbName
        };
        var targetConnectionString = targetBuilder.ConnectionString;

        // Initialize isolation marker table
        await using (var targetConn = new NpgsqlConnection(targetConnectionString))
        {
            await targetConn.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                """
                CREATE TABLE IF NOT EXISTS chessuno_test_isolation_marker (
                    marker_id UUID PRIMARY KEY,
                    run_token VARCHAR(64) NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                );
                INSERT INTO chessuno_test_isolation_marker (marker_id, run_token, created_at)
                VALUES (@id, @token, @now);
                """,
                targetConn
            );
            cmd.Parameters.AddWithValue("id", Guid.NewGuid());
            cmd.Parameters.AddWithValue("token", runToken);
            cmd.Parameters.AddWithValue("now", DateTimeOffset.UtcNow);
            await cmd.ExecuteNonQueryAsync();
        }

        return (targetConnectionString, dbName, runToken);
    }

    public static async Task<bool> VerifyIsolationMarkerAsync(string targetConnectionString, string runToken)
    {
        try
        {
            await using var conn = new NpgsqlConnection(targetConnectionString);
            await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(
                "SELECT run_token FROM chessuno_test_isolation_marker LIMIT 1;",
                conn
            );
            var result = (string?)await cmd.ExecuteScalarAsync();
            return result == runToken;
        }
        catch
        {
            return false;
        }
    }

    public static async Task DropIsolatedDatabaseAsync(string adminConnectionString, string targetConnectionString, string runToken)
    {
        var dbName = ValidateIsolatedDatabaseName(targetConnectionString);

        // Verification: Marker MUST exist and match runToken
        var markerValid = await VerifyIsolationMarkerAsync(targetConnectionString, runToken);
        if (!markerValid)
        {
            throw new InvalidOperationException(
                $"SAFETY VIOLATION: Refusing to drop database '{dbName}' because test isolation marker is missing or invalid.");
        }

        // Close all connection pools
        NpgsqlConnection.ClearAllPools();

        await using var adminConn = new NpgsqlConnection(adminConnectionString);
        await adminConn.OpenAsync();

        // Terminate any remaining connections to the ephemeral test DB
        await using (var termCmd = new NpgsqlCommand(
            $"""
            SELECT pg_terminate_backend(pid) 
            FROM pg_stat_activity 
            WHERE datname = '{dbName}' AND pid <> pg_backend_pid();
            """,
            adminConn))
        {
            await termCmd.ExecuteNonQueryAsync();
        }

        // Drop the database
        await using (var dropCmd = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{dbName}\" WITH (FORCE);", adminConn))
        {
            await dropCmd.ExecuteNonQueryAsync();
        }
    }
}
