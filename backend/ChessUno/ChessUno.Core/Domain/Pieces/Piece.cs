using System.Text.Json.Serialization;
using ChessUno.Core.Domain.Common;

namespace ChessUno.Core.Domain.Pieces;

public record Piece(
    [property: JsonPropertyName("type")] PieceType Type,
    [property: JsonPropertyName("color")] PlayerColor Color
)
{
    public char ToChar()
    {
        char c = Type switch
        {
            PieceType.Pawn => 'p',
            PieceType.Knight => 'n',
            PieceType.Bishop => 'b',
            PieceType.Rook => 'r',
            PieceType.Queen => 'q',
            PieceType.King => 'k',
            _ => '?'
        };
        return Color == PlayerColor.White ? char.ToUpperInvariant(c) : c;
    }

    public static Piece FromChar(char c)
    {
        var color = char.IsUpper(c) ? PlayerColor.White : PlayerColor.Black;
        var type = char.ToLowerInvariant(c) switch
        {
            'p' => PieceType.Pawn,
            'n' => PieceType.Knight,
            'b' => PieceType.Bishop,
            'r' => PieceType.Rook,
            'q' => PieceType.Queen,
            'k' => PieceType.King,
            _ => throw new System.ArgumentException($"Unknown piece character '{c}'")
        };
        return new Piece(type, color);
    }
}

