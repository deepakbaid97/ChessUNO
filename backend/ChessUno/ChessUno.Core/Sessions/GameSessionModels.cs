using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text.Json.Serialization;
using System.Threading;
using ChessUno.Core.Cards;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Game;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Domain.Reserves;
using ChessUno.Core.Domain.Turn;
using ChessUno.Core.Turn;

namespace ChessUno.Core.Sessions;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum SessionStatus
{
    WaitingForPlayer,
    Ready,
    InProgress,
    Completed,
    Expired,
    Cancelled
}

public static class TokenHasher
{
    private static byte[]? _hmacKey;
    private static byte[]? _previousHmacKey;

    public static bool IsInitialized => _hmacKey != null;

    public static void Initialize(byte[] primaryKey, byte[]? previousKey = null)
    {
        if (primaryKey == null || primaryKey.Length < 32)
        {
            throw new ArgumentException("HMAC key must be at least 32 bytes (256 bits) in length.", nameof(primaryKey));
        }

        if (previousKey != null && previousKey.Length < 32)
        {
            throw new ArgumentException("Previous HMAC key must be at least 32 bytes (256 bits) in length.", nameof(previousKey));
        }

        _hmacKey = primaryKey;
        _previousHmacKey = previousKey;
    }

    public static void Initialize(string primaryKeyString, string? previousKeyString = null)
    {
        if (string.IsNullOrWhiteSpace(primaryKeyString))
        {
            throw new ArgumentException("HMAC key cannot be null or whitespace.", nameof(primaryKeyString));
        }

        var primaryBytes = System.Text.Encoding.UTF8.GetBytes(primaryKeyString);
        var previousBytes = string.IsNullOrWhiteSpace(previousKeyString)
            ? null
            : System.Text.Encoding.UTF8.GetBytes(previousKeyString);

        Initialize(primaryBytes, previousBytes);
    }

    public static void ResetForTesting()
    {
        _hmacKey = null;
        _previousHmacKey = null;
    }

    public static void SetKey(byte[] key)
    {
        Initialize(key);
    }

    public static string HashToken(string token)
    {
        if (string.IsNullOrEmpty(token)) return string.Empty;
        if (_hmacKey == null)
        {
            throw new InvalidOperationException("HMAC key has not been configured. TokenHasher must be initialized before generating token hashes.");
        }

        using var hmac = new HMACSHA256(_hmacKey);
        var bytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public static bool VerifyToken(string token, string expectedHash)
    {
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(expectedHash)) return false;
        if (_hmacKey == null)
        {
            throw new InvalidOperationException("HMAC key has not been configured. TokenHasher must be initialized before verifying tokens.");
        }

        var actualHash = HashToken(token);
        if (CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(actualHash),
            System.Text.Encoding.UTF8.GetBytes(expectedHash)))
        {
            return true;
        }

        if (_previousHmacKey != null)
        {
            using var prevHmac = new HMACSHA256(_previousHmacKey);
            var prevBytes = prevHmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(token));
            var prevActualHash = Convert.ToHexString(prevBytes).ToLowerInvariant();

            if (CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(prevActualHash),
                System.Text.Encoding.UTF8.GetBytes(expectedHash)))
            {
                return true;
            }
        }

        return false;
    }
}

public record PlayerSession(
    Guid PlayerId,
    string PlayerName,
    PlayerColor Color,
    string TokenHash,
    [property: JsonIgnore] string? SecretToken = null,
    bool IsConnected = false
)
{
    public static PlayerSession Create(Guid playerId, string playerName, PlayerColor color, string secretToken, bool isConnected = false)
    {
        var hash = TokenHasher.HashToken(secretToken);
        return new PlayerSession(playerId, playerName, color, hash, secretToken, isConnected);
    }

    public bool AuthenticatesWith(string token) => TokenHasher.VerifyToken(token, TokenHash);
}

public class GameSession
{
    public Guid GameId { get; init; }
    [JsonIgnore]
    public string? InvitationToken { get; init; }
    public string InvitationTokenHash { get; init; }
    public SessionStatus Status { get; set; }
    public PlayerSession? PlayerWhite { get; set; }
    public PlayerSession? PlayerBlack { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public int GameRevision { get; set; }
    public TurnController EngineController { get; set; }

    [JsonIgnore]
    public SemaphoreSlim SessionLock { get; } = new(1, 1);

    public GameSession(
        Guid gameId,
        string invitationTokenHash,
        PlayerSession creator,
        TurnController engineController,
        TimeSpan? lifetime = null,
        string? rawInvitationToken = null)
    {
        GameId = gameId;
        InvitationTokenHash = invitationTokenHash;
        InvitationToken = rawInvitationToken;
        PlayerWhite = creator;
        EngineController = engineController;
        Status = SessionStatus.WaitingForPlayer;
        CreatedAt = DateTimeOffset.UtcNow;
        ExpiresAt = CreatedAt.Add(lifetime ?? TimeSpan.FromHours(24));
        GameRevision = 1;
    }

    public bool AuthenticatePlayer(string token, PlayerColor color)
    {
        if (string.IsNullOrEmpty(token)) return false;
        var player = color == PlayerColor.White ? PlayerWhite : PlayerBlack;
        return player != null && player.AuthenticatesWith(token);
    }

    public static string GenerateSecureToken(int byteLength = 32)
    {
        var bytes = RandomNumberGenerator.GetBytes(byteLength);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }
}

public record GameSessionSnapshot(
    Guid GameId,
    string InvitationTokenHash,
    SessionStatus Status,
    PlayerSession? PlayerWhite,
    PlayerSession? PlayerBlack,
    DateTimeOffset CreatedAt,
    DateTimeOffset? ExpiresAt,
    int GameRevision,
    string BoardFen,
    string ConfigVersion,
    long EventSequenceNumber,
    GameStatus GameStatus,
    PlayerColor? Winner,
    bool InCheck,
    int HalfMoveClock,
    int FullMoveNumber,
    IReadOnlyDictionary<PlayerColor, IReadOnlyList<ReservePiece>> Reserves,
    IReadOnlyList<ChessActionRecord> MoveHistory,
    TurnState TurnState,
    IReadOnlyList<CardInstance> DrawDeck,
    IReadOnlyList<CardInstance> DiscardPile
);
