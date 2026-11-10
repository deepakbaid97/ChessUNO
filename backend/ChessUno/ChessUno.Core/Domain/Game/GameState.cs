using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;
using ChessUno.Core.Domain.Common;
using ChessUno.Core.Domain.Moves;
using ChessUno.Core.Domain.Pieces;
using ChessUno.Core.Domain.Reserves;

namespace ChessUno.Core.Domain.Game;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum GameStatus
{
    Active,
    Check,
    Checkmate,
    Stalemate,
    DrawByInsufficientMaterial,
    DrawByFiftyMoveRule,
    DrawByThreefoldRepetition,
    Resigned,
    Timeout
}

public record GameState(
    [property: JsonPropertyName("gameId")] Guid GameId,
    [property: JsonPropertyName("configVersion")] string ConfigVersion,
    [property: JsonPropertyName("eventSequenceNumber")] long EventSequenceNumber,
    [property: JsonPropertyName("fen")] string Fen,
    [property: JsonPropertyName("activePlayer")] PlayerColor ActivePlayer,
    [property: JsonPropertyName("status")] GameStatus Status,
    [property: JsonPropertyName("winner")] PlayerColor? Winner,
    [property: JsonPropertyName("inCheck")] bool InCheck,
    [property: JsonPropertyName("halfMoveClock")] int HalfMoveClock,
    [property: JsonPropertyName("fullMoveNumber")] int FullMoveNumber,
    [property: JsonPropertyName("reserves")] IReadOnlyDictionary<PlayerColor, IReadOnlyList<ReservePiece>> Reserves,
    [property: JsonPropertyName("moveHistory")] IReadOnlyList<ChessActionRecord> MoveHistory,
    [property: JsonPropertyName("initialFen")] string? InitialFen = null
)
{
    public Piece? GetPieceAt(Square square)
    {
        // Extract piece from FEN placement field (first token)
        var parts = Fen.Split(' ');
        if (parts.Length == 0) return null;

        var ranks = parts[0].Split('/');
        if (ranks.Length != 8) return null;

        // FEN rank 8 is index 0, rank 1 is index 7
        int rankIndex = 8 - square.Rank;
        var rankStr = ranks[rankIndex];

        int currentFileIndex = 0; // 'a' is 0
        int targetFileIndex = square.File - 'a';

        foreach (char c in rankStr)
        {
            if (char.IsDigit(c))
            {
                currentFileIndex += (c - '0');
            }
            else
            {
                if (currentFileIndex == targetFileIndex)
                {
                    return Piece.FromChar(c);
                }
                currentFileIndex++;
            }

            if (currentFileIndex > targetFileIndex)
            {
                return null;
            }
        }

        return null;
    }
}

