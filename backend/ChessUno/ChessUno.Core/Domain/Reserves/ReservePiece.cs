using System;
using System.Text.Json.Serialization;
using ChessUno.Core.Domain.Common;

namespace ChessUno.Core.Domain.Reserves;

public record ReservePiece(
    [property: JsonPropertyName("id")] Guid Id,
    [property: JsonPropertyName("pieceType")] PieceType PieceType,
    [property: JsonPropertyName("originalOwner")] PlayerColor OriginalOwner,
    [property: JsonPropertyName("capturedOnTurn")] int CapturedOnTurn
);

