using System;
using System.Text.Json.Serialization;

namespace ChessUno.Core.Domain.Common;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PlayerColor
{
    White,
    Black
}

public static class PlayerColorExtensions
{
    public static PlayerColor Opponent(this PlayerColor color) =>
        color == PlayerColor.White ? PlayerColor.Black : PlayerColor.White;
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PieceType
{
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King
}

public readonly record struct Square
{
    public char File { get; }
    public int Rank { get; }

    public Square(char file, int rank)
    {
        file = char.ToLowerInvariant(file);
        if (file < 'a' || file > 'h')
        {
            throw new ArgumentException($"Invalid file '{file}'. Must be between 'a' and 'h'.", nameof(file));
        }
        if (rank < 1 || rank > 8)
        {
            throw new ArgumentException($"Invalid rank '{rank}'. Must be between 1 and 8.", nameof(rank));
        }

        File = file;
        Rank = rank;
    }

    public static Square Parse(string notation)
    {
        if (string.IsNullOrWhiteSpace(notation) || notation.Length != 2)
        {
            throw new ArgumentException($"Invalid square notation '{notation}'. Must be 2 characters (e.g. 'e4').", nameof(notation));
        }

        char file = notation[0];
        if (!int.TryParse(notation.AsSpan(1, 1), out int rank))
        {
            throw new ArgumentException($"Invalid rank in square notation '{notation}'.", nameof(notation));
        }

        return new Square(file, rank);
    }

    public override string ToString() => $"{File}{Rank}";
}

