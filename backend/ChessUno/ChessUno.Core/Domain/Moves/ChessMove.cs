using System;
using System.Text.Json.Serialization;
using ChessUno.Core.Domain.Common;

namespace ChessUno.Core.Domain.Moves;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum ChessActionType
{
    StandardMove,
    Capture,
    Castling,
    EnPassant,
    PawnPromotion,
    Revival
}

public record ChessMove(
    [property: JsonPropertyName("from")] Square From,
    [property: JsonPropertyName("to")] Square To,
    [property: JsonPropertyName("promotionPiece")] PieceType? PromotionPiece = null
)
{
    public override string ToString() =>
        PromotionPiece.HasValue ? $"{From}{To}={PromotionPiece.Value}" : $"{From}{To}";
}

public record ChessActionRecord(
    [property: JsonPropertyName("actionNumber")] int ActionNumber,
    [property: JsonPropertyName("player")] PlayerColor Player,
    [property: JsonPropertyName("actionType")] ChessActionType ActionType,
    [property: JsonPropertyName("fromSquare")] Square? FromSquare,
    [property: JsonPropertyName("toSquare")] Square ToSquare,
    [property: JsonPropertyName("pieceType")] PieceType PieceType,
    [property: JsonPropertyName("capturedPieceType")] PieceType? CapturedPieceType,
    [property: JsonPropertyName("fenAfter")] string FenAfter,
    [property: JsonPropertyName("uciNotation")] string UciNotation,
    [property: JsonPropertyName("timestamp")] DateTimeOffset Timestamp
);

