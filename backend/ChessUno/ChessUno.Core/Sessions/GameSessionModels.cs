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

public record PlayerSession(
    Guid PlayerId,
    string PlayerName,
    PlayerColor Color,
    string SecretToken,
    bool IsConnected = false
);

public class GameSession
{
    public Guid GameId { get; init; }
    public string InvitationToken { get; init; }
    public SessionStatus Status { get; set; }
    public PlayerSession? PlayerWhite { get; set; }
    public PlayerSession? PlayerBlack { get; set; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public int GameRevision { get; set; }
    public TurnController EngineController { get; init; }

    [JsonIgnore]
    public SemaphoreSlim SessionLock { get; } = new(1, 1);

    public GameSession(
        Guid gameId,
        string invitationToken,
        PlayerSession creator,
        TurnController engineController,
        TimeSpan? lifetime = null)
    {
        GameId = gameId;
        InvitationToken = invitationToken;
        PlayerWhite = creator;
        EngineController = engineController;
        Status = SessionStatus.WaitingForPlayer;
        CreatedAt = DateTimeOffset.UtcNow;
        ExpiresAt = CreatedAt.Add(lifetime ?? TimeSpan.FromHours(24));
        GameRevision = 1;
    }

    public static string GenerateSecureToken(int byteLength = 24)
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
    string InvitationToken,
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
